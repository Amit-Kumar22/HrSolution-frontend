import { authenticatedFetch, getAuthSession } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class AttendanceApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "AttendanceApiError";
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

  if (status === 400) return "Some details are invalid. Please review the form and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested attendance sheet could not be found.";
  if (status === 409) return "That change conflicts with existing attendance data. Please review and try again.";
  if (status === 422) return "The request could not be completed because it breaks a business rule.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The attendance service is temporarily unavailable. Please try again shortly.";
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
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function attendanceRequest(path, { method = "GET", body, query, fallbackMessage } = {}) {
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
      throw new AttendanceApiError("Your session has expired. Please sign in again.", {
        status: 401,
        code: "NO_SESSION",
      });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new AttendanceApiError(
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
    throw new AttendanceApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && typeof payload.errorCode === "string" && payload.errorCode) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

export function normalizeAttendancePage(payload, { page = 0, size = 20 } = {}) {
  const content = payload && Array.isArray(payload.content) ? payload.content : Array.isArray(payload) ? payload : [];
  return {
    content,
    page: payload && Number.isFinite(payload.page) ? payload.page : page,
    size: payload && Number.isFinite(payload.size) ? payload.size : size,
    totalElements: payload && Number.isFinite(payload.totalElements) ? payload.totalElements : content.length,
    totalPages: payload && Number.isFinite(payload.totalPages) ? payload.totalPages : content.length ? 1 : 0,
    first: typeof payload?.first === "boolean" ? payload.first : page === 0,
    last: typeof payload?.last === "boolean" ? payload.last : page >= Math.max(0, (payload && Number.isFinite(payload.totalPages) ? payload.totalPages : 1) - 1),
    empty: typeof payload?.empty === "boolean" ? payload.empty : content.length === 0,
  };
}

export async function listAttendanceSheets({
  clientId,
  siteId,
  month,
  year,
  status,
  page = 0,
  size = 20,
  sort = ["year,DESC"],
} = {}) {
  const payload = await attendanceRequest("/attendance", {
    query: {
      clientId,
      siteId,
      month: month === undefined || month === null || month === "" ? undefined : month,
      year: year === undefined || year === null || year === "" ? undefined : year,
      status,
      page,
      size,
      sort: Array.isArray(sort) ? sort : [sort],
    },
    fallbackMessage: "Attendance sheets could not be loaded.",
  });

  return normalizeAttendancePage(payload, { page, size });
}

export function getAttendanceSheet(sheetId) {
  return attendanceRequest(`/attendance/${encodeURIComponent(sheetId)}`, {
    fallbackMessage: "The attendance sheet details could not be loaded.",
  });
}

export function generateAttendanceSheet({ siteId, month, year } = {}) {
  return attendanceRequest("/attendance/generate", {
    method: "POST",
    query: {
      siteId,
      month: month === undefined || month === null || month === "" ? undefined : month,
      year: year === undefined || year === null || year === "" ? undefined : year,
    },
    fallbackMessage: "The attendance sheet could not be generated.",
  });
}

export function saveAttendanceEntries(sheetId, entries) {
  return attendanceRequest(`/attendance/${encodeURIComponent(sheetId)}/entries`, {
    method: "PUT",
    body: { entries },
    fallbackMessage: "Attendance entries could not be saved.",
  });
}

export function submitAttendanceSheet(sheetId) {
  return attendanceRequest(`/attendance/${encodeURIComponent(sheetId)}/submit`, {
    method: "PATCH",
    fallbackMessage: "The attendance sheet could not be submitted.",
  });
}

export function approveAttendanceSheet(sheetId) {
  return attendanceRequest(`/attendance/${encodeURIComponent(sheetId)}/approve`, {
    method: "PATCH",
    fallbackMessage: "The attendance sheet could not be approved.",
  });
}

export function lockAttendanceSheet(sheetId) {
  return attendanceRequest(`/attendance/${encodeURIComponent(sheetId)}/lock`, {
    method: "PATCH",
    fallbackMessage: "The attendance sheet could not be locked.",
  });
}

export function unlockAttendanceSheet(sheetId, reason) {
  return attendanceRequest(`/attendance/${encodeURIComponent(sheetId)}/unlock`, {
    method: "PATCH",
    body: { reason: reason && reason.trim() ? reason.trim() : "Manual unlock requested" },
    fallbackMessage: "The attendance sheet could not be unlocked.",
  });
}

export function rawAttendanceStatus(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function attendanceStatusLabel(value) {
  const key = rawAttendanceStatus(value);
  const labels = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    CLIENT_APPROVED: "Client approved",
    LOCKED: "Locked",
    PROCESSED: "Processed",
    APPROVED: "Approved",
    PAID: "Paid",
  };
  return labels[key] || (typeof value === "string" && value.trim() ? value.trim() : "Unknown");
}

export function attendanceStatusTone(value) {
  const key = rawAttendanceStatus(value);
  const tones = {
    DRAFT: "warn",
    SUBMITTED: "info",
    CLIENT_APPROVED: "success",
    LOCKED: "neutral",
    PROCESSED: "info",
    APPROVED: "success",
    PAID: "success",
  };
  return tones[key] || "neutral";
}

export function getAttendanceSession() {
  try {
    return getAuthSession();
  } catch {
    return null;
  }
}
