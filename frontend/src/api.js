const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"
).replace(/\/$/, "");

/**
 * Send the current question plus prior text turns to the backend agent.
 * @param {string} message
 * @param {Array<{role:string, content:string}>} history
 * @returns {Promise<{answer:string, toolCalls:Array, iterations:number}>}
 */
export async function sendChat(message, history) {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned ${res.status}`);
  }

  if (!res.ok || !data.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}
