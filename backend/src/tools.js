import { config } from "./config.js";
import { getConnection } from "./salesforce.js";

/**
 * Tool schemas sent to Claude. The model reads these to decide what to call.
 * Keep descriptions action-oriented — they are the model's only documentation.
 */
export const toolDefinitions = [
  {
    name: "list_objects",
    description:
      "List the queryable Salesforce objects (SObjects) in the org, returning each object's label and API name. Call this first when you don't yet know which object holds the data the user is asking about. Optionally pass `nameContains` to filter the (often large) list by a substring of the label or API name, e.g. 'opportunity' or 'account'.",
    input_schema: {
      type: "object",
      properties: {
        nameContains: {
          type: "string",
          description:
            "Optional case-insensitive substring to filter objects by label or API name.",
        },
      },
    },
  },
  {
    name: "describe_object",
    description:
      "Describe a single SObject: its fields (API name, label, type, picklist values, and what reference fields point to) plus parent and child relationships. Call this before writing a SOQL query so you use real field API names and valid relationship paths.",
    input_schema: {
      type: "object",
      properties: {
        objectName: {
          type: "string",
          description: "API name of the object, e.g. 'Account' or 'Opportunity'.",
        },
      },
      required: ["objectName"],
    },
  },
  {
    name: "soql_query",
    description:
      "Run a READ-ONLY SOQL query (must be a plain SELECT) against the org and return the matching records. Use real field API names discovered via describe_object. Prefer adding a LIMIT; results are capped server-side. Date literals like TODAY, THIS_MONTH, LAST_N_DAYS:90 are supported. Aggregate queries (COUNT(), GROUP BY) are allowed.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A single SOQL SELECT statement, e.g. \"SELECT Name, StageName, CloseDate FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_MONTH\".",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sosl_search",
    description:
      "Run a SOSL full-text search to fuzzily find records across multiple objects when you only have a name or keyword and don't know the exact field/object. Example: \"FIND {Acme} IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, Name, Email)\".",
    input_schema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description:
            "A SOSL search statement beginning with FIND { ... }.",
        },
      },
      required: ["search"],
    },
  },
];

/** Recursively remove jsforce's `attributes` metadata so results are compact. */
function stripAttributes(value) {
  if (Array.isArray(value)) return value.map(stripAttributes);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "attributes") continue;
      out[k] = stripAttributes(v);
    }
    return out;
  }
  return value;
}

const DML_KEYWORDS = /\b(insert|update|delete|upsert|undelete|merge|create|drop|alter)\b/i;

/**
 * Validate that a string is a single, read-only SOQL SELECT.
 * Throws a descriptive error otherwise. Defense-in-depth: conn.query only
 * executes SOQL, but we never want to relay anything but a SELECT.
 */
function assertReadOnlySoql(rawQuery) {
  if (typeof rawQuery !== "string" || !rawQuery.trim()) {
    throw new Error("Query must be a non-empty string.");
  }
  const query = rawQuery.trim().replace(/;+\s*$/, "");

  if (query.includes(";")) {
    throw new Error("Multiple statements are not allowed. Send one SELECT.");
  }
  if (!/^select\b/i.test(query)) {
    throw new Error("Only read-only SELECT queries are allowed.");
  }
  if (DML_KEYWORDS.test(query)) {
    throw new Error(
      "Read-only assistant: data-modifying keywords are not permitted."
    );
  }
  return query;
}

/** Ensure a LIMIT clause exists so we never pull unbounded result sets. */
function enforceLimit(query) {
  if (/\blimit\b/i.test(query)) return query;
  // Don't add LIMIT to aggregate queries that group, where it changes meaning.
  if (/\bgroup\s+by\b/i.test(query)) return query;
  return `${query} LIMIT ${config.maxQueryRows}`;
}

async function listObjects({ nameContains } = {}) {
  const conn = getConnection();
  const { sobjects } = await conn.describeGlobal();
  let objects = sobjects
    .filter((o) => o.queryable)
    .map((o) => ({ label: o.label, name: o.name, custom: o.custom }));

  if (nameContains) {
    const needle = String(nameContains).toLowerCase();
    objects = objects.filter(
      (o) =>
        o.name.toLowerCase().includes(needle) ||
        o.label.toLowerCase().includes(needle)
    );
  }

  objects.sort((a, b) => a.label.localeCompare(b.label));
  return { totalQueryable: objects.length, objects };
}

async function describeObject({ objectName }) {
  if (!objectName) throw new Error("objectName is required.");
  const conn = getConnection();
  const meta = await conn.sobject(objectName).describe();

  const fields = meta.fields.map((f) => {
    const field = {
      name: f.name,
      label: f.label,
      type: f.type,
    };
    if (f.referenceTo && f.referenceTo.length) {
      field.referenceTo = f.referenceTo;
      field.relationshipName = f.relationshipName;
    }
    if (f.type === "picklist" && f.picklistValues?.length) {
      field.picklistValues = f.picklistValues
        .filter((p) => p.active)
        .map((p) => p.value)
        .slice(0, 50);
    }
    return field;
  });

  const childRelationships = (meta.childRelationships || [])
    .filter((r) => r.relationshipName)
    .map((r) => ({
      childObject: r.childSObject,
      field: r.field,
      relationshipName: r.relationshipName,
    }));

  return {
    name: meta.name,
    label: meta.label,
    queryable: meta.queryable,
    fieldCount: fields.length,
    fields,
    childRelationships,
  };
}

async function soqlQuery({ query }) {
  const safeQuery = enforceLimit(assertReadOnlySoql(query));
  const conn = getConnection();
  const result = await conn.query(safeQuery);

  const records = stripAttributes(result.records || []).slice(
    0,
    config.maxQueryRows
  );

  return {
    executedQuery: safeQuery,
    totalSize: result.totalSize,
    returnedRows: records.length,
    truncated: result.totalSize > records.length,
    records,
  };
}

async function soslSearch({ search }) {
  if (typeof search !== "string" || !/^\s*find\b/i.test(search)) {
    throw new Error("SOSL search must begin with FIND { ... }.");
  }
  if (DML_KEYWORDS.test(search)) {
    throw new Error("Read-only assistant: only FIND searches are permitted.");
  }
  const conn = getConnection();
  const result = await conn.search(search.trim());
  return {
    executedSearch: search.trim(),
    records: stripAttributes(result.searchRecords || []).slice(
      0,
      config.maxQueryRows
    ),
  };
}

const executors = {
  list_objects: listObjects,
  describe_object: describeObject,
  soql_query: soqlQuery,
  sosl_search: soslSearch,
};

/**
 * Execute a tool call by name. Returns { result, isError }. Errors are
 * returned (not thrown) so the agent can read them and self-correct.
 */
export async function executeTool(name, input) {
  const fn = executors[name];
  if (!fn) {
    return { result: { error: `Unknown tool: ${name}` }, isError: true };
  }
  try {
    const result = await fn(input || {});
    return { result, isError: false };
  } catch (err) {
    return {
      result: { error: err?.message || String(err) },
      isError: true,
    };
  }
}
