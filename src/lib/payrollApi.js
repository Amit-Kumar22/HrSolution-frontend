import { authenticatedFetch, rolesOf } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class PayrollApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "PayrollApiError";
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
  if (status === 400) return "Some payroll details are invalid. Please review and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this payroll action.";
  if (status === 404) return "The requested payroll run could not be found.";
  if (status === 409) return "This payroll run is already in a final state and cannot be changed.";
  if (status === 412) return "The attendance sheet must be locked before payroll can be generated.";
  if (status === 422) return "The payroll action breaks a payroll rule. Please review the run status.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The payroll service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The payroll request could not be completed (${status}).`;
  return fallback || "The payroll request could not be completed.";
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
      throw new PayrollApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new PayrollApiError(timedOut ? "The payroll request took too long to respond." : "Could not connect to the payroll service.", {
      status: 0,
      code: timedOut ? "TIMEOUT" : "NETWORK",
    });
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
    throw new PayrollApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && (payload.errorCode || payload.code)) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

function normalizePayrollPage(payload, { page = 0, size = 20 } = {}) {
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

export async function listPayrollRuns({ clientId, month, year, status, page = 0, size = 20, sort } = {}) {
  const payload = await req("/payroll", {
    query: { clientId, month, year, status, page, size, sort },
    fallbackMessage: "Payroll runs could not be loaded.",
  });
  return normalizePayrollPage(payload, { page, size });
}

export function getPayrollRun(runId) {
  return req(`/payroll/${encodeURIComponent(runId)}`, { fallbackMessage: "The payroll run could not be loaded." });
}

export function generatePayroll(body) {
  return req("/payroll/generate", { method: "POST", body, fallbackMessage: "The payroll run could not be generated." });
}

export function processPayroll(runId) {
  return req(`/payroll/${encodeURIComponent(runId)}/process`, { method: "PATCH", fallbackMessage: "The payroll run could not be processed." });
}

export function approvePayroll(runId) {
  return req(`/payroll/${encodeURIComponent(runId)}/approve`, { method: "PATCH", fallbackMessage: "The payroll run could not be approved." });
}

export function lockPayroll(runId) {
  return req(`/payroll/${encodeURIComponent(runId)}/lock`, { method: "PATCH", fallbackMessage: "The payroll run could not be locked." });
}

export function payPayroll(runId) {
  return req(`/payroll/${encodeURIComponent(runId)}/pay`, { method: "PATCH", fallbackMessage: "The payroll run could not be marked as paid." });
}

export const PAYROLL_STATUSES = Object.freeze([
  { value: "DRAFT", label: "Draft", tone: "neutral" },
  { value: "PROCESSED", label: "Processed", tone: "info" },
  { value: "APPROVED", label: "Approved", tone: "success" },
  { value: "PAID", label: "Paid", tone: "success" },
  { value: "LOCKED", label: "Locked", tone: "warn" },
]);
const PAYROLL_STATUS_MAP = new Map(PAYROLL_STATUSES.map((entry) => [entry.value, entry]));

export function payrollStatusLabel(status) {
  const entry = PAYROLL_STATUS_MAP.get(status);
  return entry ? entry.label : status || "—";
}

export function payrollStatusTone(status) {
  const entry = PAYROLL_STATUS_MAP.get(status);
  return entry ? entry.tone : "neutral";
}

export const MONTHS = Object.freeze([
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]);

export function monthLabel(month) {
  const entry = MONTHS.find((item) => item.value === Number(month));
  return entry ? entry.label : month || "—";
}

export function payrollCapabilities(session) {
  const roles = new Set(rolesOf(session));
  const superAdmin = roles.has("SUPER_ADMIN");
  const admin = roles.has("ADMIN") || roles.has("MANAGER") || roles.has("RECRUITER");
  const operator = roles.has("OPERATOR") || roles.has("OPERATIONS") || roles.has("OPERATIONS_MANAGER");
  const hr = roles.has("HR") || roles.has("HR_RECRUITER") || roles.has("HR_MANAGER");
  const siteSupervisor = roles.has("SUPERVISOR") || roles.has("SITE_SUPERVISOR");
  const accounts = roles.has("ACCOUNTS") || roles.has("ACCOUNTANT");
  const client = roles.has("CLIENT");
  const worker = roles.has("WORKER");
  const candidate = roles.has("CANDIDATE");

  const canList = superAdmin || admin || operator || hr || accounts;
  const canGenerate = superAdmin || admin || hr || accounts;
  const canDecide = superAdmin || admin || accounts; // process / approve / lock / pay

  return {
    canList,
    canView: canList,
    canGenerate,
    canProcess: canDecide,
    canApprove: canDecide,
    canLock: canDecide,
    canPay: canDecide,
    canManage: canGenerate || canDecide,
    clientViewOnly: client,
    selfPayslipOnly: worker,
    enabled: canList || canGenerate || canDecide || client || worker,
    enforcedBy: "roles",
  };
}
