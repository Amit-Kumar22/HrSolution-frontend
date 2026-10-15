import { INTERNAL_ROLES, authenticatedFetch, getAuthSession, isClientRole } from "./auth";
import { API_BASE } from "./api-base";

const REQUEST_TIMEOUT_MS = 30000;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = Object.freeze(["image/png", "image/jpeg", "image/jpg", "image/gif"]);

export class AdminApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, payload = null } = {}) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.payload = payload;
  }
}

export function validateImageFile(file) {
  if (!file) return "Please choose an image file.";
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return "Only PNG, JPEG or GIF images are allowed.";
  }
  if (typeof file.size === "number" && file.size > MAX_IMAGE_BYTES) {
    return "The image must be 2 MB or smaller.";
  }
  return null;
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
      return "Some of the details you provided are invalid. Please review the form and try again.";
    case 401:
      return "Your admin session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested item could not be found.";
    case 409:
      return "That change conflicts with existing data. Please review and try again.";
    case 422:
      return "The request could not be completed because it breaks a publishing rule.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      break;
  }

  if (status >= 500) return "The service is temporarily unavailable. Please try again shortly.";
  if (status > 0) return `The request could not be completed (error ${status}).`;
  return "Could not connect to the service. Check your connection and try again.";
}

function requireSession() {
  let session = null;
  try {
    session = getAuthSession();
  } catch {
    session = null;
  }
  if (!session || !session.accessToken) {
    throw new AdminApiError("Your admin session has expired. Please sign in again.", {
      status: 401,
      code: "NO_SESSION",
    });
  }
  return session;
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

async function adminRequest(path, { method = "GET", body, formData, query, signal } = {}) {
  requireSession();
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
      signal: signal === undefined ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : signal || undefined,
    });
  } catch (error) {
    if (error && error.status === 401) {
      throw new AdminApiError("Your admin session has expired. Please sign in again.", {
        status: 401,
        code: "NO_SESSION",
      });
    }
    const timedOut = Boolean(error && (error.name === "TimeoutError" || error.name === "AbortError"));
    throw new AdminApiError(
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
    throw new AdminApiError(messageFromPayload(payload, response.status), {
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

/* ------------------------------------------------------------------ */
/* Industries                                                          */
/* ------------------------------------------------------------------ */

export async function listIndustries(init = {}) {
  return asArray(await adminRequest("/industries", init));
}

export function createIndustry(body, init = {}) {
  return adminRequest("/industries", { method: "POST", body, ...init });
}

export function updateIndustry(id, body, init = {}) {
  return adminRequest(`/industries/${encodeURIComponent(id)}`, { method: "PUT", body, ...init });
}

export function deleteIndustry(id, init = {}) {
  return adminRequest(`/industries/${encodeURIComponent(id)}`, { method: "DELETE", ...init });
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export async function listServices(init = {}) {
  return asArray(await adminRequest("/services", init));
}

export function getService(id, init = {}) {
  return adminRequest(`/services/${encodeURIComponent(id)}`, init);
}

export function createService(body, init = {}) {
  return adminRequest("/services", { method: "POST", body, ...init });
}

export function updateService(id, body, init = {}) {
  return adminRequest(`/services/${encodeURIComponent(id)}`, { method: "PUT", body, ...init });
}

export function deleteService(id, init = {}) {
  return adminRequest(`/services/${encodeURIComponent(id)}`, { method: "DELETE", ...init });
}

export function publishService(id, published, init = {}) {
  return adminRequest(`/services/${encodeURIComponent(id)}/publish`, {
    method: "PATCH",
    query: { published: published ? "true" : "false" },
    ...init,
  });
}

export function uploadServiceHeroImage(id, file, init = {}) {
  const formData = new FormData();
  formData.append("file", file);
  return adminRequest(`/services/${encodeURIComponent(id)}/hero-image`, {
    method: "POST",
    formData,
    signal: null,
    ...init,
  });
}

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

export async function listTestimonials({ page = 0, size = 10, sort = ["displayOrder,asc"] } = {}) {
  const payload = await adminRequest("/testimonials", {
    query: { page, size, sort: asArray(sort) },
  });
  const content = payload && Array.isArray(payload.content) ? payload.content : [];
  return {
    content,
    page: payload && Number.isFinite(payload.page) ? payload.page : page,
    size: payload && Number.isFinite(payload.size) ? payload.size : size,
    totalElements: payload && Number.isFinite(payload.totalElements) ? payload.totalElements : content.length,
    totalPages: payload && Number.isFinite(payload.totalPages) ? payload.totalPages : content.length ? 1 : 0,
    first: Boolean(payload && payload.first),
    last: Boolean(payload && payload.last),
  };
}

export function createTestimonial(body, init = {}) {
  return adminRequest("/testimonials", { method: "POST", body, ...init });
}

export function updateTestimonial(id, body, init = {}) {
  return adminRequest(`/testimonials/${encodeURIComponent(id)}`, { method: "PUT", body, ...init });
}

export function deleteTestimonial(id, init = {}) {
  return adminRequest(`/testimonials/${encodeURIComponent(id)}`, { method: "DELETE", ...init });
}

export function publishTestimonial(id, published, init = {}) {
  return adminRequest(`/testimonials/${encodeURIComponent(id)}/publish`, {
    method: "PATCH",
    query: { published: published ? "true" : "false" },
    ...init,
  });
}

export function uploadTestimonialImage(id, file, { logo = true } = {}, init = {}) {
  const formData = new FormData();
  formData.append("file", file);
  return adminRequest(`/testimonials/${encodeURIComponent(id)}/image`, {
    method: "POST",
    query: { logo: logo ? "true" : "false" },
    formData,
    signal: null,
    ...init,
  });
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function normalizePage(payload, { page = 0, size = 20 } = {}) {
  const content = payload && Array.isArray(payload.content) ? payload.content : [];
  return {
    content,
    page: payload && Number.isFinite(payload.page) ? payload.page : page,
    size: payload && Number.isFinite(payload.size) ? payload.size : size,
    totalElements:
      payload && Number.isFinite(payload.totalElements) ? payload.totalElements : content.length,
    totalPages:
      payload && Number.isFinite(payload.totalPages)
        ? payload.totalPages
        : content.length
          ? 1
          : 0,
    first: Boolean(payload && payload.first),
    last: Boolean(payload && payload.last),
    empty: payload && typeof payload.empty === "boolean" ? payload.empty : content.length === 0,
  };
}

/* ------------------------------------------------------------------ */
/* Contact messages                                                    */
/* ------------------------------------------------------------------ */

export async function listContactMessages({
  search,
  read,
  includeSpam = false,
  page = 0,
  size = 20,
  sort = ["createdAt,DESC"],
} = {}) {
  const payload = await adminRequest("/contact-messages", {
    query: {
      search,
      read: read === undefined || read === null ? undefined : read ? "true" : "false",
      includeSpam: includeSpam ? "true" : "false",
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

export function getContactMessage(id, init = {}) {
  return adminRequest(`/contact-messages/${encodeURIComponent(id)}`, init);
}

export function deleteContactMessage(id, init = {}) {
  return adminRequest(`/contact-messages/${encodeURIComponent(id)}`, { method: "DELETE", ...init });
}

export function setContactMessageRead(id, read, init = {}) {
  return adminRequest(`/contact-messages/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    query: { read: read ? "true" : "false" },
    ...init,
  });
}

export function markContactMessageReplied(id, init = {}) {
  return adminRequest(`/contact-messages/${encodeURIComponent(id)}/replied`, {
    method: "PATCH",
    ...init,
  });
}

export function setContactMessageSpam(id, spam, init = {}) {
  return adminRequest(`/contact-messages/${encodeURIComponent(id)}/spam`, {
    method: "PATCH",
    query: { spam: spam ? "true" : "false" },
    ...init,
  });
}

export async function getUnreadContactCount({ includeSpam = false } = {}) {
  const payload = await adminRequest("/contact-messages/unread-count", {
    query: { includeSpam: includeSpam ? "true" : "false" },
  });
  return payload && Number.isFinite(payload.unread) ? payload.unread : 0;
}

/* ------------------------------------------------------------------ */
/* Enquiries                                                           */
/* ------------------------------------------------------------------ */

export async function listEnquiries({
  search,
  status,
  categoryId,
  assignedToUserId,
  from,
  to,
  includeSpam = false,
  page = 0,
  size = 20,
  sort = ["createdAt,DESC"],
} = {}) {
  const payload = await adminRequest("/enquiries", {
    query: {
      search,
      status,
      categoryId,
      assignedToUserId,
      from,
      to,
      includeSpam: includeSpam ? "true" : "false",
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

export function getEnquiry(id, init = {}) {
  return adminRequest(`/enquiries/${encodeURIComponent(id)}`, init);
}

export function deleteEnquiry(id, init = {}) {
  return adminRequest(`/enquiries/${encodeURIComponent(id)}`, { method: "DELETE", ...init });
}

export function assignEnquiry(id, assignedToUserId, note, init = {}) {
  return adminRequest(`/enquiries/${encodeURIComponent(id)}/assign`, {
    method: "PATCH",
    body: {
      assignedToUserId:
        assignedToUserId === undefined || assignedToUserId === null || assignedToUserId === ""
          ? null
          : Number(assignedToUserId),
      note: note && note.trim() ? note.trim() : undefined,
    },
    ...init,
  });
}

export function updateEnquiryStatus(id, status, note, init = {}) {
  return adminRequest(`/enquiries/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status, note: note && note.trim() ? note.trim() : undefined },
    ...init,
  });
}

/* ------------------------------------------------------------------ */
/* Clients (staff management)                                          */
/* ------------------------------------------------------------------ */

function currentSessionRole() {
  try {
    return getAuthSession();
  } catch {
    return null;
  }
}

export async function listClients({
  search,
  status,
  stateCode,
  clientId,
  page = 0,
  size = 10,
  sort = ["legalName,ASC"],
} = {}) {
  let effectiveClientId = clientId;
  const session = currentSessionRole();
  if (session && isClientRole(session)) {
    effectiveClientId = undefined;
  }
  const payload = await adminRequest("/clients", {
    query: {
      search,
      status,
      stateCode,
      clientId: effectiveClientId,
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

export function getClient(id, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(id)}`, init);
}

export function getClientDetail(id, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(id)}/detail`, init);
}

export function updateClient(id, body, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(id)}`, { method: "PUT", body, ...init });
}

export function createClient(body, init = {}) {
  return adminRequest("/clients", { method: "POST", body, ...init });
}

export function changeClientStatus(id, status, reason, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: {
      status,
      reason: reason && reason.trim() ? reason.trim() : undefined,
    },
    ...init,
  });
}

export function deleteClient(id, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(id)}`, { method: "DELETE", ...init });
}

export async function listClientSites(clientId, init = {}) {
  return asArray(await adminRequest(`/clients/${encodeURIComponent(clientId)}/sites`, init));
}

export function getSite(siteId, init = {}) {
  return adminRequest(`/sites/${encodeURIComponent(siteId)}`, init);
}

export function createClientSite(clientId, body, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/sites`, { method: "POST", body, ...init });
}

export function updateSite(siteId, body, init = {}) {
  return adminRequest(`/sites/${encodeURIComponent(siteId)}`, { method: "PUT", body, ...init });
}

export function setSiteActive(siteId, active, init = {}) {
  return adminRequest(`/sites/${encodeURIComponent(siteId)}/active`, {
    method: "PATCH",
    query: { active: active ? "true" : "false" },
    ...init,
  });
}

export function deleteSite(siteId, init = {}) {
  return adminRequest(`/sites/${encodeURIComponent(siteId)}`, { method: "DELETE", ...init });
}

export async function listClientUsers(clientId, init = {}) {
  return asArray(await adminRequest(`/clients/${encodeURIComponent(clientId)}/users`, init));
}

export function linkClientUser(clientId, { userId, designation, primaryContact = false } = {}, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/users`, {
    method: "POST",
    body: {
      userId: Number(userId),
      designation: designation && designation.trim() ? designation.trim() : undefined,
      primaryContact: Boolean(primaryContact),
    },
    ...init,
  });
}

export function setClientUserActive(clientId, clientUserId, active, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/users/${encodeURIComponent(clientUserId)}/active`, {
    method: "PATCH",
    query: { active: active ? "true" : "false" },
    ...init,
  });
}

export function setClientUserPrimaryContact(clientId, clientUserId, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/users/${encodeURIComponent(clientUserId)}/primary-contact`, {
    method: "PATCH",
    ...init,
  });
}

export function approveClientRegistration(userId, body, init = {}) {
  return adminRequest(`/clients/approve-registration/${encodeURIComponent(userId)}`, {
    method: "POST",
    body,
    ...init,
  });
}

export function rejectClientRegistration(userId, reason, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}/reject-client`, {
    method: "PATCH",
    query: { reason: reason && reason.trim() ? reason.trim() : undefined },
    ...init,
  });
}

export async function listPendingClientRegistrations({ search, page = 0, size = 10, sort = ["createdAt,DESC"] } = {}) {
  const payload = await adminRequest("/users", {
    query: {
      status: "PENDING_APPROVAL",
      role: "CLIENT",
      search,
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

/* ------------------------------------------------------------------ */
/* Assignment / category lookups                                       */
/* ------------------------------------------------------------------ */

export async function listUsers({ search, status, role, page = 0, size = 100, sort } = {}) {
  const payload = await adminRequest("/users", {
    query: { search, status, role, page, size, sort: sort ? asArray(sort) : undefined },
  });
  return normalizePage(payload, { page, size });
}

/* ------------------------------------------------------------------ */
/* Accounts & access management (Super Admin)                          */
/* ------------------------------------------------------------------ */

export async function listAccounts({
  search,
  status,
  role,
  page = 0,
  size = 20,
  sort = ["createdAt,DESC"],
} = {}) {
  const payload = await adminRequest("/users", {
    query: { search, status, role, page, size, sort: asArray(sort) },
  });
  return normalizePage(payload, { page, size });
}

export function getAccount(userId, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}`, init);
}

export function createAccount(body, init = {}) {
  return adminRequest("/users", { method: "POST", body, ...init });
}

export function updateAccount(userId, body, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}`, { method: "PUT", body, ...init });
}

export function assignAccountRoles(userId, roles, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}/roles`, {
    method: "PUT",
    body: { roles: asArray(roles) },
    ...init,
  });
}

export function enableAccount(userId, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}/enable`, { method: "PATCH", ...init });
}

export function disableAccount(userId, reason, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}/disable`, {
    method: "PATCH",
    body: { reason: reason && reason.trim() ? reason.trim() : undefined },
    ...init,
  });
}

export function unlockAccount(userId, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}/unlock`, { method: "PATCH", ...init });
}

export function approveAccountClient(userId, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}/approve-client`, { method: "PATCH", ...init });
}

export function rejectAccountClient(userId, reason, init = {}) {
  return adminRequest(`/users/${encodeURIComponent(userId)}/reject-client`, {
    method: "PATCH",
    query: { reason: reason && reason.trim() ? reason.trim() : undefined },
    ...init,
  });
}

export async function listRoles(init = {}) {
  return asArray(await adminRequest("/roles", init));
}

export function getRole(roleId, init = {}) {
  return adminRequest(`/roles/${encodeURIComponent(roleId)}`, init);
}

export async function listPermissions(init = {}) {
  return asArray(await adminRequest("/roles/permissions", init));
}

export function updateRolePermissions(roleId, permissions, init = {}) {
  return adminRequest(`/roles/${encodeURIComponent(roleId)}/permissions`, {
    method: "PUT",
    body: { permissions: asArray(permissions) },
    ...init,
  });
}

export function checkMyPermissions(init = {}) {
  return adminRequest("/users/permissions-check", init);
}

/* ------------------------------------------------------------------ */
/* Manpower categories & skills                                        */
/* ------------------------------------------------------------------ */

export async function listManpowerCategories(init = {}) {
  return asArray(await adminRequest("/manpower-categories", init));
}

export function getManpowerCategory(id, init = {}) {
  return adminRequest(`/manpower-categories/${encodeURIComponent(id)}`, init);
}

export function createManpowerCategory(body, init = {}) {
  return adminRequest("/manpower-categories", { method: "POST", body, ...init });
}

export function updateManpowerCategory(id, body, init = {}) {
  return adminRequest(`/manpower-categories/${encodeURIComponent(id)}`, { method: "PUT", body, ...init });
}

export function activateManpowerCategory(id, init = {}) {
  return adminRequest(`/manpower-categories/${encodeURIComponent(id)}/activate`, { method: "PATCH", ...init });
}

export function deactivateManpowerCategory(id, init = {}) {
  return adminRequest(`/manpower-categories/${encodeURIComponent(id)}/deactivate`, { method: "PATCH", ...init });
}

export async function listManpowerCategorySkills(categoryId, init = {}) {
  return asArray(await adminRequest(`/manpower-categories/${encodeURIComponent(categoryId)}/skills`, init));
}

export function replaceManpowerCategorySkills(categoryId, skillIds, init = {}) {
  return adminRequest(`/manpower-categories/${encodeURIComponent(categoryId)}/skills`, {
    method: "PUT",
    body: { skillIds },
    ...init,
  });
}

export async function listSkills({ includeInactive = false } = {}) {
  return asArray(await adminRequest("/skills", { query: { includeInactive: includeInactive ? "true" : "false" } }));
}

export function getSkill(id, init = {}) {
  return adminRequest(`/skills/${encodeURIComponent(id)}`, init);
}

export function createSkill(body, init = {}) {
  return adminRequest("/skills", { method: "POST", body, ...init });
}

export function updateSkill(id, body, init = {}) {
  return adminRequest(`/skills/${encodeURIComponent(id)}`, { method: "PUT", body, ...init });
}

export function setSkillActive(id, active, init = {}) {
  return adminRequest(`/skills/${encodeURIComponent(id)}/active`, {
    method: "PATCH",
    query: { active: active ? "true" : "false" },
    ...init,
  });
}

/* ------------------------------------------------------------------ */
/* Rate cards                                                          */
/* ------------------------------------------------------------------ */

export async function listClientRateCards(clientId, init = {}) {
  return asArray(await adminRequest(`/clients/${encodeURIComponent(clientId)}/rate-cards`, init));
}

export function createClientRateCard(clientId, body, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/rate-cards`, { method: "POST", body, ...init });
}

export function resolveClientRateCard(clientId, { categoryId, siteId, onDate } = {}, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/rate-cards/resolve`, {
    query: {
      categoryId,
      siteId: siteId == null || siteId === "" ? undefined : siteId,
      onDate,
    },
    ...init,
  });
}

export function getRateCard(rateCardId, init = {}) {
  return adminRequest(`/rate-cards/${encodeURIComponent(rateCardId)}`, init);
}

export function updateRateCard(rateCardId, body, init = {}) {
  return adminRequest(`/rate-cards/${encodeURIComponent(rateCardId)}`, { method: "PUT", body, ...init });
}

export function deleteRateCard(rateCardId, init = {}) {
  return adminRequest(`/rate-cards/${encodeURIComponent(rateCardId)}`, { method: "DELETE", ...init });
}

/* ------------------------------------------------------------------ */
/* Client contracts                                                    */
/* ------------------------------------------------------------------ */

export async function listClientContracts(clientId, init = {}) {
  return asArray(await adminRequest(`/clients/${encodeURIComponent(clientId)}/contracts`, init));
}

export function createClientContract(clientId, body, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/contracts`, { method: "POST", body, ...init });
}

export function getClientContractInForce(clientId, onDate, init = {}) {
  return adminRequest(`/clients/${encodeURIComponent(clientId)}/contracts/in-force`, {
    query: { onDate: onDate || undefined },
    ...init,
  });
}

export function getContract(contractId, init = {}) {
  return adminRequest(`/contracts/${encodeURIComponent(contractId)}`, init);
}

export function updateContract(contractId, body, init = {}) {
  return adminRequest(`/contracts/${encodeURIComponent(contractId)}`, { method: "PUT", body, ...init });
}

export function activateContract(contractId, init = {}) {
  return adminRequest(`/contracts/${encodeURIComponent(contractId)}/activate`, { method: "PATCH", ...init });
}

export function terminateContract(contractId, body, init = {}) {
  return adminRequest(`/contracts/${encodeURIComponent(contractId)}/terminate`, { method: "PATCH", body, ...init });
}

export function deleteContract(contractId, init = {}) {
  return adminRequest(`/contracts/${encodeURIComponent(contractId)}`, { method: "DELETE", ...init });
}

export function uploadContractDocument(contractId, file, init = {}) {
  const formData = new FormData();
  formData.append("file", file);
  return adminRequest(`/contracts/${encodeURIComponent(contractId)}/document`, {
    method: "POST",
    formData,
    ...init,
  });
}

/* ------------------------------------------------------------------ */
/* Candidates (staff management)                                       */
/* ------------------------------------------------------------------ */

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export const CANDIDATE_SOURCES = Object.freeze([
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "AGENCY", label: "Agency" },
  { value: "CAMPUS", label: "Campus" },
  { value: "OTHER", label: "Other" },
]);

export function candidateSourceLabel(source) {
  const match = CANDIDATE_SOURCES.find((entry) => entry.value === source);
  return match ? match.label : source || "—";
}

export function validateResumeFile(file) {
  if (!file) return "Please choose a PDF file to upload.";
  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const isPdfType = type === "application/pdf" || type === "application/x-pdf";
  const isPdfName = name.endsWith(".pdf");
  if (type && !isPdfType) return "Only PDF files are accepted. A renamed non-PDF will be rejected.";
  if (!type && !isPdfName) return "Only PDF files are accepted.";
  if (typeof file.size === "number" && file.size > MAX_RESUME_BYTES) {
    return "The resume must be 10 MB or smaller.";
  }
  if (typeof file.size === "number" && file.size === 0) {
    return "The selected file is empty. Please choose a valid PDF.";
  }
  return null;
}

export async function listCandidates({
  search,
  preferredCategoryId,
  source,
  hasLogin,
  includeSpam = false,
  page = 0,
  size = 20,
  sort = ["createdAt,DESC"],
} = {}) {
  const payload = await adminRequest("/candidates", {
    query: {
      search,
      preferredCategoryId,
      source,
      hasLogin: hasLogin === undefined || hasLogin === null || hasLogin === "" ? undefined : hasLogin ? "true" : "false",
      includeSpam: includeSpam ? "true" : "false",
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

export function getCandidate(candidateId, init = {}) {
  return adminRequest(`/candidates/${encodeURIComponent(candidateId)}`, init);
}

export function createCandidate(body, init = {}) {
  return adminRequest("/candidates", { method: "POST", body, ...init });
}

export function updateCandidate(candidateId, body, init = {}) {
  return adminRequest(`/candidates/${encodeURIComponent(candidateId)}`, { method: "PUT", body, ...init });
}

export function deleteCandidate(candidateId, init = {}) {
  return adminRequest(`/candidates/${encodeURIComponent(candidateId)}`, { method: "DELETE", ...init });
}

export function setCandidateSpam(candidateId, spam, init = {}) {
  return adminRequest(`/candidates/${encodeURIComponent(candidateId)}/spam`, {
    method: "PATCH",
    query: { spam: spam ? "true" : "false" },
    ...init,
  });
}

export function uploadCandidateResume(candidateId, file, init = {}) {
  const formData = new FormData();
  formData.append("file", file);
  return adminRequest(`/candidates/${encodeURIComponent(candidateId)}/resume`, {
    method: "POST",
    formData,
    signal: null,
    ...init,
  });
}

/* Applications belonging to a candidate (staff view) */
export async function listApplications({
  jobId,
  candidateId,
  status,
  assignedToUserId,
  unassigned,
  from,
  to,
  search,
  page = 0,
  size = 20,
  sort = ["appliedOn,DESC"],
} = {}) {
  const payload = await adminRequest("/applications", {
    query: {
      jobId,
      candidateId,
      status,
      assignedToUserId,
      unassigned: unassigned === undefined || unassigned === null || unassigned === "" ? undefined : unassigned ? "true" : "false",
      from,
      to,
      search,
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

/* ------------------------------------------------------------------ */
/* Interviews                                                          */
/* ------------------------------------------------------------------ */

export const INTERVIEW_MODES = Object.freeze([
  { value: "IN_PERSON", label: "In person" },
  { value: "VIDEO", label: "Video call" },
  { value: "PHONE", label: "Phone" },
]);

export const INTERVIEW_RESULTS = Object.freeze(["PENDING", "PASS", "FAIL", "NO_SHOW"]);

export const FINAL_INTERVIEW_RESULTS = Object.freeze(["PASS", "FAIL", "NO_SHOW"]);

export function interviewModeLabel(mode) {
  const match = INTERVIEW_MODES.find((entry) => entry.value === mode);
  return match ? match.label : mode || "—";
}

export function interviewResultLabel(result) {
  switch (result) {
    case "PASS":
      return "Passed";
    case "FAIL":
      return "Failed";
    case "NO_SHOW":
      return "No show";
    case "PENDING":
      return "Pending";
    default:
      return result || "—";
  }
}

export async function listInterviews({
  interviewerUserId,
  result,
  from,
  to,
  awaitingFeedback,
  page = 0,
  size = 20,
  sort = ["scheduledAt,ASC"],
} = {}) {
  const payload = await adminRequest("/interviews", {
    query: {
      interviewerUserId:
        interviewerUserId === undefined || interviewerUserId === null || interviewerUserId === ""
          ? undefined
          : interviewerUserId,
      result,
      from,
      to,
      awaitingFeedback:
        awaitingFeedback === undefined || awaitingFeedback === null
          ? undefined
          : awaitingFeedback
            ? "true"
            : "false",
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

export function getInterview(interviewId, init = {}) {
  return adminRequest(`/interviews/${encodeURIComponent(interviewId)}`, init);
}

export async function listApplicationInterviews(applicationId, init = {}) {
  return asArray(await adminRequest(`/applications/${encodeURIComponent(applicationId)}/interviews`, init));
}

export function scheduleInterview(applicationId, body, init = {}) {
  return adminRequest(`/applications/${encodeURIComponent(applicationId)}/interviews`, {
    method: "POST",
    body,
    ...init,
  });
}

export function updateInterview(interviewId, body, init = {}) {
  return adminRequest(`/interviews/${encodeURIComponent(interviewId)}`, {
    method: "PUT",
    body,
    ...init,
  });
}

export function cancelInterview(interviewId, init = {}) {
  return adminRequest(`/interviews/${encodeURIComponent(interviewId)}`, {
    method: "DELETE",
    ...init,
  });
}

export function recordInterviewResult(interviewId, body, init = {}) {
  return adminRequest(`/interviews/${encodeURIComponent(interviewId)}/result`, {
    method: "PATCH",
    body,
    ...init,
  });
}

export function getApplication(applicationId, init = {}) {
  return adminRequest(`/applications/${encodeURIComponent(applicationId)}`, init);
}

export function getApplicationDetail(applicationId, init = {}) {
  return adminRequest(`/applications/${encodeURIComponent(applicationId)}/detail`, init);
}

export async function listEligibleStaff() {
  const page = await listUsers({ status: "ACTIVE", size: 200, sort: ["fullName,ASC"] });
  const internal = new Set(INTERNAL_ROLES);
  return page.content.filter(
    (user) => Array.isArray(user.roles) && user.roles.some((role) => internal.has(role)),
  );
}

export function listEligibleInterviewers() {
  return listEligibleStaff();
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

export const JOB_STATUSES = Object.freeze([
  { value: "DRAFT", label: "Draft", tone: "neutral" },
  { value: "OPEN", label: "Open", tone: "success" },
  { value: "ON_HOLD", label: "On hold", tone: "warn" },
  { value: "CLOSED", label: "Closed", tone: "danger" },
  { value: "FILLED", label: "Filled", tone: "accent" },
]);

export const JOB_STATUS_VALUES = Object.freeze(JOB_STATUSES.map((entry) => entry.value));

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

const JOB_STATUS_MAP = new Map(JOB_STATUSES.map((entry) => [entry.value, entry]));

export function jobStatusLabel(status) {
  const match = JOB_STATUS_MAP.get(status);
  return match ? match.label : status || "—";
}

export function jobStatusTone(status) {
  const match = JOB_STATUS_MAP.get(status);
  return match ? match.tone : "neutral";
}

export function jobShiftLabel(shift) {
  const match = SHIFT_OPTIONS.find((entry) => entry.value === shift);
  return match ? match.label : shift || "—";
}

export function jobSkillLevelLabel(skillLevel) {
  const match = SKILL_LEVELS.find((entry) => entry.value === skillLevel);
  return match ? match.label : skillLevel || "—";
}

export async function listJobs({
  search,
  status,
  categoryId,
  clientId,
  page = 0,
  size = 20,
  sort = ["createdAt,DESC"],
} = {}) {
  const payload = await adminRequest("/jobs", {
    query: {
      search,
      status,
      categoryId: categoryId === undefined || categoryId === null || categoryId === "" ? undefined : categoryId,
      clientId: clientId === undefined || clientId === null || clientId === "" ? undefined : clientId,
      page,
      size,
      sort: asArray(sort),
    },
  });
  return normalizePage(payload, { page, size });
}

export function getJob(jobId, init = {}) {
  return adminRequest(`/jobs/${encodeURIComponent(jobId)}`, init);
}

export function createJob(body, init = {}) {
  return adminRequest("/jobs", { method: "POST", body, ...init });
}

export function updateJob(jobId, body, init = {}) {
  return adminRequest(`/jobs/${encodeURIComponent(jobId)}`, { method: "PUT", body, ...init });
}

export function deleteJob(jobId, init = {}) {
  return adminRequest(`/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE", ...init });
}

export function changeJobStatus(jobId, { status, reason }, init = {}) {
  return adminRequest(`/jobs/${encodeURIComponent(jobId)}/status`, {
    method: "PATCH",
    body: { status, reason },
    ...init,
  });
}

export function recordJobApplication(jobId, body, init = {}) {
  return adminRequest(`/jobs/${encodeURIComponent(jobId)}/applications`, {
    method: "POST",
    body,
    ...init,
  });
}

export function getJobPipeline(jobId, init = {}) {
  return adminRequest(`/jobs/${encodeURIComponent(jobId)}/pipeline`, init);
}

export const APPLICATION_STATUSES = Object.freeze([
  { value: "APPLIED", label: "Applied", tone: "info" },
  { value: "SCREENING", label: "Screening", tone: "info" },
  { value: "SHORTLISTED", label: "Shortlisted", tone: "accent" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview scheduled", tone: "accent" },
  { value: "SELECTED", label: "Selected", tone: "success" },
  { value: "OFFERED", label: "Offered", tone: "success" },
  { value: "JOINED", label: "Joined", tone: "success" },
  { value: "REJECTED", label: "Rejected", tone: "danger" },
  { value: "ON_HOLD", label: "On hold", tone: "warn" },
  { value: "WITHDRAWN", label: "Withdrawn", tone: "neutral" },
]);

const APPLICATION_STATUS_MAP = new Map(APPLICATION_STATUSES.map((entry) => [entry.value, entry]));

export function applicationStatusLabel(status) {
  const match = APPLICATION_STATUS_MAP.get(status);
  return match ? match.label : status || "—";
}

export function applicationStatusTone(status) {
  const match = APPLICATION_STATUS_MAP.get(status);
  return match ? match.tone : "neutral";
}

/* ------------------------------------------------------------------ */
/* Company settings                                                    */
/* ------------------------------------------------------------------ */

/** The single company profile row. Readable by any signed-in user. */
export function getCompanySettings(init = {}) {
  return adminRequest("/settings/company", init);
}

/**
 * Full replacement of the company profile. Send every editable field: the
 * backend clears anything omitted. The logo is managed by its own endpoint
 * and must not be sent here.
 */
export function updateCompanySettings(body, init = {}) {
  return adminRequest("/settings/company", { method: "PUT", body, ...init });
}

/** Replaces the company logo. PNG, JPEG or GIF up to 2 MB. */
export function uploadCompanyLogo(file, init = {}) {
  const formData = new FormData();
  formData.append("file", file);
  return adminRequest("/settings/company/logo", {
    method: "POST",
    formData,
    signal: null,
    ...init,
  });
}

/* Downloads a document (e.g. a candidate resume) as a binary blob. */
export async function fetchDocumentBlob(documentId, init = {}) {
  requireSession();
  let response;
  try {
    response = await authenticatedFetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}/download`, {
      method: "GET",
      ...init,
    });
  } catch (error) {
    if (error && error.status === 401) {
      throw new AdminApiError("Your session has expired. Please sign in again.", { status: 401, code: "NO_SESSION" });
    }
    throw new AdminApiError("Could not connect to the service. Check your connection and try again.", {
      status: 0,
      code: "NETWORK",
    });
  }

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    let payload = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = null;
      }
    }
    throw new AdminApiError(messageFromPayload(payload, response.status), { status: response.status, payload });
  }

  const blob = await response.blob();
  const contentType = response.headers.get("content-type") || blob.type || "application/octet-stream";
  const disposition = response.headers.get("content-disposition") || "";
  let filename = "";
  const starMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition);
  if (starMatch) {
    try {
      filename = decodeURIComponent(starMatch[1]);
    } catch {
      filename = starMatch[1];
    }
  } else if (plainMatch) {
    filename = plainMatch[1];
  }
  return { blob, filename: filename.trim(), contentType };
}
