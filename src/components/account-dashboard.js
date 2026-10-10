"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import {
  AUTH_SESSION_ERROR,
  AUTH_SESSION_LOADING,
  getAuthSessionSnapshot,
  getDashboardPath,
  getServerAuthSnapshot,
  logout,
  subscribeToAuthSession,
} from "@/lib/auth";

const STATUS_META = {
  ACTIVE: { label: "Active", tone: "active" },
  PENDING_VERIFICATION: { label: "Pending email verification", tone: "pending" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "pending" },
  DISABLED: { label: "Disabled", tone: "blocked" },
  REJECTED: { label: "Rejected", tone: "blocked" },
};

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

export default function AccountDashboard({ role, heading, subtitle, roleTitle, highlights = [], statusGuidance = {} }) {
  const router = useRouter();
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );

  useEffect(() => {
    if (sessionState === AUTH_SESSION_LOADING) return;
    if (!sessionState || (sessionState && "error" in sessionState)) {
      if (!sessionState) router.replace("/login");
      return;
    }
    const dashboardPath = getDashboardPath(sessionState);
    if (dashboardPath !== `/${role.toLowerCase()}`) router.replace(dashboardPath);
  }, [router, sessionState, role]);

  if (sessionState === AUTH_SESSION_LOADING) {
    return <main className="accountShell"><div className="accountContainer"><div className="sessionsState">Loading your account…</div></div></main>;
  }

  if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) {
    return <main className="accountShell"><div className="accountContainer"><div className="sessionsState sessionsState--error" role="alert">{sessionState.error}</div></div></main>;
  }

  if (!sessionState) {
    return <main className="accountShell"><div className="accountContainer"><div className="sessionsState">Redirecting to sign in…</div></div></main>;
  }

  const user = sessionState.user;
  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const status = STATUS_META[user.status] || { label: user.status || "Unknown", tone: "pending" };
  const guidance = statusGuidance[user.status];

  async function handleLogout() {
    await logout(sessionState).catch(() => {});
    router.replace("/login");
  }

  return (
    <main className="accountShell">
      <div className="sessionsTopbar">
        <Link href="/" className="sessionsBrand">
          <span className="sessionsBrandMark">S</span>
          <span>Shakti Manpower</span>
        </Link>
        <div className="sessionsTopActions">
          <Link className="sessionsTopLink" href="/sessions">Active sessions</Link>
          <button type="button" className="sessionsTopButton" onClick={handleLogout}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      <div className="accountContainer">
        <div className="accountHeading">
          <h1>{heading}</h1>
          <p>{subtitle}</p>
        </div>

        {guidance && (
          <div className={`authAlert ${status.tone === "blocked" ? "authAlert--error" : "authAlert--info"}`} role="status" style={{ marginBottom: 20 }}>
            <ShieldCheck size={16} />{guidance}
          </div>
        )}

        <div className="accountGrid">
          <section className="accountCard">
            <h2>Profile</h2>
            <dl>
              <div className="accountField"><dt>Full name</dt><dd>{fullName}</dd></div>
              <div className="accountField"><dt>Email address</dt><dd>{user.email}</dd></div>
              <div className="accountField"><dt>Phone number</dt><dd>{user.phone || "—"}</dd></div>
            </dl>
          </section>

          <section className="accountCard">
            <h2>Account</h2>
            <dl>
              <div className="accountField">
                <dt>Status</dt>
                <dd><span className={`accountStatus accountStatus--${status.tone}`}>{status.label}</span></dd>
              </div>
              <div className="accountField">
                <dt>Email verified</dt>
                <dd>{user.emailVerified ? "Yes" : "No"}</dd>
              </div>
              <div className="accountField"><dt>Last sign-in</dt><dd>{formatDate(user.lastLoginAt)}</dd></div>
            </dl>
          </section>

          <section className="accountCard">
            <h2>Roles</h2>
            {Array.isArray(user.roles) && user.roles.length ? (
              <ul className="accountTags">
                {user.roles.map((roleName) => <li key={roleName}>{roleName}</li>)}
              </ul>
            ) : (
              <p className="authSubtitle" style={{ margin: 0 }}>No roles were returned for this account.</p>
            )}
          </section>

          <section className="accountCard">
            <h2>Permissions</h2>
            {Array.isArray(user.permissions) && user.permissions.length ? (
              <ul className="accountTags">
                {user.permissions.map((permission) => <li key={permission}>{permission}</li>)}
              </ul>
            ) : (
              <p className="authSubtitle" style={{ margin: 0 }}>No permissions were returned for this account.</p>
            )}
            <p className="authNote" style={{ textAlign: "left", marginTop: 12 }}>
              Permissions control what you see here; the server still authorises every action.
            </p>
          </section>

          <section className="accountCard" style={{ gridColumn: "1 / -1" }}>
            <h2>{roleTitle}</h2>
            {highlights.length > 0 ? (
              <ul className="authSteps" style={{ marginTop: 0 }}>
                {highlights.map((item, index) => (
                  <li key={item}><b>{index + 1}</b><span>{item}</span></li>
                ))}
              </ul>
            ) : null}
            {user.status === "PENDING_VERIFICATION" && (
              <div className="accountActions">
                <Link className="accountActionLink" href="/resend-verification"><RefreshCw size={14} /> Resend verification email</Link>
              </div>
            )}
            <div className="accountActions">
              <Link className="accountActionLink" href="/sessions"><KeyRound size={14} /> Manage active sessions</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}