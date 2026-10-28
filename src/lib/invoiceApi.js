import { authenticatedFetch, rolesOf } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class InvoiceApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "InvoiceApiError";
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
  if (status === 400) return "Some invoice details are invalid. Please review and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this invoice action.";
  if (status === 404) return "The requested invoice could not be found.";
  if (status === 409) return "This invoice is already in a final state and cannot be changed.";
  if (status === 412) return "The invoice cannot be issued or cancelled in its current state.";
  if (status === 422) return "The invoice action breaks an invoicing rule. Please review the invoice status.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The invoicing service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The invoice request could not be completed (${status}).`;
  return fallback || "The invoice request could not be completed.";
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
      throw new InvoiceApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new InvoiceApiError(timedOut ? "The invoice request took too long to respond." : "Could not connect to the invoicing service.", {
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
    throw new InvoiceApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && (payload.errorCode || payload.code)) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

function normalizeInvoicePage(payload, { page = 0, size = 20 } = {}) {
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

export async function listInvoices({ clientId, status, page = 0, size = 20, sort } = {}) {
  const payload = await req("/invoices", {
    query: { clientId, status, page, size, sort },
    fallbackMessage: "Invoices could not be loaded.",
  });
  return normalizeInvoicePage(payload, { page, size });
}

export function getInvoice(invoiceId) {
  return req(`/invoices/${encodeURIComponent(invoiceId)}`, { fallbackMessage: "The invoice could not be loaded." });
}

export function generateInvoiceFromPayroll(body) {
  return req("/invoices/from-payroll", {
    method: "POST",
    body,
    fallbackMessage: "The invoice could not be generated from payroll.",
  });
}

export function issueInvoice(invoiceId) {
  return req(`/invoices/${encodeURIComponent(invoiceId)}/issue`, {
    method: "PATCH",
    fallbackMessage: "The invoice could not be issued.",
  });
}

export function recordInvoicePayment(invoiceId, body) {
  return req(`/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    method: "POST",
    body,
    fallbackMessage: "The payment could not be recorded.",
  });
}

export function createCreditNote(invoiceId, body) {
  return req(`/invoices/${encodeURIComponent(invoiceId)}/credit-notes`, {
    method: "POST",
    body,
    fallbackMessage: "The credit note could not be created.",
  });
}

export function cancelInvoice(invoiceId, reason) {
  return req(`/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: "PATCH",
    query: { reason: reason && reason.trim() ? reason.trim() : undefined },
    fallbackMessage: "The invoice could not be cancelled.",
  });
}

export const INVOICE_STATUSES = Object.freeze([
  { value: "DRAFT", label: "Draft", tone: "neutral" },
  { value: "ISSUED", label: "Issued", tone: "info" },
  { value: "PARTIALLY_PAID", label: "Partially Paid", tone: "warn" },
  { value: "PAID", label: "Paid", tone: "success" },
  { value: "CANCELLED", label: "Cancelled", tone: "danger" },
]);
const INVOICE_STATUS_MAP = new Map(INVOICE_STATUSES.map((entry) => [entry.value, entry]));

export function invoiceStatusLabel(status) {
  const entry = INVOICE_STATUS_MAP.get(status);
  return entry ? entry.label : status || "—";
}

export function invoiceStatusTone(status) {
  const entry = INVOICE_STATUS_MAP.get(status);
  return entry ? entry.tone : "neutral";
}

export const PAYMENT_MODES = Object.freeze([
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CASH", label: "Cash" },
  { value: "OTHER", label: "Other" },
]);

export function paymentModeLabel(mode) {
  const entry = PAYMENT_MODES.find((item) => item.value === mode);
  return entry ? entry.label : mode || "—";
}

export function invoiceCapabilities(session) {
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

  const canList = superAdmin || admin || accounts;
  const canGenerate = superAdmin || admin || accounts;
  const canDecide = superAdmin || admin || accounts; // issue / pay / credit note / cancel

  return {
    canList,
    canView: canList,
    canGenerate,
    canIssue: canDecide,
    canRecordPayment: canDecide,
    canCreateCreditNote: canDecide,
    canCancel: canDecide,
    canManage: canGenerate || canDecide,
    clientViewOnly: client,
    enabled: canList || canGenerate || canDecide || client,
    enforcedBy: "roles",
  };
}
