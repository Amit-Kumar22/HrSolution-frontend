import { authenticatedFetch, hasPermission, isClientRole } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export class DeploymentApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "DeploymentApiError";
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
  if (status === 404) return "The deployment could not be found or is not accessible to you.";
  if (status === 409) return "That change conflicts with an existing deployment. Please review the dates and try again.";
  if (status === 422) return "The deployment breaks a business rule. Please review the details and try again.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The deployment service is temporarily unavailable. Please try again shortly.";
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
      throw new DeploymentApiError("Your session has expired. Please sign in again.", {
        status: 401,
        code: "NO_SESSION",
      });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new DeploymentApiError(
      timedOut ? "The request took too long to respond. Please try again." : "Could not connect to the service. Check your connection and try again.",
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
    throw new DeploymentApiError(messageFromPayload(payload, response.status, fallbackMessage), {
      status: response.status,
      code: (payload && (payload.errorCode || payload.code)) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

export function normalizeDeploymentPage(payload, { page = 0, size = 20 } = {}) {
  const content = payload && Array.isArray(payload.content) ? payload.content : Array.isArray(payload) ? payload : [];
  const totalPages = payload && Number.isFinite(payload.totalPages) ? payload.totalPages : content.length ? 1 : 0;
  return {
    content,
    page: payload && Number.isFinite(payload.page) ? payload.page : page,
    size: payload && Number.isFinite(payload.size) ? payload.size : size,
    totalElements: payload && Number.isFinite(payload.totalElements) ? payload.totalElements : content.length,
    totalPages,
    first: payload && typeof payload.first === "boolean" ? payload.first : page === 0,
    last: payload && typeof payload.last === "boolean" ? payload.last : page >= Math.max(0, totalPages - 1),
    empty: payload && typeof payload.empty === "boolean" ? payload.empty : content.length === 0,
  };
}

/* ------------------------------------------------------------------ */
/* Deployments                                                         */
/* ------------------------------------------------------------------ */

export async function listDeployments({
  clientId,
  siteId,
  workerId,
  requisitionId,
  status,
  page = 0,
  size = 20,
  sort,
} = {}) {
  const payload = await req("/deployments", {
    query: { clientId, siteId, workerId, requisitionId, status, page, size, sort },
    fallbackMessage: "Deployments could not be loaded.",
  });
  return normalizeDeploymentPage(payload, { page, size });
}

export function getDeployment(deploymentId) {
  return req(`/deployments/${encodeURIComponent(deploymentId)}`, {
    fallbackMessage: "The deployment details could not be loaded.",
  });
}

export function createDeployment(body) {
  return req("/deployments", {
    method: "POST",
    body,
    fallbackMessage: "The worker could not be posted to the site.",
  });
}

export function transferDeployment(deploymentId, body) {
  return req(`/deployments/${encodeURIComponent(deploymentId)}/transfer`, {
    method: "PATCH",
    body,
    fallbackMessage: "The worker could not be transferred.",
  });
}

/* The backend implements release through the /end endpoint. */
export function endDeployment(deploymentId, body) {
  return req(`/deployments/${encodeURIComponent(deploymentId)}/end`, {
    method: "PATCH",
    body,
    fallbackMessage: "The deployment could not be ended.",
  });
}

/* Actual backend route for a worker's full posting history. */
export async function listWorkerDeploymentHistory(workerId) {
  const payload = await req(`/workers/${encodeURIComponent(workerId)}/deployments`, {
    fallbackMessage: "The worker's deployment history could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

/* Actual backend route for the roster at a site on a date. */
export async function listSiteRoster(siteId, onDate) {
  const payload = await req(`/deployments/at-site/${encodeURIComponent(siteId)}`, {
    query: { onDate },
    fallbackMessage: "The site roster could not be loaded.",
  });
  return Array.isArray(payload) ? payload : [];
}

export const DEPLOYMENT_STATUSES = Object.freeze([
  { value: "ACTIVE", label: "Active", tone: "success" },
  { value: "TRANSFERRED", label: "Transferred", tone: "info" },
  { value: "RELEASED", label: "Released", tone: "warn" },
  { value: "COMPLETED", label: "Completed", tone: "neutral" },
]);

const DEPLOYMENT_STATUS_MAP = new Map(DEPLOYMENT_STATUSES.map((entry) => [entry.value, entry]));

export function deploymentStatusLabel(status) {
  const entry = DEPLOYMENT_STATUS_MAP.get(String(status || "").toUpperCase());
  return entry ? entry.label : status || "—";
}

export function deploymentStatusTone(status) {
  const entry = DEPLOYMENT_STATUS_MAP.get(String(status || "").toUpperCase());
  return entry ? entry.tone : "neutral";
}

export const DEPLOYMENT_SHIFTS = Object.freeze([
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "ROTATIONAL", label: "Rotational" },
]);

export function deploymentShiftLabel(shift) {
  const entry = DEPLOYMENT_SHIFTS.find((item) => item.value === shift);
  return entry ? entry.label : shift || "—";
}

export const SECURITY_CATEGORY_PATTERN = /security|guard|watchman|bouncer/i;

export function isSecurityCategoryName(value) {
  return SECURITY_CATEGORY_PATTERN.test(String(value || ""));
}

export function acceptablePoliceVerification(status) {
  return status === "VERIFIED" || status === "NOT_REQUIRED";
}

export function deploymentCapabilities(sessionOrUser) {
  const canRead =
    hasPermission(sessionOrUser, "DEPLOYMENT_READ") || hasPermission(sessionOrUser, "DEPLOYMENT_MANAGE");
  const canManage = hasPermission(sessionOrUser, "DEPLOYMENT_MANAGE");
  return {
    canRead,
    canManage,
    isClient: isClientRole(sessionOrUser),
  };
}
