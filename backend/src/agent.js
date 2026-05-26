import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { toolDefinitions, executeTool } from "./tools.js";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a read-only data assistant for a Salesforce org. You answer questions in clear, natural language for a non-technical user on their phone.

Today's date is ${today}.

How you work:
- You do NOT have the Salesforce schema memorized. Discover it with your tools.
- Typical flow: use list_objects to find the right object, describe_object to learn its real field API names and relationships, then soql_query to fetch data. Use sosl_search when you only have a fuzzy name/keyword.
- Always use real field API names returned by describe_object — never guess field names.
- Keep queries tight: select only the fields you need and rely on LIMIT (results are capped anyway).
- Prefer aggregate queries (COUNT(), GROUP BY) when the user wants counts or breakdowns.

Hard rules:
- You are strictly READ-ONLY. You cannot and must not create, update, or delete records. If asked to modify data, politely explain you are read-only.
- Never invent data. If a query returns nothing, say so plainly.

Answering style:
- Lead with the direct answer. Be concise.
- Use Markdown: short paragraphs, bullet lists, and Markdown tables when presenting multiple records.
- Format dates and currency for humans. Don't dump raw IDs unless asked.
- If you couldn't find the answer after exploring, say what you tried and what's missing.`;
}

/**
 * Run the agentic tool-use loop:
 *   call Claude -> while it returns tool_use, execute tools, append
 *   tool_result, call again -> until it returns a plain text answer.
 *
 * @param {string} message  The user's current question.
 * @param {Array<{role:string, content:string}>} history  Prior text turns.
 * @returns {Promise<{answer:string, toolCalls:Array, iterations:number}>}
 */
export async function runAgent(message, history = []) {
  // Reconstruct conversation from plain text turns (the client never sends
  // raw tool_use/tool_result blocks back to us).
  const messages = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: String(m.content) }));

  messages.push({ role: "user", content: String(message) });

  // Cache the (static) tool definitions across loop iterations to cut cost.
  const tools = toolDefinitions.map((t, i) =>
    i === toolDefinitions.length - 1
      ? { ...t, cache_control: { type: "ephemeral" } }
      : t
  );

  const system = [
    { type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } },
  ];

  const toolCalls = [];

  for (let iteration = 1; iteration <= config.maxAgentIterations; iteration++) {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      system,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const answer = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        answer: answer || "I wasn't able to produce an answer.",
        toolCalls,
        iterations: iteration,
      };
    }

    // Execute every tool_use block in this turn and gather results.
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const toolResults = [];
    for (const block of toolUseBlocks) {
      const { result, isError } = await executeTool(block.name, block.input);
      toolCalls.push({ name: block.name, input: block.input, isError });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: isError,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    answer:
      "I explored your Salesforce data but ran out of steps before finishing. Try narrowing the question or asking about one thing at a time.",
    toolCalls,
    iterations: config.maxAgentIterations,
  };
}
