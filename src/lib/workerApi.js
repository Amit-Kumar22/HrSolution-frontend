import { authenticatedFetch, rolesOf } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export const MAX_WORKER_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const WORKER_DOCUMENT_TYPES_ALLOWED = Object.freeze(["application/pdf", "image/png", "image/jpeg", "image/jpg"]);

export class WorkerApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "WorkerApiError";
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
  if (status === 404) return "The requested worker could not be found.";
  if (status === 409) return "That Aadhaar, PAN, UAN or bank account is already on file.";
  if (status === 413) return "The file is larger than the 10 MB limit.";
  if (status === 415) return "Only PDF, PNG and JPEG files are accepted.";
  if (status === 422) return "The request breaks a workforce rule. Please review the details.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The workforce service is temporarily unavailable. Please try again shortly.";
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

async function req(path, { method = "GET", body, formData, query, fallbackMessage } = {}) {
  const headers = { Accept: "application/json" };
  let requestBody;
  if (formData) {
    requestBody = formData;
  } else if (body !== undefined) {
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
      throw new WorkerApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new WorkerApiError(timedOut ? "The request took too long to respond." : "Could not connect to the service.", {
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
    throw new WorkerApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && (payload.errorCode || payload.code)) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

export function normalizeWorkerPage(payload, { page = 0, size = 20 } = {}) {
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

export async function listWorkers({ search, status, policeVerification, page = 0, size = 20, sort } = {}) {
  const payload = await req("/workers", {
    query: { search, status, policeVerification, page, size, sort },
    fallbackMessage: "Workers could not be loaded.",
  });
  return normalizeWorkerPage(payload, { page, size });
}

export function getWorker(workerId) {
  return req(`/workers/${encodeURIComponent(workerId)}`, { fallbackMessage: "The worker could not be loaded." });
}

export function createWorker(body) {
  return req("/workers", { method: "POST", body, fallbackMessage: "The worker could not be onboarded." });
}

export function updateWorker(workerId, body) {
  return req(`/workers/${encodeURIComponent(workerId)}`, {
    method: "PUT",
    body,
    fallbackMessage: "The worker could not be updated.",
  });
}

export function deleteWorker(workerId) {
  return req(`/workers/${encodeURIComponent(workerId)}`, {
    method: "DELETE",
    fallbackMessage: "The worker could not be deleted.",
  });
}

export async function lookupWorkerByAadhaar(aadhaar) {
  return req("/workers/lookup", {
    query: { aadhaar },
    fallbackMessage: "The Aadhaar lookup could not be completed.",
  });
}

export function getWorkerSensitive(workerId) {
  return req(`/workers/${encodeURIComponent(workerId)}/sensitive`, {
    fallbackMessage: "The sensitive worker details could not be loaded.",
  });
}

export function recordPoliceVerification(workerId, body) {
  return req(`/workers/${encodeURIComponent(workerId)}/police-verification`, {
    method: "PATCH",
    body,
    fallbackMessage: "The police verification could not be recorded.",
  });
}

export function recordWorkerExit(workerId, body) {
  return req(`/workers/${encodeURIComponent(workerId)}/exit`, {
    method: "PATCH",
    body,
    fallbackMessage: "The worker exit could not be recorded.",
  });
}

export function markWorkerSettled(workerId) {
  return req(`/workers/${encodeURIComponent(workerId)}/settled`, {
    method: "PATCH",
    fallbackMessage: "The settlement could not be marked complete.",
  });
}

export function convertApplicationToWorker(applicationId, body) {
  return req(`/workers/from-application/${encodeURIComponent(applicationId)}`, {
    method: "POST",
    body,
    fallbackMessage: "The application could not be converted to a worker.",
  });
}

export async function listSalaryStructures(workerId) {
  const payload = await req(`/workers/${encodeURIComponent(workerId)}/salary-structures`, {
    fallbackMessage: "The wage history could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

export function createSalaryStructure(workerId, body) {
  return req(`/workers/${encodeURIComponent(workerId)}/salary-structures`, {
    method: "POST",
    body,
    fallbackMessage: "The wage structure could not be saved.",
  });
}

export function getEffectiveSalaryStructure(workerId, onDate) {
  return req(`/workers/${encodeURIComponent(workerId)}/salary-structures/effective`, {
    query: { onDate },
    fallbackMessage: "The wage structure in force could not be loaded.",
  });
}

export async function listWorkerDocuments(workerId) {
  const payload = await req(`/workers/${encodeURIComponent(workerId)}/documents`, {
    fallbackMessage: "The worker documents could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

export function uploadWorkerDocument(workerId, { file, metadata }) {
  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify(metadata || {})], { type: "application/json" }));
  formData.append("file", file);
  return req(`/workers/${encodeURIComponent(workerId)}/documents`, {
    method: "POST",
    formData,
    fallbackMessage: "The document could not be uploaded.",
  });
}

export function getWorkerDocument(workerDocumentId) {
  return req(`/worker-documents/${encodeURIComponent(workerDocumentId)}`, {
    fallbackMessage: "The document could not be loaded.",
  });
}

export function verifyWorkerDocument(workerDocumentId, body) {
  return req(`/worker-documents/${encodeURIComponent(workerDocumentId)}/verification`, {
    method: "PATCH",
    body,
    fallbackMessage: "The document decision could not be saved.",
  });
}

export function deleteWorkerDocument(workerDocumentId) {
  return req(`/worker-documents/${encodeURIComponent(workerDocumentId)}`, {
    method: "DELETE",
    fallbackMessage: "The document could not be removed.",
  });
}

export async function listExpiringWorkerDocuments(withinDays = 30) {
  const payload = await req("/worker-documents/expiring", {
    query: { withinDays },
    fallbackMessage: "Expiring documents could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

export async function listBankAccounts(workerId) {
  const payload = await req(`/workers/${encodeURIComponent(workerId)}/bank-accounts`, {
    fallbackMessage: "The bank accounts could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

export function addBankAccount(workerId, body) {
  return req(`/workers/${encodeURIComponent(workerId)}/bank-accounts`, {
    method: "POST",
    body,
    fallbackMessage: "The bank account could not be added.",
  });
}

export function setPrimaryBankAccount(accountId) {
  return req(`/bank-accounts/${encodeURIComponent(accountId)}/primary`, {
    method: "PATCH",
    fallbackMessage: "The primary account could not be changed.",
  });
}

export function setBankAccountActive(accountId, active) {
  return req(`/bank-accounts/${encodeURIComponent(accountId)}/active`, {
    method: "PATCH",
    query: { active: Boolean(active) },
    fallbackMessage: "The bank account could not be updated.",
  });
}

export function deleteBankAccount(accountId) {
  return req(`/bank-accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
    fallbackMessage: "The bank account could not be removed.",
  });
}

export async function listWorkerDeployments(workerId) {
  try {
    const payload = await req(`/deployments/worker/${encodeURIComponent(workerId)}/history`, {
      fallbackMessage: "The deployment history could not be loaded.",
    });
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.content)) return payload.content;
    return [];
  } catch (err) {
    try {
      const payload = await req(`/workers/${encodeURIComponent(workerId)}/deployments`, {
        fallbackMessage: "The deployment history could not be loaded.",
      });
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.content)) return payload.content;
      return [];
    } catch (err2) {
      throw err;
    }
  }
}

export const WORKER_STATUSES = Object.freeze([
  { value: "ON_BENCH", label: "On bench", tone: "info" },
  { value: "DEPLOYED", label: "Deployed", tone: "success" },
  { value: "ON_LEAVE", label: "On leave", tone: "warn" },
  { value: "RESIGNED", label: "Resigned", tone: "neutral" },
  { value: "TERMINATED", label: "Terminated", tone: "danger" },
]);
const WORKER_STATUS_MAP = new Map(WORKER_STATUSES.map((entry) => [entry.value, entry]));

export function workerStatusLabel(status) {
  const entry = WORKER_STATUS_MAP.get(status);
  return entry ? entry.label : status || "—";
}

export function workerStatusTone(status) {
  const entry = WORKER_STATUS_MAP.get(status);
  return entry ? entry.tone : "neutral";
}

export const POLICE_VERIFICATION_STATUSES = Object.freeze([
  { value: "NOT_STARTED", label: "Not started", tone: "neutral" },
  { value: "IN_PROGRESS", label: "In progress", tone: "warn" },
  { value: "VERIFIED", label: "Verified", tone: "success" },
  { value: "FAILED", label: "Failed", tone: "danger" },
  { value: "NOT_REQUIRED", label: "Not required", tone: "info" },
]);
const POLICE_STATUS_MAP = new Map(POLICE_VERIFICATION_STATUSES.map((entry) => [entry.value, entry]));

export function policeStatusLabel(status) {
  const entry = POLICE_STATUS_MAP.get(status);
  return entry ? entry.label : status || "—";
}

export function policeStatusTone(status) {
  const entry = POLICE_STATUS_MAP.get(status);
  return entry ? entry.tone : "neutral";
}

export const WORKER_GENDERS = Object.freeze([
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
]);

export const WORKER_DOCUMENT_TYPES = Object.freeze([
  { value: "AADHAAR", label: "Aadhaar" },
  { value: "PAN", label: "PAN" },
  { value: "PHOTO", label: "Photograph" },
  { value: "POLICE_VERIFICATION", label: "Police verification certificate" },
  { value: "EDUCATION", label: "Education certificate" },
  { value: "EXPERIENCE", label: "Experience certificate" },
  { value: "MEDICAL", label: "Medical certificate" },
  { value: "BANK_PROOF", label: "Bank proof" },
  { value: "LICENCE", label: "Licence" },
  { value: "OTHER", label: "Other" },
]);
const DOCUMENT_TYPE_MAP = new Map(WORKER_DOCUMENT_TYPES.map((entry) => [entry.value, entry]));

export function workerDocumentTypeLabel(type) {
  const entry = DOCUMENT_TYPE_MAP.get(type);
  return entry ? entry.label : type || "Document";
}

export const DOCUMENT_TYPES_WITH_EXPIRY = Object.freeze(["POLICE_VERIFICATION", "MEDICAL", "LICENCE"]);

export const DOCUMENT_VERIFICATION_TONES = Object.freeze({
  PENDING: "warn",
  VERIFIED: "success",
  REJECTED: "danger",
});

export const DEPLOYMENT_STATUS_TONES = Object.freeze({
  ACTIVE: "success",
  TRANSFERRED: "info",
  RELEASED: "warn",
  COMPLETED: "neutral",
});

export function validateWorkerDocumentFile(file) {
  if (!file) return "Choose a PDF, PNG or JPEG file.";
  const type = String(file.type || "").toLowerCase();
  if (type && !WORKER_DOCUMENT_TYPES_ALLOWED.includes(type)) return "Only PDF, PNG and JPEG files are allowed.";
  if (typeof file.size === "number" && file.size > MAX_WORKER_DOCUMENT_BYTES) return "The document must be 10 MB or smaller.";
  return null;
}

export function isAadhaar(value) {
  return /^\d{12}$/.test(String(value || "").replace(/\s+/g, ""));
}

export function isPan(value) {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(String(value || "").trim().toUpperCase());
}

export function workerCapabilities(session) {
  const roles = new Set(rolesOf(session));
  const superAdmin = roles.has("SUPER_ADMIN");
  const admin = roles.has("ADMIN");
  const operator = roles.has("OPERATOR") || roles.has("OPERATIONS") || roles.has("OPERATIONS_MANAGER");
  const hr = roles.has("HR") || roles.has("HR_RECRUITER") || roles.has("HR_MANAGER");
  const accounts = roles.has("ACCOUNTS") || roles.has("ACCOUNTANT");
  const worker = roles.has("WORKER");
  const canView = superAdmin || admin || operator || hr || accounts;

  return {
    canList: canView,
    canView,
    canManage: superAdmin || admin || operator || hr,
    canSensitive: superAdmin || admin || operator || accounts,
    canSalary: superAdmin || admin || operator || accounts,
    canBank: superAdmin || admin || operator || hr || accounts || worker,
    canDocuments: superAdmin || admin || operator || hr || worker,
    canSettle: superAdmin || admin || accounts,
    canDelete: superAdmin || admin,
    canLookup: superAdmin || admin || operator || hr,
    selfService: worker,
    enforcedBy: "roles",
  };
}
