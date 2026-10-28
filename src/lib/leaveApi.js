import { authenticatedFetch } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class LeaveApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "LeaveApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.payload = payload;
  }
}

function getNestedValue(source, keys) {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return undefined;
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
    if (typeof payload?.validationErrors === "string" && payload.validationErrors.trim()) {
      return payload.validationErrors.trim();
    }
  }

  if (status === 400) return "Some leave details are invalid. Please review the form and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested leave record could not be found.";
  if (status === 409) return "This leave request is no longer in a valid state for that action.";
  if (status === 422) return "The leave request violates a business rule or validation check.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The leave service is temporarily unavailable. Please try again shortly.";
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

async function leaveRequest(path, { method = "GET", body, query, fallbackMessage } = {}) {
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
      throw new LeaveApiError("Your session has expired. Please sign in again.", {
        status: 401,
        code: "NO_SESSION",
      });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new LeaveApiError(
      timedOut
        ? "The leave request took too long to respond. Please try again."
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
    throw new LeaveApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && typeof payload.errorCode === "string" && payload.errorCode) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

export function normalizeLeavePage(payload, { page = 0, size = 20 } = {}) {
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

export function coerceLeaveStatus(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(normalized)) return normalized;
  if (normalized === "CANCELED") return "CANCELLED";
  return normalized || "PENDING";
}

export function leaveStatusLabel(value) {
  switch (coerceLeaveStatus(value)) {
    case "PENDING": return "Pending";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Rejected";
    case "CANCELLED": return "Cancelled";
    default: return String(value || "Pending");
  }
}

export function leaveStatusTone(value) {
  switch (coerceLeaveStatus(value)) {
    case "PENDING": return "warn";
    case "APPROVED": return "success";
    case "REJECTED": return "danger";
    case "CANCELLED": return "neutral";
    default: return "neutral";
  }
}

export function leaveTypeLabel(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "—";
}

export function getLeaveDates(item) {
  const start = getNestedValue(item, ["fromDate", "startDate", "holidayDate"]);
  const end = getNestedValue(item, ["toDate", "endDate", "holidayEndDate"]);
  if (start || end) {
    return {
      fromDate: start || end || "",
      toDate: end || start || "",
    };
  }
  return { fromDate: "", toDate: "" };
}

export function getLeaveReason(item) {
  return getNestedValue(item, ["reason", "notes", "remarks", "leaveReason"]) || "—";
}

export function getLeaveRequestId(item) {
  return getNestedValue(item, ["id", "leaveId", "requestId"]);
}

export function getLeaveWorker(item) {
  const worker = getNestedValue(item, ["worker", "user", "employee"]);
  if (worker && typeof worker === "object") {
    return worker.fullName || worker.name || worker.email || worker.id || "Worker";
  }
  return getNestedValue(item, ["workerName", "workerFullName", "name"]) || "Worker";
}

export async function listLeaveRequests({ workerId, status, page = 0, size = 20, sort = ["createdAt,DESC"] } = {}) {
  const payload = await leaveRequest("/leave", {
    query: {
      workerId,
      status,
      page,
      size,
      sort: Array.isArray(sort) ? sort : [sort],
    },
    fallbackMessage: "Leave requests could not be loaded.",
  });

  return normalizeLeavePage(payload, { page, size });
}

export function applyForLeave({ fromDate, toDate, leaveType, reason } = {}) {
  return leaveRequest("/leave/apply", {
    method: "POST",
    body: {
      fromDate,
      toDate,
      leaveType,
      reason,
    },
    fallbackMessage: "Your leave request could not be submitted.",
  });
}

export function approveLeaveRequest(leaveId, { remarks = "", rejectionReason = "" } = {}) {
  return leaveRequest(`/leave/${encodeURIComponent(leaveId)}/approve`, {
    method: "PATCH",
    body: { remarks, rejectionReason },
    fallbackMessage: "The leave request could not be approved.",
  });
}

export function rejectLeaveRequest(leaveId, { remarks = "", rejectionReason = "" } = {}) {
  return leaveRequest(`/leave/${encodeURIComponent(leaveId)}/reject`, {
    method: "PATCH",
    body: { remarks, rejectionReason },
    fallbackMessage: "The leave request could not be rejected.",
  });
}

export function cancelLeaveRequest(leaveId) {
  return leaveRequest(`/leave/${encodeURIComponent(leaveId)}/cancel`, {
    method: "PATCH",
    fallbackMessage: "The leave request could not be cancelled.",
  });
}

export const LEAVE_TYPES = [
  "CASUAL",
  "SICK",
  "ANNUAL",
  "MATERNITY",
  "PATERNITY",
  "EMERGENCY",
  "BEREAVEMENT",
];
