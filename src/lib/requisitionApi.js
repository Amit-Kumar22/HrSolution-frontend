import { authenticatedFetch, getAuthSession, isClientRole } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class RequisitionApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "RequisitionApiError";
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
  if (status === 400) return "Some details are invalid. Please review and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested item could not be found.";
  if (status === 409) return "That change conflicts with existing data.";
  if (status === 422) return "The request could not be completed due to a business rule.";
  if (status === 429) return "Too many requests. Please wait and try again.";
  if (status >= 500) return "Service temporarily unavailable. Please try again.";
  if (status > 0) return `Request failed (${status}).`;
  return fallback || "Request failed.";
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

async function req(path, { method = "GET", body, query, fallbackMessage } = {}) {
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
      throw new RequisitionApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new RequisitionApiError(timedOut ? "Request timed out." : "Could not connect to service.", { status: 0, code: timedOut ? "TIMEOUT" : "NETWORK" });
  }
  let payload = null;
  const rawBody = await response.text().catch(() => "");
  if (rawBody) {
    try { payload = JSON.parse(rawBody); } catch { payload = null; }
  }
  if (!response.ok) {
    throw new RequisitionApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && (payload.errorCode || payload.code)) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }
  return payload;
}

function normalizePage(payload, { page = 0, size = 20 } = {}) {
  const content = payload && Array.isArray(payload.content) ? payload.content : Array.isArray(payload) ? payload : [];
  return {
    content,
    page: payload && Number.isFinite(payload.page) ? payload.page : page,
    size: payload && Number.isFinite(payload.size) ? payload.size : size,
    totalElements: payload && Number.isFinite(payload.totalElements) ? payload.totalElements : content.length,
    totalPages: payload && Number.isFinite(payload.totalPages) ? payload.totalPages : content.length ? 1 : 0,
    first: payload && typeof payload.first === "boolean" ? payload.first : page === 0,
    last: payload && typeof payload.last === "boolean" ? payload.last : page >= (payload && Number.isFinite(payload.totalPages) ? payload.totalPages - 1 : 0),
    empty: payload && typeof payload.empty === "boolean" ? payload.empty : content.length === 0,
  };
}

export async function listRequisitions({ clientId, siteId, status, categoryId, page = 0, size = 20, sort } = {}) {
  const session = getAuthSession();
  let effectiveClientId = clientId;
  if (session && isClientRole(session)) effectiveClientId = undefined;
  const payload = await req("/requisitions", {
    query: { clientId: effectiveClientId, siteId, status, categoryId, page, size, sort },
    fallbackMessage: "Requisitions could not be loaded.",
  });
  return normalizePage(payload, { page, size });
}

export function getRequisition(requisitionId) { return req(`/requisitions/${encodeURIComponent(requisitionId)}`, { fallbackMessage: "Requisition could not be loaded." }); }
export function getRequisitionDetail(requisitionId) { return req(`/requisitions/${encodeURIComponent(requisitionId)}/detail`, { fallbackMessage: "Requisition history could not be loaded." }); }
export function createRequisition(body, clientId) {
  return req("/requisitions", {
    method: "POST",
    body,
    query: { clientId: clientId || undefined },
    fallbackMessage: "Requisition could not be created.",
  });
}
export function updateRequisition(requisitionId, body) { return req(`/requisitions/${encodeURIComponent(requisitionId)}`, { method: "PUT", body, fallbackMessage: "Requisition could not be updated." }); }
export function updateRequisitionStatus(requisitionId, body) { return req(`/requisitions/${encodeURIComponent(requisitionId)}/status`, { method: "PATCH", body, fallbackMessage: "Requisition status could not be updated." }); }
export function updateRequisitionApproval(requisitionId, body) { return req(`/requisitions/${encodeURIComponent(requisitionId)}/approval`, { method: "PATCH", body, fallbackMessage: "Approval decision could not be processed." }); }
export function deleteRequisition(requisitionId) { return req(`/requisitions/${encodeURIComponent(requisitionId)}`, { method: "DELETE", fallbackMessage: "Requisition could not be deleted." }); }
export async function listUrgentRequisitions({ withinDays = 7 } = {}) {
  const payload = await req("/requisitions/urgent", { query: { withinDays }, fallbackMessage: "Urgent requisitions could not be loaded." });
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.content)) return payload.content;
  return [];
}

export const REQUISITION_STATUSES = Object.freeze([
  { value: "DRAFT", label: "Draft", tone: "neutral" },
  { value: "SUBMITTED", label: "Submitted", tone: "info" },
  { value: "APPROVED", label: "Approved", tone: "success" },
  { value: "REJECTED", label: "Rejected", tone: "danger" },
  { value: "IN_PROGRESS", label: "In Progress", tone: "accent" },
  { value: "PARTIALLY_FULFILLED", label: "Partially Fulfilled", tone: "warn" },
  { value: "FULFILLED", label: "Fulfilled", tone: "success" },
  { value: "CANCELLED", label: "Cancelled", tone: "neutral" },
  { value: "CLOSED", label: "Closed", tone: "neutral" },
]);
const REQ_MAP = new Map(REQUISITION_STATUSES.map((e) => [e.value, e]));
export function requisitionStatusLabel(s) { const m = REQ_MAP.get(s); return m ? m.label : s || "—"; }
export function requisitionStatusTone(s) { const m = REQ_MAP.get(s); return m ? m.tone : "neutral"; }
export const SKILL_LEVELS = Object.freeze([
  { value: "UNSKILLED", label: "Unskilled" },
  { value: "SEMI_SKILLED", label: "Semi-skilled" },
  { value: "SKILLED", label: "Skilled" },
  { value: "HIGHLY_SKILLED", label: "Highly skilled" },
]);
export const SHIFT_OPTIONS = Object.freeze([
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "ROTATIONAL", label: "Rotational" },
]);
export function skillLevelLabel(v){ const m = SKILL_LEVELS.find(x=>x.value===v); return m?m.label:v||"—"; }
export function shiftLabel(v){ const m = SHIFT_OPTIONS.find(x=>x.value===v); return m?m.label:v||"—"; }
