const AUTH_STORAGE_KEY = "shakti-auth-session";
const AUTH_HINT_KEY = "shakti-auth-hint";
const AUTH_SESSION_EVENT = "shakti-auth-session-change";

export const AUTH_SESSION_LOADING = "__shakti_auth_session_loading__";
export const AUTH_SESSION_ERROR = Object.freeze({ error: "Could not read the sign-in session from this browser." });

export const INTERNAL_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "HR",
  "RECRUITER",
  "OPERATIONS",
  "OPERATOR",
  "ACCOUNTS",
  "SUPERVISOR",
]);
export const CLIENT_ROLES = Object.freeze(["CLIENT"]);
export const CANDIDATE_ROLES = Object.freeze(["CANDIDATE", "WORKER"]);

let cachedSessionStorageValue;
let cachedAuthSession = null;
let cachedAuthReady = false;

let authReady = typeof window === "undefined";
let initPromise = null;
let refreshPromise = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function notifyAuthSessionChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

function readStoredSession() {
  if (!isBrowser()) return null;
  try {
    const rawSession = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) return null;
    return parseAuthSession(rawSession);
  } catch {
    return null;
  }
}

function rememberSessionHint() {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(AUTH_HINT_KEY, "1");
  } catch {
    // A missing hint only means we may not attempt cookie-based restore automatically.
  }
}

function forgetSessionHint() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

function hasSessionHint() {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(AUTH_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function resolveExpiresAt(payload) {
  if (payload && typeof payload.expiresAt === "string") {
    const parsed = Date.parse(payload.expiresAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  const seconds = payload ? Number(payload.expiresIn) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Date.now() + seconds * 1000;
  return NaN;
}

function roleList(user) {
  return user && Array.isArray(user.roles) ? user.roles.filter((role) => typeof role === "string") : [];
}

function buildSession(payload, fallbackUser = null) {
  if (!payload || typeof payload.accessToken !== "string" || !payload.accessToken) return null;

  const expiresAt = resolveExpiresAt(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const user = payload.user && typeof payload.user === "object" ? payload.user : fallbackUser;
  if (!user || typeof user !== "object") return null;

  return {
    accessToken: payload.accessToken,
    tokenType:
      typeof payload.tokenType === "string" && payload.tokenType ? payload.tokenType : "Bearer",
    expiresAt,
    user: { ...user, roles: roleList(user) },
  };
}

function saveSession(session) {
  if (!isBrowser() || !session) return;
  try {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    rememberSessionHint();
    notifyAuthSessionChange();
  } catch {
    throw new Error("Could not save the sign-in session in this browser.");
  }
}

function applyUser(user) {
  const existing = readStoredSession();
  if (!existing || !user || typeof user !== "object") return existing;
  const next = { ...existing, user: { ...user, roles: roleList(user) } };
  saveSession(next);
  return next;
}

export function subscribeToAuthSession(callback) {
  if (!isBrowser()) return () => {};
  window.addEventListener(AUTH_SESSION_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getServerAuthSnapshot() {
  return AUTH_SESSION_LOADING;
}

export function getAuthSessionSnapshot() {
  if (!isBrowser()) return AUTH_SESSION_LOADING;
  if (!authReady) return AUTH_SESSION_LOADING;
  try {
    const rawSession = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (rawSession === cachedSessionStorageValue && cachedAuthReady === authReady) {
      return cachedAuthSession;
    }
    cachedSessionStorageValue = rawSession;
    cachedAuthReady = authReady;
    cachedAuthSession = rawSession ? parseAuthSession(rawSession) : null;
    return cachedAuthSession;
  } catch {
    return AUTH_SESSION_ERROR;
  }
}

async function readResponse(response) {
  const rawBody = await response.text();
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    if (response.ok) {
      throw new Error("The authentication service returned an unreadable response.");
    }
    throw new Error(`Authentication request failed (${response.status}).`);
  }
}

function getErrorMessage(payload, status, action = "login") {
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.errors)) {
      const fieldMessages = payload.errors
        .map((entry) => {
          if (typeof entry === "string") return entry.trim();
          if (entry && typeof entry.message === "string") return entry.message.trim();
          return "";
        })
        .filter(Boolean);
      if (fieldMessages.length) return fieldMessages.join(" ");
    }
    for (const key of ["detail", "message", "error", "title"]) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  if (status === 401) {
    if (action === "change-password") return "Your session has expired or is no longer valid. Please sign in again.";
    if (action === "forgot-password") return "The request could not be completed. Please try again.";
    return action === "logout"
      ? "Your session has expired or is no longer valid. Please sign in again."
      : "Invalid email or password.";
  }
  if (status === 403) {
    if (action === "login") {
      return "Your account is not active yet. Verify your email address or wait for administrator approval.";
    }
    return "You do not have permission to access this resource.";
  }
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "The authentication service is temporarily unavailable. Please try again shortly.";
  return `Authentication request failed (${status}).`;
}

function createRequestError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/* ------------------------------------------------------------------ */
/* Initialisation & token refresh                                      */
/* ------------------------------------------------------------------ */

async function requestCurrentUser(session) {
  return fetch("/api/v1/auth/me", {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      Authorization: `${session.tokenType} ${session.accessToken}`,
    },
  });
}

async function hydrateFromServer() {
  const stored = readStoredSession();
  if (!stored) return null;

  let response;
  try {
    response = await requestCurrentUser(stored);
  } catch {
    return stored;
  }

  if (response.ok) {
    const payload = await readResponse(response).catch(() => null);
    if (payload && typeof payload === "object") return applyUser(payload);
    return stored;
  }

  if (response.status === 401) {
    return refreshAuthSession();
  }

  return stored;
}

export function initializeAuthSession() {
  if (!isBrowser()) {
    authReady = true;
    return Promise.resolve(null);
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const stored = readStoredSession();
      if (stored && stored.expiresAt > Date.now()) {
        await hydrateFromServer();
      } else if (stored || hasSessionHint()) {
        await refreshAuthSession();
      }
    } catch {
      // A failed restore leaves the visitor unauthenticated.
    } finally {
      authReady = true;
      notifyAuthSessionChange();
    }
    return readStoredSession();
  })();

  return initPromise;
}

export function refreshAuthSession() {
  if (!isBrowser()) return Promise.resolve(null);
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    let response;
    try {
      response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
    } catch {
      return null;
    }

    if (!response.ok) {
      if (response.status === 401) clearAuthSession({ silent: true });
      return null;
    }

    const payload = await readResponse(response).catch(() => null);
    const session = buildSession(payload, readStoredSession()?.user);
    if (!session) return null;

    saveSession(session);
    return session;
  })();

  refreshPromise = refreshPromise.finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export function getAuthSession() {
  return readStoredSession();
}

function parseAuthSession(rawSession) {
  let session;
  try {
    session = JSON.parse(rawSession);
  } catch {
    if (isBrowser()) window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  if (
    typeof session.accessToken !== "string" ||
    !session.accessToken ||
    typeof session.tokenType !== "string" ||
    !Number.isFinite(session.expiresAt) ||
    session.expiresAt <= Date.now() ||
    !session.user ||
    typeof session.user !== "object"
  ) {
    if (isBrowser()) window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  return { ...session, user: { ...session.user, roles: roleList(session.user) } };
}

export function clearAuthSession({ silent = false } = {}) {
  try {
    if (isBrowser()) {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      forgetSessionHint();
      cachedSessionStorageValue = undefined;
      cachedAuthSession = null;
      notifyAuthSessionChange();
    }
  } catch {
    if (!silent) {
      throw new Error("The sign-out completed, but this browser could not clear the saved session.");
    }
  }
}

export function expireAuthSession(accessToken) {
  if (!isBrowser()) return;
  let rawSession;
  try {
    rawSession = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) return;

    const session = JSON.parse(rawSession);
    if (session.accessToken === accessToken && session.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      forgetSessionHint();
      notifyAuthSessionChange();
    }
  } catch {
    throw new Error("Could not clear the expired sign-in session from this browser.");
  }
}

/* ------------------------------------------------------------------ */
/* Authenticated fetch helper (shared refresh)                         */
/* ------------------------------------------------------------------ */

function withAuthorization(init, session) {
  return {
    ...init,
    credentials: init.credentials || "include",
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
      Authorization: `${session.tokenType} ${session.accessToken}`,
    },
  };
}

export async function authenticatedFetch(path, init = {}) {
  let session = readStoredSession();
  if (!session || !session.accessToken) {
    throw createRequestError("Your session has expired. Please sign in again.", 401);
  }

  if (session.expiresAt - Date.now() < 15000) {
    const refreshed = await refreshAuthSession();
    if (refreshed) session = refreshed;
  }

  const response = await fetch(path, withAuthorization(init, session));

  if (response.status !== 401) return response;

  const refreshed = await refreshAuthSession();
  if (!refreshed) {
    clearAuthSession({ silent: true });
    return response;
  }

  return fetch(path, withAuthorization(init, refreshed));
}

export async function fetchCurrentUser() {
  const response = await authenticatedFetch("/api/v1/auth/me", { method: "GET" });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw createRequestError(getErrorMessage(payload, response.status, "session"), response.status);
  }
  return payload;
}

/* ------------------------------------------------------------------ */
/* Authentication actions                                              */
/* ------------------------------------------------------------------ */

export async function login(email, password, rememberMe) {
  let response;

  try {
    response = await fetch("/api/v1/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password, rememberMe: Boolean(rememberMe) }),
    });
  } catch {
    throw new Error("Could not connect to the login service. Check your connection and try again.");
  }

  const payload = await readResponse(response);
  if (!response.ok) throw createRequestError(getErrorMessage(payload, response.status, "login"), response.status);

  if (
    !payload ||
    typeof payload.accessToken !== "string" ||
    !payload.accessToken ||
    typeof payload.tokenType !== "string" ||
    !payload.tokenType ||
    !payload.user ||
    typeof payload.user !== "object"
  ) {
    throw new Error("The login service returned an incomplete authentication response.");
  }

  const session = buildSession(payload);
  if (!session) {
    throw new Error("The login service returned an invalid or expired access token.");
  }

  saveSession(session);
  authReady = true;
  return session;
}

export async function changePassword(session, currentPassword, newPassword) {
  let response;

  try {
    response = await authenticatedFetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch (error) {
    if (error && error.status === 401) {
      throw createRequestError("Your session has expired or is no longer valid. Please sign in again.", 401);
    }
    throw new Error("Could not connect to the password service. Check your connection and try again.");
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    throw createRequestError(getErrorMessage(payload, response.status, "change-password"), response.status);
  }

  return payload;
}

export async function forgotPassword(email) {
  let response;

  try {
    response = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error("Could not connect to the password service. Check your connection and try again.");
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    throw createRequestError(getErrorMessage(payload, response.status, "forgot-password"), response.status);
  }

  const message =
    payload && typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : "If that email is registered, a reset link has been sent.";

  return { message };
}

export async function logout(session, allDevices = false) {
  const path = allDevices ? "/api/v1/auth/logout-all" : "/api/v1/auth/logout";
  const headers = { Accept: "application/json" };
  if (session && session.accessToken) {
    headers.Authorization = `${session.tokenType} ${session.accessToken}`;
  }

  let payload = null;
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers,
    });
    payload = await readResponse(response).catch(() => null);
  } catch {
    // Even if the network call fails, the local session is cleared below.
    payload = null;
  }

  clearAuthSession();
  return payload;
}

/* ------------------------------------------------------------------ */
/* Role & permission helpers                                           */
/* ------------------------------------------------------------------ */

export function rolesOf(sessionOrUser) {
  return roleList(sessionOrUser && sessionOrUser.user ? sessionOrUser.user : sessionOrUser);
}

export function hasRole(sessionOrUser, expected) {
  const roles = rolesOf(sessionOrUser);
  const expectedList = Array.isArray(expected) ? expected : [expected];
  return expectedList.some((role) => roles.includes(role));
}

export function hasPermission(sessionOrUser, permission) {
  const user = sessionOrUser && sessionOrUser.user ? sessionOrUser.user : sessionOrUser;
  const permissions = user && Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes(permission);
}

export function hasAnyPermission(sessionOrUser, permissions) {
  return permissions.some((permission) => hasPermission(sessionOrUser, permission));
}

export function isInternalRole(sessionOrUser) {
  return hasRole(sessionOrUser, INTERNAL_ROLES);
}

export function isClientRole(sessionOrUser) {
  return hasRole(sessionOrUser, CLIENT_ROLES);
}

export function isCandidateRole(sessionOrUser) {
  return hasRole(sessionOrUser, CANDIDATE_ROLES);
}

/* Maps a backend role to the dashboard that serves it. The first matching
   entry wins, so privileged roles are listed before the generic fallback. */
export const ROLE_DASHBOARDS = Object.freeze([
  { roles: ["SUPER_ADMIN"], path: "/super-admin", label: "Super Admin Dashboard" },
  { roles: ["HR", "HR_RECRUITER", "HR_MANAGER"], path: "/hr", label: "HR Dashboard" },
  { roles: ["OPERATOR", "OPERATIONS", "SECURITY_GUARD"], path: "/operator", label: "Operator Dashboard" },
  { roles: ["ACCOUNTS", "ACCOUNTANT"], path: "/accounts", label: "Accounts Dashboard" },
  { roles: ["SUPERVISOR"], path: "/supervisor", label: "Supervisor Dashboard" },
  { roles: ["ADMIN", "MANAGER", "RECRUITER"], path: "/admin", label: "Admin Dashboard" },
]);

export function getDashboardPath(sessionOrUser) {
  const roles = rolesOf(sessionOrUser);
  if (roles.some((role) => CLIENT_ROLES.includes(role))) return "/client";
  if (roles.some((role) => CANDIDATE_ROLES.includes(role))) return "/candidate";
  for (const entry of ROLE_DASHBOARDS) {
    if (roles.some((role) => entry.roles.includes(role))) return entry.path;
  }
  if (roles.some((role) => INTERNAL_ROLES.includes(role))) return "/admin";
  return "/account";
}
