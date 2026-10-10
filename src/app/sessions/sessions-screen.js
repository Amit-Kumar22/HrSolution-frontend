"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Laptop, LogOut, MonitorSmartphone, RefreshCw, Trash2 } from "lucide-react";
import {
  AUTH_SESSION_ERROR,
  AUTH_SESSION_LOADING,
  clearAuthSession,
  getAuthSessionSnapshot,
  getDashboardPath,
  getServerAuthSnapshot,
  logout,
  subscribeToAuthSession,
} from "@/lib/auth";
import { listSessions, revokeSession } from "@/lib/authApi";

function parseUserAgent(userAgent) {
  if (typeof userAgent !== "string" || !userAgent) return "Unknown device";
  const label =
    (userAgent.match(/(edge|edg|opera|opr|chrome|firefox|safari|version)/i)?.[1] ||
      "Browser").replace(/edg/i, "Edge").replace(/opr/i, "Opera");
  const os = userAgent.match(/\(([^)]*)\)/);
  const osName = os ? os[1].split(";")[0].trim() : "";
  return [label, osName].filter(Boolean).join(" · ");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsScreen() {
  const router = useRouter();
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [revoking, setRevoking] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (sessionState === null) router.replace("/login");
  }, [router, sessionState]);

  useEffect(() => {
    if (!sessionState || sessionState === AUTH_SESSION_LOADING) return;
    if (sessionState && "error" in sessionState) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listSessions();
        if (cancelled) return;
        setSessions(Array.isArray(items) ? items : []);
        setError("");
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load your active sessions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionState, reloadKey]);

  function requestReload() {
    setLoading(true);
    setActionError("");
    setReloadKey((key) => key + 1);
  }

  async function handleRevoke(sessionId, isCurrent) {
    if (revoking !== null) return;
    setActionError("");
    setRevoking(sessionId);
    try {
      await revokeSession(sessionId);
      if (isCurrent) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      setSessions((previous) => previous.filter((session) => Number(session.id) !== Number(sessionId)));
    } catch (revokeError) {
      setActionError(
        revokeError instanceof Error ? revokeError.message : "The session could not be revoked. Please try again.",
      );
      requestReload();
    } finally {
      setRevoking(null);
    }
  }

  async function handleLogout() {
    if (!sessionState || isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout(sessionState);
    } catch {
      // The local session is still cleared below.
    }
    router.replace("/login");
  }

  if (sessionState === AUTH_SESSION_LOADING || sessionState === null) {
    return <main className="sessionsShell"><div className="sessionsContainer"><div className="sessionsState">Checking your session…</div></div></main>;
  }

  if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) {
    return <main className="sessionsShell"><div className="sessionsContainer"><div className="sessionsState sessionsState--error" role="alert">{sessionState.error}</div></div></main>;
  }

  const session = sessionState;

  return (
    <main className="sessionsShell">
      <div className="sessionsTopbar">
        <Link href="/" className="sessionsBrand">
          <span className="sessionsBrandMark">S</span>
          <span>Shakti Manpower</span>
        </Link>
        <div className="sessionsTopActions">
          <Link className="sessionsTopLink" href={getDashboardPath(session)}>Back to dashboard</Link>
          <button type="button" className="sessionsTopButton" onClick={requestReload} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button type="button" className="sessionsTopButton" onClick={handleLogout} disabled={isLoggingOut}>
            <LogOut size={13} /> {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      <div className="sessionsContainer">
        <div className="sessionsHeader">
          <h1>Active sessions</h1>
          <p>Devices signed in to your account. Revoke any session you do not recognise. Your current session is highlighted.</p>
        </div>

        {actionError && (
          <div className="authAlert authAlert--error" role="alert" style={{ marginBottom: 16 }}>{actionError}</div>
        )}

        {loading ? (
          <div className="sessionsState">Loading your active sessions…</div>
        ) : error ? (
          <div className="sessionsState sessionsState--error" role="alert">
            {error}
            <div style={{ marginTop: 14 }}>
              <button type="button" className="authButtonSecondary" onClick={requestReload}>Retry</button>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="sessionsState">No active sessions were found for your account.</div>
        ) : (
          <div className="sessionList">
            {sessions.map((item) => {
              const isCurrent = Boolean(item.current);
              return (
                <article className={`sessionCard${isCurrent ? " sessionCard--current" : ""}`} key={item.id}>
                  <div className="sessionMain">
                    <h2 className="sessionTitle">
                      <MonitorSmartphone size={16} />
                      {parseUserAgent(item.userAgent)}
                      {isCurrent && <span className="sessionBadge">CURRENT SESSION</span>}
                    </h2>
                    <ul className="sessionMeta">
                      <li><Laptop size={14} />Device · <strong>{parseUserAgent(item.userAgent)}</strong></li>
                      <li><span>IP · </span>{item.ipAddress || "—"}</li>
                      <li><span>Signed in · </span>{formatDate(item.createdAt)}</li>
                      <li><span>Expires · </span>{formatDate(item.expiresAt)}</li>
                      <li><span>Session ID · </span>#{item.id}</li>
                    </ul>
                  </div>
                  <div className="sessionActions">
                    <button
                      type="button"
                      className="sessionRevoke"
                      disabled={revoking !== null}
                      onClick={() => handleRevoke(item.id, isCurrent)}
                    >
                      <Trash2 size={13} /> {revoking === item.id ? "Revoking…" : isCurrent ? "Sign out this device" : "Revoke"}
                    </button>
                    {isCurrent && <span className="sessionCurrentNote">Revoking this signs you out on this device.</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}