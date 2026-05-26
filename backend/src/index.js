import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { runAgent } from "./agent.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

const allowAll = config.allowedOrigins.includes("*");
app.use(
  cors({
    origin: allowAll
      ? true
      : (origin, callback) => {
          // Allow same-origin / curl (no Origin header) and whitelisted origins.
          if (!origin || config.allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error(`Origin not allowed: ${origin}`));
        },
    methods: ["GET", "POST"],
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: config.anthropic.model });
});

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || typeof message !== "string") {
    return res
      .status(400)
      .json({ ok: false, error: "Request body must include a 'message' string." });
  }

  try {
    const { answer, toolCalls, iterations } = await runAgent(
      message,
      Array.isArray(history) ? history : []
    );
    res.json({ ok: true, answer, toolCalls, iterations });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Something went wrong while answering.",
    });
  }
});

app.listen(config.port, () => {
  console.log(
    `[server] AATA Salesforce assistant listening on :${config.port} ` +
      `(model: ${config.anthropic.model})`
  );
});
