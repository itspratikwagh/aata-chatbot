import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in (see README).`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 8080,

  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    // Latest Claude generation. Override with ANTHROPIC_MODEL.
    // claude-opus-4-7 is the most capable; sonnet is faster/cheaper for the loop.
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS) || 2048,
  },

  salesforce: {
    clientId: required("SF_CLIENT_ID"),
    clientSecret: required("SF_CLIENT_SECRET"),
    refreshToken: required("SF_REFRESH_TOKEN"),
    instanceUrl: required("SF_INSTANCE_URL"),
    loginUrl: process.env.SF_LOGIN_URL || "https://login.salesforce.com",
  },

  // Comma-separated list of allowed CORS origins. "*" allows all.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // Hard caps for the agentic loop and query results.
  maxAgentIterations: Number(process.env.MAX_AGENT_ITERATIONS) || 6,
  maxQueryRows: Number(process.env.MAX_QUERY_ROWS) || 200,
};
