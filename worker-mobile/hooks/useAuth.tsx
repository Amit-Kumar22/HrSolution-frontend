import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiSession, clearSession, readSession } from "../services/api";
import { currentUser, login, logout } from "../services/auth";

type AuthContextValue = { session: ApiSession | null; loading: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; refresh: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ApiSession | null>(null); const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const stored = await readSession();
      if (!stored) { setSession(null); return; }
      const user = await currentUser();
      if (!user?.roles?.includes("WORKER")) throw new Error("Worker access required.");
      setSession({ ...stored, user });
    } catch {
      // A stale token, unavailable SecureStore, or unreachable API must return
      // to the login screen instead of leaving Expo Go in a fatal startup state.
      try { await clearSession(); } catch { /* SecureStore may be unavailable during startup. */ }
      setSession(null);
    }
  };
  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);
  const value = useMemo(() => ({ session, loading, signIn: async (email: string, password: string) => setSession(await login(email, password)), signOut: async () => { await logout(); setSession(null); }, refresh }), [session, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }
