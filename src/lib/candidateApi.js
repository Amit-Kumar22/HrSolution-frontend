import { authenticatedFetch, getAuthSession, refreshAuthSession } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export class CandidateApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "CandidateApiError";
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
      return "Some of the details you provided are invalid. Please review and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "We could not find that record.";
    case 409:
      return "That action conflicts with existing data.";
    case 413:
      return "The file is larger than the 10 MB limit.";
    case 415:
      return "Only PDF files are accepted.";
    case 422:
      return "This action is not allowed in the current state.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      break;
  }

  if (status >= 500) return "The service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The request could not be completed (error ${status}).`;
  return "Could not connect to the service. Check your connection and try again.";
}

function codeFromPayload(payload) {
  if (payload && typeof payload === "object" && typeof payload.errorCode === "string") {
    return payload.errorCode;
  }
  return null;
}

async function parseBody(response) {
  const rawBody = await response.text().catch(() => "");
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

async function request(path, init = {}) {
  const { headers, body, signal, ...rest } = init;
  let response;
  try {
    response = await authenticatedFetch(`${API_BASE}${path}`, {
      ...rest,
      body,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(headers || {}),
      },
      signal: signal === undefined ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : signal || undefined,
    });
  } catch (error) {
    if (error && error.status === 401) {
      throw new CandidateApiError("Your session has expired. Please sign in again.", {
        status: 401,
        code: "UNAUTHENTICATED",
      });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new CandidateApiError(
      timedOut
        ? "The request took too long to respond. Please try again."
        : "Could not connect to the service. Check your connection and try again.",
      { status: 0, code: timedOut ? "TIMEOUT" : "NETWORK" },
    );
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    throw new CandidateApiError(messageFromPayload(payload, response.status), {
      status: response.status,
      code: codeFromPayload(payload),
      fields: extractFieldMessages(payload),
      payload,
    });
  }

  return payload;
}

/* ------------------------------------------------------------------ */
/* Candidate profile                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetches the signed-in candidate's profile.
 * Returns `null` when no profile exists yet (HTTP 422 BUSINESS_RULE_VIOLATION).
 */
export async function getCandidateProfile() {
  try {
    return await request("/me/candidate-profile", { method: "GET" });
  } catch (error) {
    if (error instanceof CandidateApiError && error.status === 422) return null;
    throw error;
  }
}

export function updateCandidateProfile(profile) {
  return request("/me/candidate-profile", {
    method: "PUT",
    body: JSON.stringify({
      fullName: profile.fullName,
      phone: profile.phone,
      city: profile.city,
      state: profile.state,
      totalExperienceMonths: profile.totalExperienceMonths,
      highestQualification: profile.highestQualification,
      preferredCategoryId: profile.preferredCategoryId,
      consentGiven: profile.consentGiven,
    }),
  });
}

/* ------------------------------------------------------------------ */
/* Resume upload                                                       */
/* ------------------------------------------------------------------ */

export function validateResumeFile(file) {
  if (!file) return "Please choose a PDF file to upload.";
  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const isPdfType = type === "application/pdf" || type === "application/x-pdf";
  const isPdfName = name.endsWith(".pdf");
  if (!isPdfType && !isPdfName) return "Only PDF files are accepted for your resume.";
  if (typeof file.size === "number" && file.size > MAX_RESUME_BYTES) {
    return "The resume must be 10 MB or smaller.";
  }
  if (typeof file.size === "number" && file.size === 0) {
    return "The selected file is empty. Please choose a valid PDF.";
  }
  return null;
}

/**
 * Uploads (or replaces) the candidate's resume using multipart/form-data with
 * a binary field named `file`. Uses XMLHttpRequest so upload progress is
 * available. Returns the updated profile.
 */
export async function uploadResume(file, { onProgress } = {}) {
  let session = getAuthSession();
  if (!session || !session.accessToken) {
    throw new CandidateApiError("Your session has expired. Please sign in again.", {
      status: 401,
      code: "UNAUTHENTICATED",
    });
  }
  if (session.expiresAt && session.expiresAt - Date.now() < 30000) {
    const refreshed = await refreshAuthSession().catch(() => null);
    if (refreshed) session = refreshed;
  }

  const form = new FormData();
  form.append("file", file, file.name || "resume.pdf");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/me/resume`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `${session.tokenType} ${session.accessToken}`);

    if (xhr.upload && typeof onProgress === "function") {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      const status = xhr.status;
      if (status >= 200 && status < 300) {
        resolve(payload);
        return;
      }
      reject(
        new CandidateApiError(messageFromPayload(payload, status), {
          status,
          code: codeFromPayload(payload),
          fields: extractFieldMessages(payload),
          payload,
        }),
      );
    };

    xhr.onerror = () => {
      reject(
        new CandidateApiError("Could not connect to the service. Check your connection and try again.", {
          status: 0,
          code: "NETWORK",
        }),
      );
    };
    xhr.ontimeout = () => {
      reject(new CandidateApiError("The upload took too long to complete. Please try again.", { status: 0, code: "TIMEOUT" }));
    };

    xhr.send(form);
  });
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export async function listApplications() {
  const payload = await request("/me/applications", { method: "GET" });
  return Array.isArray(payload) ? payload : [];
}

export function getApplication(applicationId) {
  return request(`/me/applications/${encodeURIComponent(applicationId)}`, { method: "GET" });
}

export function applyForJob(jobId, { coverNote, expectedSalary } = {}) {
  const body = {};
  if (typeof coverNote === "string" && coverNote.trim()) body.coverNote = coverNote.trim();
  if (expectedSalary !== null && expectedSalary !== undefined && expectedSalary !== "") {
    const numeric = Number(expectedSalary);
    if (Number.isFinite(numeric)) body.expectedSalary = numeric;
  }
  return request(`/me/applications/jobs/${encodeURIComponent(jobId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function withdrawApplication(applicationId, reason) {
  const body = {};
  if (typeof reason === "string" && reason.trim()) body.reason = reason.trim();
  return request(`/me/applications/${encodeURIComponent(applicationId)}/withdraw`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/* Jobs & reference data                                               */
/* ------------------------------------------------------------------ */

function normalizeJob(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = Number.isFinite(Number(raw.id)) && raw.id !== null && raw.id !== undefined ? Number(raw.id) : null;
  return {
    id,
    slug: raw.slug || null,
    title: raw.title || "Untitled role",
    summary: raw.summary || raw.description || "",
    categoryName: raw.categoryName || "",
    skillLevelLabel: raw.skillLevelLabel || "",
    location: raw.location || "",
    city: raw.city || "",
    state: raw.state || "",
    openings: Number.isFinite(Number(raw.openings)) ? Number(raw.openings) : null,
    salaryRangeLabel: raw.salaryRangeLabel || "",
    experienceLabel: raw.experienceLabel || "",
    shift: raw.shift || "",
    expiresOn: raw.expiresOn || null,
  };
}

/**
 * Lists open vacancies for the candidate portal.
 *
 * Prefers the authenticated jobs feed (which carries the numeric job id needed
 * by POST /me/applications/jobs/{jobId}); falls back to the public careers feed
 * when the candidate's role cannot read the staff feed.
 */
export async function listOpenJobs({ categoryId, city, page = 0, size = 50 } = {}) {
  const params = new URLSearchParams();
  if (categoryId) params.set("categoryId", String(categoryId));
  if (city) params.set("city", city);
  params.set("page", String(page));
  params.set("size", String(size));
  params.set("sort", "createdAt,DESC");

  const authQuery = params.toString();
  try {
    const page1 = await request(`/jobs?${authQuery}`, { method: "GET" });
    const content = page1 && Array.isArray(page1.content) ? page1.content : [];
    return {
      jobs: content.map(normalizeJob).filter(Boolean),
      total: Number.isFinite(Number(page1?.totalElements)) ? Number(page1.totalElements) : content.length,
      source: "authenticated",
    };
  } catch (error) {
    if (!(error instanceof CandidateApiError) || (error.status !== 401 && error.status !== 403)) {
      throw error;
    }
  }

  const publicParams = new URLSearchParams();
  if (categoryId) publicParams.set("categoryId", String(categoryId));
  if (city) publicParams.set("city", city);
  publicParams.set("page", String(page));
  publicParams.set("size", String(size));
  const page2 = await request(`/public/jobs?${publicParams.toString()}`, { method: "GET" });
  const content = page2 && Array.isArray(page2.content) ? page2.content : [];
  return {
    jobs: content.map(normalizeJob).filter(Boolean),
    total: Number.isFinite(Number(page2?.totalElements)) ? Number(page2.totalElements) : content.length,
    source: "public",
  };
}

export function getPublicJob(slug) {
  return request(`/public/jobs/${encodeURIComponent(slug)}`, { method: "GET" });
}

function normalizeCategory(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = Number.isFinite(Number(raw.id)) ? Number(raw.id) : null;
  if (id === null) return null;
  return {
    id,
    name: raw.name || raw.code || `Category ${id}`,
    skillLevelLabel: raw.skillLevelLabel || "",
    active: raw.active === undefined ? true : Boolean(raw.active),
  };
}

/**
 * Loads job categories for the profile form. Any signed-in user may read
 * /manpower-categories; falls back to the public list on 401/403.
 */
export async function listCandidateCategories() {
  try {
    const payload = await request("/manpower-categories", { method: "GET" });
    if (Array.isArray(payload)) return payload.map(normalizeCategory).filter(Boolean);
  } catch (error) {
    if (!(error instanceof CandidateApiError) || (error.status !== 401 && error.status !== 403)) {
      throw error;
    }
  }
  const payload = await request("/public/manpower-categories", { method: "GET" });
  return Array.isArray(payload) ? payload.map(normalizeCategory).filter(Boolean) : [];
}
