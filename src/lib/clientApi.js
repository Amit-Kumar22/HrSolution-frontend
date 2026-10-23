import { authenticatedFetch, getAuthSession, hasAnyPermission, rolesOf } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class ClientApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.payload = payload;
  }
}

function extractFieldMessages(payload) {
  const fields = {};
  if (!payload || typeof payload !== "object") return fields;

  if (Array.isArray(payload.errors)) {
    for (const entry of payload.errors) {
      if (!entry || typeof entry !== "object") continue;
      const fieldName = entry.field || entry.property || entry.name || entry.fieldName;
      const message = entry.message || entry.detail || entry.defaultMessage || entry.title;
      if (typeof fieldName === "string" && fieldName && typeof message === "string" && message) {
        fields[fieldName] = message;
      }
    }
  }

  if (payload.fieldErrors && typeof payload.fieldErrors === "object" && !Array.isArray(payload.fieldErrors)) {
    for (const [fieldName, value] of Object.entries(payload.fieldErrors)) {
      if (typeof value === "string" && value) fields[fieldName] = value;
      else if (Array.isArray(value) && typeof value[0] === "string") fields[fieldName] = value[0];
    }
  }

  return fields;
}

function messageFromPayload(payload, status, fallback) {
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.errors)) {
      const messages = payload.errors
        .map((entry) => {
          if (typeof entry === "string") return entry.trim();
          if (entry && typeof entry === "object") {
            const value = entry.message || entry.detail || entry.title;
            return typeof value === "string" ? value.trim() : "";
          }
          return "";
        })
        .filter(Boolean);
      if (messages.length) return messages.join(" ");
    }
    for (const key of ["detail", "message", "error", "title"]) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to view this resource.";
  if (status === 404) return "The requested item could not be found.";
  if (status === 409) return "That change conflicts with existing data. Please review and try again.";
  if (status === 422) return "The request could not be completed because it breaks a business rule.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The request could not be completed (error ${status}).`;
  return fallback || "The request could not be completed.";
}

function buildUrl(path, query) {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function clientRequest(path, { method = "GET", body, query, fallbackMessage } = {}) {
  const headers = { Accept: "application/json" };
  let requestBody;

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  let response;
  try {
    response = await authenticatedFetch(buildUrl(path, query), {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error && error.status === 401) {
      throw new ClientApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new ClientApiError(
      timedOut
        ? "The request took too long to respond. Please try again."
        : "Could not connect to the service. Check your connection and try again.",
      { status: 0, code: timedOut ? "TIMEOUT" : "NETWORK" },
    );
  }

  let payload = null;
  const rawBody = await response.text().catch(() => "");
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ClientApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && typeof payload.errorCode === "string" && payload.errorCode) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

/* ------------------------------------------------------------------ */
/* Logged-in client's own company                                     */
/* ------------------------------------------------------------------ */

let myClientCache = null;
let myClientCacheToken = null;
let myClientPromise = null;
let myClientPromiseToken = null;

function currentAccessToken() {
  try {
    return getAuthSession()?.accessToken || "";
  } catch {
    return "";
  }
}

export async function getMyClient({ force = false } = {}) {
  const token = currentAccessToken();
  if (!force && myClientCache && myClientCacheToken === token) return myClientCache;
  if (!force && myClientPromise && myClientPromiseToken === token) return myClientPromise;

  myClientPromiseToken = token;
  myClientPromise = (async () => {
    try {
      const payload = await clientRequest("/clients/me", {
        fallbackMessage: "No client company is linked to this account yet. Contact your Shakti Manpower account manager for help.",
      });
      myClientCache = payload;
      myClientCacheToken = token;
      return payload;
    } catch (error) {
      if (error instanceof ClientApiError && error.status === 422) {
        throw new ClientApiError(
          "No client company is linked to this account yet. Contact your Shakti Manpower account manager for help.",
          { status: 422, code: error.code, fields: error.fields, payload: error.payload },
        );
      }
      throw error;
    }
  })();

  try {
    return await myClientPromise;
  } finally {
    myClientPromise = null;
    myClientPromiseToken = null;
  }
}

export function clearMyClientCache() {
  myClientCache = null;
  myClientCacheToken = null;
  myClientPromise = null;
  myClientPromiseToken = null;
}

/* ------------------------------------------------------------------ */
/* Sites                                                               */
/* ------------------------------------------------------------------ */

export async function listMySites(clientId) {
  const payload = await clientRequest(`/clients/${encodeURIComponent(clientId)}/sites`, {
    fallbackMessage: "Your sites could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

export function getMySite(siteId) {
  return clientRequest(`/sites/${encodeURIComponent(siteId)}`, {
    fallbackMessage: "The site details could not be loaded.",
  });
}

/* ------------------------------------------------------------------ */
/* Client users                                                        */
/* ------------------------------------------------------------------ */

export async function listMyClientUsers(clientId) {
  const payload = await clientRequest(`/clients/${encodeURIComponent(clientId)}/users`, {
    fallbackMessage: "Your company's users could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

/* ------------------------------------------------------------------ */
/* Contracts                                                           */
/* ------------------------------------------------------------------ */

export async function listMyContracts(clientId) {
  const payload = await clientRequest(`/clients/${encodeURIComponent(clientId)}/contracts`, {
    fallbackMessage: "Your contracts could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

export function getMyContract(contractId) {
  return clientRequest(`/contracts/${encodeURIComponent(contractId)}`, {
    fallbackMessage: "The contract details could not be loaded.",
  });
}

export function getMyContractInForce(clientId, onDate) {
  return clientRequest(`/clients/${encodeURIComponent(clientId)}/contracts/in-force`, {
    query: { onDate },
    fallbackMessage: "The contract in force could not be resolved.",
  });
}

export function createMyContract(clientId, body) {
  return clientRequest(`/clients/${encodeURIComponent(clientId)}/contracts`, {
    method: "POST",
    body,
    fallbackMessage: "The contract could not be created.",
  });
}

/* The session payload exposes role names; some deployments also attach an
   explicit permission list or a contract-management flag. Contract creation
   is only shown when the server says the user holds one of these. */
export function canCreateClientContracts(sessionOrUser) {
  const user = sessionOrUser && sessionOrUser.user ? sessionOrUser.user : sessionOrUser;
  if (!user || typeof user !== "object") return false;
  if (user.canCreateContracts === true || user.canManageContracts === true) return true;
  if (
    hasAnyPermission(user, [
      "CONTRACT_CREATE",
      "CONTRACT_WRITE",
      "CONTRACT_MANAGE",
      "CLIENT_CONTRACT_CREATE",
      "CLIENT_CONTRACT_WRITE",
    ])
  ) {
    return true;
  }
  return rolesOf(user).some((role) => ["CONTRACT_MANAGER", "CONTRACT_ADMIN"].includes(String(role)));
}
