"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChevronDown,
  LayoutDashboard,
  Layers,
  LockKeyhole,
  LogOut,
  Menu,
  ShieldCheck,
  UserSearch,
  X,
} from "lucide-react";
import {
  AUTH_SESSION_ERROR,
  AUTH_SESSION_LOADING,
  clearAuthSession,
  getAuthSessionSnapshot,
  getDashboardPath,
  getServerAuthSnapshot,
  getUnauthenticatedRedirectPath,
  hasRole,
  logout,
  refreshAuthSession,
  subscribeToAuthSession,
} from "../lib/auth";
import { listPermissions } from "../lib/adminApi";
import { styles } from "../app/admin/admin-styles";
import { EmptyState } from "../app/admin/admin-ui";
import ClientsPanel from "./clients-panel";
import CandidatesPanel from "../app/admin/candidates-panel";
import InterviewManagementPanel from "../app/admin/interview-panel";
import JobsPanel from "../app/admin/jobs-panel";

const MODULE_LABELS = {
  USER: "User & account management",
  ROLE: "Roles & permissions",
  CLIENT: "Clients",
  ENQUIRY: "Enquiries",
  PAYROLL: "Payroll",
  ATTENDANCE: "Attendance",
  WORKFORCE: "Workforce",
  RECRUITMENT: "Recruitment",
  CONTRACT: "Contracts",
  INVOICE: "Invoices",
  SETTINGS: "Settings",
  AUDIT: "Audit",
  CONTENT: "Website content",
};

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function moduleOf(permissionName) {
  const parts = String(permissionName || "").split("_");
  if (parts.length <= 1) return "OTHER";
  return parts.slice(0, parts.length - 1).join("_");
}

export default function RoleDashboard({ allowedRoles, dashboardName, description, clientManagement = false, clientView = false, candidatesView = false, interviewsView = false, jobsView = false }) {
  const router = useRouter();
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [catalogue, setCatalogue] = useState(null);

  useEffect(() => {
    if (sessionState === AUTH_SESSION_LOADING) return;
    if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) return;
    if (!sessionState) {
      router.replace(getUnauthenticatedRedirectPath());
      return;
    }
    if (!hasRole(sessionState, allowedRoles)) {
      router.replace(getDashboardPath(sessionState));
    }
  }, [router, sessionState, allowedRoles]);

  useEffect(() => {
    if (!sessionState || typeof sessionState !== "object" || !sessionState.accessToken) return;
    const timeout = window.setTimeout(async () => {
      const refreshed = await refreshAuthSession();
      if (refreshed) return;
      try {
        clearAuthSession();
      } catch {
        // Ignore; the redirect below still runs.
      }
      router.replace("/login");
    }, Math.max(0, sessionState.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [router, sessionState]);

  useEffect(() => {
    if (!sessionState || typeof sessionState !== "object" || !sessionState.accessToken) return;
    let cancelled = false;
    listPermissions()
      .then((data) => {
        if (!cancelled) setCatalogue(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCatalogue([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionState]);

  const permissionModules = useMemo(() => catalogue || [], [catalogue]);

  const permissionMeta = useMemo(() => {
    const map = new Map();
    for (const permission of permissionModules) {
      map.set(permission.name, permission);
    }
    return map;
  }, [permissionModules]);

  async function handleLogout(allDevices = false) {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout(sessionState, allDevices);
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (sessionState === AUTH_SESSION_LOADING) {
    return <main className={styles.loadingScreen}>Checking your session…</main>;
  }
  if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) {
    return (
      <main className={styles.loadingScreen} role="alert">
        {sessionState.error}
      </main>
    );
  }
  if (!sessionState || !hasRole(sessionState, allowedRoles)) {
    return <main className={styles.loadingScreen}>Redirecting…</main>;
  }

  const user = sessionState.user || {};
  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
  const initials = fullName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  const grouped = new Map();
  for (const permission of permissions) {
    const meta = permissionMeta.get(permission);
    const moduleKey = (meta && meta.module) || moduleOf(permission);
    if (!grouped.has(moduleKey)) grouped.set(moduleKey, []);
    grouped.get(moduleKey).push(permission);
  }
  const modules = [...grouped.entries()]
    .map(([moduleKey, items]) => ({
      module: moduleKey,
      label: MODULE_LABELS[moduleKey] || humanize(moduleKey),
      items: [...items].sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const nav = [
    { label: "Dashboard", view: "overview", icon: LayoutDashboard },
    ...(clientManagement || clientView ? [{ label: "Clients", view: "clients", icon: Building2 }] : []),
    ...(candidatesView ? [{ label: "Candidates", view: "candidates", icon: UserSearch }] : []),
    ...(jobsView ? [{ label: "Jobs", view: "jobs", icon: BriefcaseBusiness }] : []),
    ...(interviewsView ? [{ label: "Interviews", view: "interviews", icon: CalendarClock }] : []),
    { label: "My access", view: "access", icon: ShieldCheck },
  ];

  return (
    <main className={styles.adminShell}>
      {sidebarOpen && (
        <button className={styles.backdrop} aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`${styles.sidebar}${sidebarOpen ? ` ${styles.sidebarOpen}` : ""}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <span>
            <strong>Shakti Manpower</strong>
            <small>{dashboardName}</small>
          </span>
        </Link>
        <nav className={styles.sideNav} aria-label={`${dashboardName} navigation`}>
          <div className={styles.navGroup}>
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  className={`${styles.navItem}${isActive ? ` ${styles.navActive}` : ""}`}
                  onClick={() => {
                    setActiveView(item.view);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <div className={styles.payrollNotice}>
          <strong>Signed in as</strong>
          <span>{fullName}</span>
          <small>{roles.join(" · ") || "No role"}</small>
        </div>
        <button className={styles.signOut} type="button" onClick={() => handleLogout()} disabled={isLoggingOut}>
          <LockKeyhole size={15} />
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      <section className={styles.mainArea}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenu}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="saHeaderMeta">
            <strong>{dashboardName}</strong>
          </div>
          <div className={styles.userActions}>
            <button className={styles.userProfile} aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}>
              <span className={styles.avatar}>{initials}</span>
              <span>
                <strong>{fullName}</strong>
                <small>{roles[0] ? humanize(roles[0]) : "User"}</small>
              </span>
              <ChevronDown size={15} />
            </button>
            {profileOpen && (
              <div className={styles.profileMenu}>
                <Link href="/sessions" className={styles.profileMenuItem}>
                  Active sessions
                </Link>
                <button
                  type="button"
                  className={styles.profileMenuItem}
                  onClick={() => handleLogout(false)}
                  disabled={isLoggingOut}
                >
                  Sign out
                </button>
                <button
                  type="button"
                  className={styles.profileMenuItem}
                  onClick={() => handleLogout(true)}
                  disabled={isLoggingOut}
                >
                  Sign out all devices
                </button>
              </div>
            )}
          </div>
        </header>

        <div className={styles.dashboardContent}>
          {activeView === "clients" ? (
            <ClientsPanel readOnly={!clientManagement} />
          ) : activeView === "candidates" ? (
            <CandidatesPanel session={sessionState} />
          ) : activeView === "jobs" ? (
            <JobsPanel session={sessionState} />
          ) : activeView === "interviews" ? (
            <InterviewManagementPanel session={sessionState} />
          ) : (
            <>
          <div className={styles.pageHeading}>
            <div>
              <h1>{activeView === "access" ? "My access" : dashboardName}</h1>
              <p>{description}</p>
            </div>
            <div className={styles.headingActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => handleLogout()}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>

          <div className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span>Account</span>
                <i className={styles.blue}>
                  <ShieldCheck size={18} />
                </i>
              </div>
              <strong className={styles.metricValue}>{user.status || "—"}</strong>
              <p>
                {user.email || "—"} <span />
              </p>
            </article>
            <article className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span>Roles</span>
                <i className={styles.indigo}>
                  <Layers size={18} />
                </i>
              </div>
              <strong className={styles.metricValue}>{roles.length}</strong>
              <p>
                {roles.join(", ") || "None"} <span />
              </p>
            </article>
            <article className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span>Permissions</span>
                <i className={styles.green}>
                  <ShieldCheck size={18} />
                </i>
              </div>
              <strong className={styles.metricValue}>{permissions.length}</strong>
              <p>
                Granted by the server <span />
              </p>
            </article>
          </div>

          {activeView === "overview" ? (
            <>
              <div className="saSectionLabel">Your authorised modules</div>
              {!modules.length ? (
                <EmptyState
                  title="No modules assigned yet"
                  message="Your role does not grant any module permissions. Ask the Super Admin to review your role."
                />
              ) : (
                <div className="saModuleGrid">
                  {modules.map((module) => (
                    <div className="saModuleCard" key={module.module}>
                      <i>
                        <Layers size={17} />
                      </i>
                      <strong>{module.label}</strong>
                      <p>Actions granted to your role in this module.</p>
                      <div className="saShares">
                        {module.items.map((item) => (
                          <span className="saShare" key={item}>
                            {humanize(item)}
                          </span>
                        ))}
                      </div>
                      <small>{module.module}</small>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="saPermGroups">
              <div className="saInlineNote">
                These are the permissions the server derives for you from the database on every request. They decide
                what you can see and do — they cannot be changed from the browser.
              </div>
              {!modules.length ? (
                <EmptyState title="No permissions" message="Your account currently has no module permissions." />
              ) : (
                modules.map((module) => (
                  <div className="saPermGroup" key={module.module}>
                    <div className="saPermGroupHead">
                      <strong>{module.label}</strong>
                      <span className="cmCount">{module.items.length} permission(s)</span>
                    </div>
                    <div className="saPermGroupList">
                      {module.items.map((item) => {
                        const meta = permissionMeta.get(item);
                        return (
                          <div className="saPermItem" key={item}>
                            <input type="checkbox" checked readOnly tabIndex={-1} />
                            <span>
                              <strong>{humanize(item)}</strong>
                              <small>{item}</small>
                              {meta && meta.description && <small>{meta.description}</small>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
