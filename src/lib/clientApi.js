import { authenticatedFetch } from "./auth";

const API_BASE = "/api/v1";

function messageFromPayload(payload, status) {
  if (payload && typeof payload === "object") {
    for (const key of ["detail", "message", "error", "title"]) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  if (status === 422) return "No client company is linked to this account yet.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to view this company.";
  if (status === 404) return "Your company record could not be found.";
  return "The company details could not be loaded.";
}

export async function getMyClient() {
  let response;
  try {
    response = await authenticatedFetch(`${API_BASE}/clients/me`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error && error.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error("Could not connect to the service. Check your connection and try again.");
  }

  const raw = await response.text().catch(() => "");
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(messageFromPayload(payload, response.status));
  }

  return payload;
}
