import { API_BASE } from "./api-base";

function apiBase() {
  return API_BASE;
}

export class PublicApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "PublicApiError";
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
      if (typeof entry === "string") continue;
      if (entry && typeof entry === "object") {
        const fieldName = entry.field || entry.property || entry.name || entry.fieldName;
        const message = entry.message || entry.detail || entry.defaultMessage || entry.title;
        if (typeof fieldName === "string" && fieldName && typeof message === "string" && message) {
          fields[fieldName] = message;
        }
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

function messageFromPayload(payload, status) {
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

  switch (status) {
    case 400:
      return "Some of the details you provided are invalid. Please review the form and try again.";
    case 401:
      return "Your session is no longer valid. Please refresh the page and try again.";
    case 403:
      return "You do not have permission to access this resource.";
    case 404:
      return "The requested resource was not found.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      break;
  }

  if (status >= 500) return "The service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The request could not be completed (error ${status}).`;
  return "Could not connect to the service. Check your connection and try again.";
}

async function request(path, init = {}) {
  const { headers, body, signal, ...rest } = init;
  const requestHeaders = {
    Accept: "application/json",
    ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
    ...(headers || {}),
  };

  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...rest,
      body,
      headers: requestHeaders,
      signal: signal === undefined ? AbortSignal.timeout(30000) : signal || undefined,
    });
  } catch (error) {
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new PublicApiError(
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
    throw new PublicApiError(messageFromPayload(payload, response.status), {
      status: response.status,
      code: (payload && typeof payload.errorCode === "string" && payload.errorCode) || null,
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function sortByDisplayOrder(items) {
  return [...items].sort(
    (a, b) => (Number(a?.displayOrder) || 0) - (Number(b?.displayOrder) || 0),
  );
}

export function getCompanyProfile(init = {}) {
  return request("/public/company-profile", init);
}

export async function getIndustries(init = {}) {
  return asArray(await request("/public/industries", init));
}

export async function getServices(init = {}) {
  return asArray(await request("/public/services", init));
}

export async function getManpowerCategories(init = {}) {
  return asArray(await request("/public/manpower-categories", init));
}

export async function getTestimonials(init = {}) {
  return asArray(await request("/public/testimonials", init));
}

export function getServiceBySlug(slug, init = {}) {
  return request(`/public/services/${encodeURIComponent(slug)}`, init);
}

function normalizePage(payload, { page = 0, size = 20 } = {}) {
  const content = payload && Array.isArray(payload.content) ? payload.content : [];
  return {
    content,
    page: payload && Number.isFinite(payload.page) ? payload.page : page,
    size: payload && Number.isFinite(payload.size) ? payload.size : size,
    totalElements:
      payload && Number.isFinite(payload.totalElements) ? payload.totalElements : content.length,
    totalPages:
      payload && Number.isFinite(payload.totalPages) ? payload.totalPages : content.length ? 1 : 0,
    first: Boolean(payload && payload.first),
    last: Boolean(payload && payload.last),
    empty: payload && typeof payload.empty === "boolean" ? payload.empty : content.length === 0,
  };
}

export async function listPublicJobs({ categoryId, city, page = 0, size = 12, sort } = {}, init = {}) {
  const params = new URLSearchParams();
  if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
    params.append("categoryId", String(categoryId));
  }
  if (city) params.append("city", String(city));
  params.append("page", String(page));
  params.append("size", String(size));
  if (sort) {
    for (const item of Array.isArray(sort) ? sort : [sort]) params.append("sort", String(item));
  }
  const payload = await request(`/public/jobs?${params.toString()}`, init);
  return normalizePage(payload, { page, size });
}

export function getPublicJobBySlug(slug, init = {}) {
  return request(`/public/jobs/${encodeURIComponent(slug)}`, init);
}

/*
 * The anonymous apply endpoint is multipart: the JSON body travels in a part
 * named "application" (content type application/json) and the CV, when there
 * is one, in a part named "resume". The browser must set the multipart
 * boundary itself, so no Content-Type is passed here - request() only adds one
 * for string bodies.
 */
export function applyForPublicJob(slug, application, resumeFile, init = {}) {
  const form = new FormData();
  form.append("application", new Blob([JSON.stringify(application)], { type: "application/json" }));
  if (resumeFile) form.append("resume", resumeFile, resumeFile.name || "resume.pdf");
  return request(`/public/jobs/${encodeURIComponent(slug)}/apply`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000),
    ...init,
  });
}

export function submitContactMessage(body, init = {}) {
  return request("/public/contact-messages", { method: "POST", body: JSON.stringify(body), ...init });
}

export function submitEnquiry(body, init = {}) {
  return request("/public/enquiries", { method: "POST", body: JSON.stringify(body), ...init });
}

export function resolvePublicFileUrl(storageKey) {
  if (typeof storageKey !== "string") return null;
  const key = storageKey.trim();
  if (!key) return null;
  if (/^https?:\/\//i.test(key) || key.startsWith("/")) return key;
  if (key.startsWith("api/")) return `/${key}`;
  if (key.startsWith("public/files/")) return `${apiBase()}/${key}`;
  const encoded = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${apiBase()}/public/files/${encoded}`;
}

export function toTelHref(phone) {
  if (typeof phone !== "string" || !phone.trim()) return null;
  return `tel:${phone.trim().replace(/[^\d+]/g, "")}`;
}
