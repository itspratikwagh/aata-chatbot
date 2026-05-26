import jsforce from "jsforce";
import { config } from "./config.js";

let connection = null;

/**
 * Returns a singleton jsforce Connection wired for OAuth refresh-token auth.
 *
 * With { oauth2, instanceUrl, refreshToken } jsforce transparently exchanges
 * the refresh token for a fresh access token on the first API call (and again
 * whenever the access token expires), so we never store a short-lived token.
 */
export function getConnection() {
  if (connection) return connection;

  const oauth2 = new jsforce.OAuth2({
    loginUrl: config.salesforce.loginUrl,
    clientId: config.salesforce.clientId,
    clientSecret: config.salesforce.clientSecret,
  });

  connection = new jsforce.Connection({
    oauth2,
    instanceUrl: config.salesforce.instanceUrl,
    refreshToken: config.salesforce.refreshToken,
    // jsforce will fetch an access token automatically before the first call.
    maxRequest: 10,
  });

  connection.on("refresh", () => {
    console.log("[salesforce] access token refreshed");
  });

  return connection;
}
