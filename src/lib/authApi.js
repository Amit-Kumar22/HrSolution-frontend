import { authenticatedFetch } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class AuthApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "AuthApiError";
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

function messageFromPayload(payload, status, fallbacks = {}) {
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

  if (fallbacks[status]) return fallbacks[status];

  switch (status) {
    case 400:
      return "Some of the details you provided are invalid. Please review the form and try again.";
    case 401:
      return "Your session is no longer valid. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 409:
      return "An account with these details already exists.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      break;
  }

  if (status >= 500) return "The service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The request could not be completed (error ${status}).`;
  return "Could not connect to the service. Check your connection and try again.";
}

async function parseResponse(response) {
  const rawBody = await response.text().catch(() => "");
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function buildError(response, payload, fallbacks) {
  return new AuthApiError(messageFromPayload(payload, response.status, fallbacks), {
    status: response.status,
    code: (payload && typeof payload.errorCode === "string" && payload.errorCode) || null,
    fields: extractFieldMessages(payload),
    payload,
  });
}

async function publicRequest(path, { method = "POST", body, signal } = {}, fallbacks) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal === undefined ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : signal || undefined,
    });
  } catch (error) {
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new AuthApiError(
      timedOut
        ? "The request took too long to respond. Please try again."
        : "Could not connect to the service. Check your connection and try again.",
      { status: 0, code: timedOut ? "TIMEOUT" : "NETWORK" },
    );
  }

  const payload = await parseResponse(response);
  if (!response.ok) throw buildError(response, payload, fallbacks);
  return payload;
}

async function authenticatedRequest(path, { method = "GET", body, signal } = {}, fallbacks) {
  let response;
  try {
    response = await authenticatedFetch(`${API_BASE}${path}`, {
      method,
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
      signal: signal === undefined ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : signal || undefined,
    });
  } catch (error) {
    if (error && error.status === 401) {
      throw new AuthApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new AuthApiError(
      timedOut
        ? "The request took too long to respond. Please try again."
        : "Could not connect to the service. Check your connection and try again.",
      { status: 0, code: timedOut ? "TIMEOUT" : "NETWORK" },
    );
  }

  const payload = await parseResponse(response);
  if (!response.ok) throw buildError(response, payload, fallbacks);
  return payload;
}

const REGISTER_FALLBACKS = {
  400: "Please check the details you entered and try again.",
  409: "An account with this email already exists. Try signing in or reset your password.",
  429: "Too many registration attempts. Please wait and try again later.",
};

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export function registerCandidate(body) {
  return publicRequest(
    "/auth/register/candidate",
    { method: "POST", body: { ...body, consentGiven: Boolean(body.consentGiven) } },
    REGISTER_FALLBACKS,
  );
}

export function registerClient(body) {
  return publicRequest(
    "/auth/register/client",
    { method: "POST", body: { ...body, consentGiven: Boolean(body.consentGiven) } },
    REGISTER_FALLBACKS,
  );
}

/* ------------------------------------------------------------------ */
/* Email verification & password reset                                 */
/* ------------------------------------------------------------------ */

export function resendVerification(email) {
  return publicRequest("/auth/resend-verification", { method: "POST", body: { email } });
}

export function verifyEmail(token) {
  return publicRequest(
    "/auth/verify-email",
    { method: "POST", body: { token } },
    { 400: "This verification link is invalid, expired or has already been used." },
  );
}

export function resetPassword(token, newPassword) {
  return publicRequest(
    "/auth/reset-password",
    { method: "POST", body: { token, newPassword } },
    { 400: "This reset link is invalid, expired or has already been used." },
  );
}

/* ------------------------------------------------------------------ */
/* Active sessions                                                     */
/* ------------------------------------------------------------------ */

export async function listSessions() {
  const payload = await authenticatedRequest(
    "/auth/sessions",
    { method: "GET" },
    { 401: "Your session has expired. Please sign in again." },
  );
  return Array.isArray(payload) ? payload : [];
}

export async function revokeSession(sessionId) {
  return authenticatedRequest(
    `/auth/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
    {
      401: "The session could not be revoked. It may already be signed out, or belong to another account.",
    },
  );
}
