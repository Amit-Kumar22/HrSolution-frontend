import { authenticatedFetch, getAuthSession } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class HolidayApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "HolidayApiError";
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

  if (status === 400) return "Some holiday details are invalid. Please review the form and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested holiday could not be found.";
  if (status === 409) return "That holiday change conflicts with current records.";
  if (status === 422) return "The holiday request violates a validation rule.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The holidays service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The request could not be completed (${status}).`;
  return fallback || "The request could not be completed.";
}

function buildUrl(path, query) {
  const url = `${API_BASE}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item !== undefined && item !== null && item !== "") params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function ensureSession() {
  const session = getAuthSession();
  if (!session || !session.accessToken) {
    throw new HolidayApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
  }
  return session;
}

async function holidayRequest(path, { method = "GET", body, query, fallbackMessage } = {}) {
  const session = ensureSession();
  const headers = { Accept: "application/json", Authorization: `${session.tokenType} ${session.accessToken}` };
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
      throw new HolidayApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new HolidayApiError(
      timedOut
        ? "The holiday request took too long to respond. Please try again."
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
    throw new HolidayApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && typeof payload.errorCode === "string" && payload.errorCode) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

export function normalizeHolidayList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.content)) return payload.content;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

export function getHolidayDateValue(item) {
  if (!item || typeof item !== "object") return "";
  return item.holidayDate || item.date || item.eventDate || item.day || "";
}

export function getHolidayId(item) {
  if (!item || typeof item !== "object") return "";
  return item.id ?? item.holidayId ?? item._id ?? "";
}

export function getHolidayName(item) {
  if (!item || typeof item !== "object") return "Holiday";
  return item.name || item.title || "Holiday";
}

export function listHolidays({ from, to, state } = {}) {
  return holidayRequest("/holidays", {
    query: { from, to, state },
    fallbackMessage: "Holidays could not be loaded.",
  }).then(normalizeHolidayList);
}

export function addHoliday(payload) {
  return holidayRequest("/holidays", {
    method: "POST",
    body: payload,
    fallbackMessage: "The holiday could not be created.",
  });
}

export function updateHoliday(id, payload) {
  return holidayRequest(`/holidays/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
    fallbackMessage: "The holiday could not be updated.",
  });
}

export function deleteHoliday(id) {
  return holidayRequest(`/holidays/${encodeURIComponent(id)}`, {
    method: "DELETE",
    fallbackMessage: "The holiday could not be deleted.",
  });
}
