#!/usr/bin/env node
/**
 * One-time OAuth helper: `npm run sf:auth`
 *
 * Runs the Salesforce OAuth 2.0 web-server flow against your Connected App,
 * then prints the refresh token (and instance URL) for you to store as env
 * vars (SF_REFRESH_TOKEN / SF_INSTANCE_URL). Nothing is written to disk.
 *
 * Requires SF_CLIENT_ID and SF_CLIENT_SECRET in your environment (or .env).
 * Optionally SF_LOGIN_URL (defaults to https://login.salesforce.com; use
 * https://test.salesforce.com for sandboxes) and SF_AUTH_PORT (default 3030).
 *
 * Your Connected App's Callback URL must include:
 *   http://localhost:<SF_AUTH_PORT>/oauth/callback
 */
import http from "node:http";
import { URL } from "node:url";
import dotenv from "dotenv";
import jsforce from "jsforce";

dotenv.config();

const PORT = Number(process.env.SF_AUTH_PORT) || 3030;
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;
const LOGIN_URL = process.env.SF_LOGIN_URL || "https://login.salesforce.com";

const clientId = process.env.SF_CLIENT_ID;
const clientSecret = process.env.SF_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "\nMissing SF_CLIENT_ID and/or SF_CLIENT_SECRET.\n" +
      "Set them in your environment or in backend/.env, then re-run `npm run sf:auth`.\n"
  );
  process.exit(1);
}

const oauth2 = new jsforce.OAuth2({
  loginUrl: LOGIN_URL,
  clientId,
  clientSecret,
  redirectUri: REDIRECT_URI,
});

const authUrl = oauth2.getAuthorizationUrl({
  scope: "api refresh_token offline_access",
  // Force the consent screen so a refresh token is always issued.
  prompt: "consent",
});

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth/callback")) {
    res.writeHead(404).end("Not found");
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Authorization failed</h1><p>${error}: ${url.searchParams.get("error_description") || ""}</p>`);
    console.error("\nAuthorization failed:", error);
    server.close(() => process.exit(1));
    return;
  }

  if (!code) {
    res.writeHead(400).end("Missing authorization code.");
    return;
  }

  try {
    const conn = new jsforce.Connection({ oauth2 });
    const userInfo = await conn.authorize(code);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h1>Success</h1><p>You can close this tab and return to your terminal.</p>"
    );

    console.log("\n========================================================");
    console.log(" Salesforce OAuth successful");
    console.log("========================================================");
    console.log(` User Id     : ${userInfo.id}`);
    console.log(` Org Id      : ${userInfo.organizationId}`);
    console.log("\nAdd these to your backend environment (.env / Railway):\n");
    console.log(`SF_INSTANCE_URL=${conn.instanceUrl}`);
    console.log(`SF_REFRESH_TOKEN=${conn.refreshToken}`);
    console.log("\n(Keep the refresh token secret — treat it like a password.)\n");

    server.close(() => process.exit(0));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h1>Token exchange failed</h1><pre>${err?.message || err}</pre>`);
    console.error("\nToken exchange failed:", err?.message || err);
    server.close(() => process.exit(1));
  }
});

server.listen(PORT, () => {
  console.log("\nSalesforce OAuth helper");
  console.log("-----------------------");
  console.log(`Login URL    : ${LOGIN_URL}`);
  console.log(`Redirect URI : ${REDIRECT_URI}`);
  console.log(
    `\nMake sure the above redirect URI is listed as a Callback URL on your Connected App.\n`
  );
  console.log("Open this URL in your browser to authorize:\n");
  console.log(authUrl + "\n");
});
