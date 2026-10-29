import { clearSession, request, saveSession, ApiSession } from "./api";

export async function login(email: string, password: string): Promise<ApiSession> {
  const payload = await request<any>({
    method: "POST",
    url: "/auth/login",
    data: { email: email.trim().toLowerCase(), password, rememberMe: false },
    headers: { Authorization: undefined },
  });
  if (!payload?.accessToken || !payload?.user) throw new Error("The login service returned an incomplete authentication response.");
  const expiresAt = payload.expiresAt ? Date.parse(payload.expiresAt) : Date.now() + Number(payload.expiresIn || 3600) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error("The login service returned an invalid or expired access token.");
  const session = { accessToken: payload.accessToken, tokenType: payload.tokenType || "Bearer", expiresAt, user: payload.user };
  if (!Array.isArray(session.user.roles) || !session.user.roles.includes("WORKER")) throw new Error("This mobile app is only available to Worker accounts.");
  await saveSession(session);
  return session;
}
export async function currentUser() { return request<any>({ method: "GET", url: "/auth/me", timeout: 12000 }); }
export async function logout() {
  try { await request({ method: "POST", url: "/auth/logout" }); } finally { await clearSession(); }
}
