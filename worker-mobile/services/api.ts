import axios, { AxiosError, AxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

const baseURL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");
// Keep the first screen responsive when a phone cannot reach the configured API.
// A long axios timeout otherwise leaves the app looking frozen during auth restore.
export const api = axios.create({ baseURL, timeout: 12000, headers: { Accept: "application/json" } });
const TOKEN_KEY = "worker-mobile-session";

export type ApiSession = { accessToken: string; tokenType: string; expiresAt: number; user: Record<string, any> };

export async function readSession(): Promise<ApiSession | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) return null;
  try { const session = JSON.parse(raw) as ApiSession; return session.expiresAt > Date.now() ? session : null; } catch { return null; }
}
export async function saveSession(session: ApiSession) { await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(session)); }
export async function clearSession() { await SecureStore.deleteItemAsync(TOKEN_KEY); }

api.interceptors.request.use(async (config) => {
  // Login must always be a fresh direct request. Do not send a stale session
  // token from a previous account along with the new worker credentials.
  if (String(config.url || "").replace(/^\//, "") === "auth/login") return config;
  const session = await readSession();
  if (session?.accessToken) config.headers.Authorization = `${session.tokenType || "Bearer"} ${session.accessToken}`;
  return config;
});

export function apiMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  const response = (error as AxiosError<any>)?.response;
  const payload = response?.data;
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.detail === "string") return payload.detail;
  if (response?.status === 401) return "Your session has expired. Please sign in again.";
  if (response?.status === 403) return "You do not have permission to access this resource.";
  if (response?.status && response.status >= 500) return "The service is temporarily unavailable.";
  if ((error as any)?.code === "ECONNABORTED" || (error as any)?.code === "ETIMEDOUT") return "The service took too long to respond. Check your connection and try again.";
  if ((error as any)?.code === "ERR_NETWORK") return "Could not connect to the service. Check the API URL and network.";
  return fallback;
}

export async function request<T>(config: AxiosRequestConfig) {
  if (!baseURL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  return (await api.request<T>(config)).data;
}
