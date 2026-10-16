"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  Headset,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Settings,
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
  logout,
  refreshAuthSession,
  subscribeToAuthSession,
} from "@/lib/auth";
import { getMyClient } from "@/lib/clientApi";
import { styles } from "@/app/admin/admin-styles";

const navigation = [
  { label: "Overview", view: "dashboard", icon: LayoutDashboard, section: "WORKSPACE" },
  { label: "Requisitions", view: "requisitions", icon: ClipboardList, section: "WORKSPACE" },
  { label: "Account settings", href: "/account", icon: Settings, section: "ACCOUNT" },
];

const statusGuidance = {
  PENDING_APPROVAL: "Your company registration is awaiting approval. Client workspace features will unlock once your account is approved.",
  DISABLED: "This client account has been disabled. Please contact your Shakti Manpower account manager.",
  REJECTED: "This client registration was not approved. Please contact support for more details.",
};

function displayName(user) {
  return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Client";
}

function ClientBrand() {
  return (
    <Link href="/" className={styles.brand}>
      <span className={styles.brandMark}>S</span>
      <span><strong>Shakti Manpower</strong><small>Client Portal</small></span>
    </Link>
  );
}

export default function ClientDashboard() {
  const router = useRouter();
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );
  const [company, setCompany] = useState(null);
  const [companyError, setCompanyError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userActionsRef = useRef(null);

  useEffect(() => {
    if (sessionState === AUTH_SESSION_LOADING || sessionState === AUTH_SESSION_ERROR) return;
    if (!sessionState) {
      router.replace(getUnauthenticatedRedirectPath());
      return;
    }
    const dashboardPath = getDashboardPath(sessionState);
    if (dashboardPath !== "/client") router.replace(dashboardPath);
  }, [router, sessionState]);

  useEffect(() => {
    if (!sessionState || typeof sessionState !== "object" || !sessionState.accessToken || getDashboardPath(sessionState) !== "/client") return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyClient();
        if (!cancelled) setCompany(data);
      } catch (error) {
        if (!cancelled) setCompanyError(error instanceof Error ? error.message : "Your company details could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionState]);

  useEffect(() => {
    if (!sessionState || typeof sessionState !== "object" || !sessionState.accessToken) return;
    const timeout = window.setTimeout(async () => {
      const refreshed = await refreshAuthSession();
      if (refreshed) return;
      try {
        clearAuthSession();
      } catch (error) {
        setLogoutError(error instanceof Error ? error.message : "Could not clear the expired session.");
      }
      router.replace("/login");
    }, Math.max(0, sessionState.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [router, sessionState]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    function handlePointerDown(event) {
      if (userActionsRef.current && !userActionsRef.current.contains(event.target)) setProfileOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  async function handleLogout() {
    if (!sessionState || isLoggingOut) return;
    setLogoutError("");
    setIsLoggingOut(true);
    try {
      await logout(sessionState);
      router.replace("/");
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (sessionState === AUTH_SESSION_LOADING) {
    return <main className={styles.loadingScreen}>Checking client session…</main>;
  }
  if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) {
    return <main className={styles.loadingScreen} role="alert">{sessionState.error}</main>;
  }
  if (!sessionState) {
    return <main className={styles.loadingScreen}>Redirecting to sign in…</main>;
  }

  const user = sessionState.user;
  const name = displayName(user);
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const guidance = statusGuidance[user.status];
  const sections = ["WORKSPACE", "ACCOUNT"];

  function chooseView(view) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  return (
    <main className={`${styles.adminShell} clientShell`}>
      {sidebarOpen && (
        <button className={styles.backdrop} aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`${styles.sidebar}${sidebarOpen ? ` ${styles.sidebarOpen}` : ""}`}>
        <ClientBrand />
        <nav className={styles.sideNav} aria-label="Client navigation">
          {sections.map((section) => (
            <div className={styles.navGroup} key={section}>
              <div className={styles.navSection}>{section}</div>
              {navigation.filter((item) => item.section === section).map((item) => {
                const Icon = item.icon;
                return item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={styles.navItem}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => chooseView(item.view)}
                    className={`${styles.navItem}${activeView === item.view ? ` ${styles.navActive}` : ""}`}
                    aria-current={activeView === item.view ? "page" : undefined}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <button className={styles.signOut} type="button" onClick={() => handleLogout()} disabled={isLoggingOut}>
          <LockKeyhole size={15} />{isLoggingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      <section className={styles.mainArea}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenu}
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="clientTopbarTitle">
            <strong>Client workspace</strong>
            <span>Shakti Manpower</span>
          </div>
          <div className={styles.userActions} ref={userActionsRef}>
            <Link className="clientHelpLink" href="/#contact" aria-label="Contact Shakti Manpower">
              <Headset size={17} />
              <span>Support</span>
            </Link>
            <button
              type="button"
              className={styles.userProfile}
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <span className={styles.avatar}>{initials}</span>
              <span><strong>{name}</strong><small>Client</small></span>
              <ChevronDown size={15} />
            </button>
            {profileOpen && (
              <div className={styles.profileMenu}>
                <Link href="/account" className={styles.profileMenuItem}>Account settings</Link>
                <Link href="/sessions" className={styles.profileMenuItem}>Active sessions</Link>
                <button
                  type="button"
                  className={styles.profileMenuItem}
                  onClick={() => handleLogout()}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className={styles.dashboardContent}>
          {logoutError && <p className={styles.actionError} role="alert">{logoutError}</p>}
          <div className="clientPageHeading">
            <div>
              <p className="clientEyebrow">CLIENT PORTAL</p>
              <h1>{activeView === "dashboard" ? `Welcome back, ${name}` : navigation.find((item) => item.view === activeView)?.label}</h1>
              <p>Manage your company workspace, sites and service agreements.</p>
            </div>
            <span className="clientAccountBadge"><span /> Client account</span>
          </div>

          {guidance && <div className="clientStatusNotice" role="status">{guidance}</div>}
          {companyError && <div className="clientErrorNotice" role="alert">{companyError}</div>}

          {activeView === "dashboard" ? (
            <>
              <section className="clientMetricGrid" aria-label="Company summary">
                <article className="clientMetricCard">
                  <span>Active sites</span>
                  <strong>{company?.activeSiteCount ?? "—"}</strong>
                  <small>Sites linked to your company</small>
                </article>
                <article className="clientMetricCard">
                  <span>Active contracts</span>
                  <strong>{company?.activeContractCount ?? "—"}</strong>
                  <small>Current service agreements</small>
                </article>
                <article className="clientMetricCard">
                  <span>Account status</span>
                  <strong className="clientMetricStatus">{user.status || "Active"}</strong>
                  <small>Client portal access</small>
                </article>
              </section>
              <section className="clientCompanyCard" aria-labelledby="client-company-title">
                <div className="clientCompanyHeading">
                  <div className="clientCompanyIcon"><Building2 size={19} /></div>
                  <div>
                    <h2 id="client-company-title">Company profile</h2>
                    <p>Your company information on file with Shakti Manpower.</p>
                  </div>
                  <span className="clientCompanyStatus">{company?.status || user.status || "Loading"}</span>
                </div>
                <dl className="clientCompanyDetails">
                  <div><dt>Legal name</dt><dd>{company?.legalName || "—"}</dd></div>
                  <div><dt>Client code</dt><dd>{company?.clientCode || "—"}</dd></div>
                  <div><dt>Industry</dt><dd>{company?.industryName || "—"}</dd></div>
                  <div><dt>GSTIN</dt><dd>{company?.gstin || "—"}</dd></div>
                  <div><dt>Contact email</dt><dd>{user.email || "—"}</dd></div>
                </dl>
              </section>
            </>
          ) : (
            <section className="clientCompanyCard clientModuleCard">
              <div className="clientCompanyHeading">
                <div className="clientCompanyIcon">
                  <ClipboardList size={19} />
                </div>
                <div>
                  <h2>{navigation.find((item) => item.view === activeView)?.label}</h2>
                  <p>{company?.legalName || "Your company"} workspace</p>
                </div>
              </div>
              <p className="clientModuleMessage">
                Requisition details are not available in this account summary. Contact your Shakti Manpower account manager for assistance.
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
