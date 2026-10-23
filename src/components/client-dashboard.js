"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  ClipboardList,
  FileSignature,
  Headset,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  Users,
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
  { label: "Account settings", href: "/client/account", icon: Settings, section: "ACCOUNT" },
];

const statusGuidance = {
  PENDING_APPROVAL: "Your company registration is awaiting approval. Client workspace features will unlock once your account is approved.",
  DISABLED: "This client account has been disabled. Please contact your Shakti Manpower account manager.",
  REJECTED: "This client registration was not approved. Please contact support for more details.",
};

const ACCOUNT_TONES = {
  ACTIVE: { label: "Active", tone: "active" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "pending" },
  PENDING: { label: "Pending approval", tone: "pending" },
  DISABLED: { label: "Disabled", tone: "blocked" },
  REJECTED: { label: "Rejected", tone: "blocked" },
  BLOCKED: { label: "Blocked", tone: "blocked" },
};

function accountStatus(status) {
  const key = String(status || "").toUpperCase();
  return ACCOUNT_TONES[key] || { label: key || "Unknown", tone: "unknown" };
}

function formatDateValue(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

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

export default function ClientDashboard({ initialView = "dashboard" }) {
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
  const [activeView, setActiveView] = useState(initialView);
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
  const account = accountStatus(user.status);
  const today = formatDateValue(new Date());
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
                    className={`${styles.navItem}${activeView === "account-settings" ? ` ${styles.navActive}` : ""}`}
                    onClick={() => chooseView("account-settings")}
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
                <Link
                  href="/client/account"
                  className={styles.profileMenuItem}
                  onClick={() => {
                    chooseView("account-settings");
                    setProfileOpen(false);
                  }}
                >
                  Account settings
                </Link>
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

          <section className="clHero">
            <div className="clHeroText">
              <p className="clEyebrow">Client portal</p>
              <h1>
                {activeView === "dashboard" ? `Welcome back, ${name}` : activeView === "account-settings" ? "Account settings" : navigation.find((item) => item.view === activeView)?.label}
              </h1>
              <p className="clHeroLead">
                {activeView === "account-settings"
                  ? "Review your client profile and account information."
                  : "Company profile, sites and service agreements — all in one compact view."}
              </p>
            </div>
            <div className="clHeroAside">
              <span className={`clStatusPill clStatusPill--${account.tone}`}>
                <i />
                {account.label}
              </span>
              <span className="clHeroDate" suppressHydrationWarning>
                {today}
              </span>
              <span className="clHeroEmail">{user.email || "—"}</span>
            </div>
          </section>

          {guidance && <div className="clientStatusNotice" role="status">{guidance}</div>}
          {companyError && <div className="clientErrorNotice" role="alert">{companyError}</div>}

          {activeView === "account-settings" ? (
            <section className="clPanel clientAccountSettings" aria-labelledby="client-account-settings-title">
              <div className="clPanelHead">
                <div>
                  <h2 id="client-account-settings-title">Account settings</h2>
                  <p>Profile and account information associated with your client access.</p>
                </div>
                <span className={`clStatusPill clStatusPill--${account.tone}`}>
                  <i />
                  {account.label}
                </span>
              </div>
              <dl className="clDetails">
                <div>
                  <dt>Full name</dt>
                  <dd>{name}</dd>
                </div>
                <div>
                  <dt>Email address</dt>
                  <dd>{user.email || "—"}</dd>
                </div>
                <div>
                  <dt>Phone number</dt>
                  <dd>{company?.contactPhone || user.phone || "—"}</dd>
                </div>
                <div>
                  <dt>Company</dt>
                  <dd>{company?.legalName || "—"}</dd>
                </div>
                <div>
                  <dt>Client code</dt>
                  <dd>{company?.clientCode || "—"}</dd>
                </div>
                <div>
                  <dt>Account status</dt>
                  <dd>{account.label}</dd>
                </div>
              </dl>
              <div className="clientAccountSettingsActions">
                <Link className="button button-outline" href="/sessions">Manage active sessions</Link>
              </div>
            </section>
          ) : activeView === "dashboard" ? (
            <>
              <section className="clKpis" aria-label="Company summary">
                <article className="clKpi">
                  <div className="clKpiTop">
                    <span>Active sites</span>
                    <i className="clIconTile clTone-blue">
                      <MapPin size={15} />
                    </i>
                  </div>
                  <strong className="clKpiValue">{company?.activeSiteCount ?? "—"}</strong>
                  <p>Sites linked to your company</p>
                </article>
                <article className="clKpi">
                  <div className="clKpiTop">
                    <span>Active contracts</span>
                    <i className="clIconTile clTone-indigo">
                      <FileSignature size={15} />
                    </i>
                  </div>
                  <strong className="clKpiValue">{company?.activeContractCount ?? "—"}</strong>
                  <p>Current service agreements</p>
                </article>
                <article className="clKpi">
                  <div className="clKpiTop">
                    <span>Account status</span>
                    <i className="clIconTile clTone-green">
                      <ShieldCheck size={15} />
                    </i>
                  </div>
                  <strong className="clKpiValue clKpiValue--text">{account.label}</strong>
                  <p>Client portal access</p>
                </article>
              </section>

              <div className="clLayout">
                <section className="clPanel" aria-labelledby="client-company-title">
                  <div className="clPanelHead">
                    <div>
                      <h2 id="client-company-title">Company profile</h2>
                      <p>Your company information on file with Shakti Manpower.</p>
                    </div>
                    <span className="clCount">{company?.status || user.status || "Loading"}</span>
                  </div>
                  <dl className="clDetails">
                    <div>
                      <dt>Legal name</dt>
                      <dd>{company?.legalName || "—"}</dd>
                    </div>
                    <div>
                      <dt>Client code</dt>
                      <dd>{company?.clientCode || "—"}</dd>
                    </div>
                    <div>
                      <dt>Industry</dt>
                      <dd>{company?.industryName || "—"}</dd>
                    </div>
                    <div>
                      <dt>GSTIN</dt>
                      <dd>{company?.gstin || "—"}</dd>
                    </div>
                    <div>
                      <dt>Billing location</dt>
                      <dd>{[company?.billingCity, company?.billingState].filter(Boolean).join(", ") || "—"}</dd>
                    </div>
                    <div>
                      <dt>Contact email</dt>
                      <dd>{user.email || "—"}</dd>
                    </div>
                    <div>
                      <dt>Contact phone</dt>
                      <dd>{company?.contactPhone || user.phone || "—"}</dd>
                    </div>
                    <div>
                      <dt>Onboarded on</dt>
                      <dd>{company?.onboardedOn ? formatDateValue(company.onboardedOn) : "—"}</dd>
                    </div>
                  </dl>
                </section>

                <aside className="clAside">
                  <section className="clPanel" aria-label="Quick actions">
                    <div className="clPanelHead">
                      <div>
                        <h2>Quick actions</h2>
                        <p>Jump straight to what you need.</p>
                      </div>
                    </div>
                    <div className="clActionGrid">
                      <button type="button" className="clAction" onClick={() => chooseView("requisitions")}>
                        <i className="clIconTile clTone-indigo">
                          <ClipboardList size={15} />
                        </i>
                        <span>
                          <strong>Requisitions</strong>
                          <small>Raise a staffing request</small>
                        </span>
                        <ArrowUpRight size={13} />
                      </button>
                      <Link className="clAction" href="/client/account" onClick={() => chooseView("account-settings")}>
                        <i className="clIconTile clTone-blue">
                          <Settings size={15} />
                        </i>
                        <span>
                          <strong>Account settings</strong>
                          <small>Profile and security</small>
                        </span>
                        <ArrowUpRight size={13} />
                      </Link>
                      <Link className="clAction" href="/#contact">
                        <i className="clIconTile clTone-amber">
                          <Headset size={15} />
                        </i>
                        <span>
                          <strong>Support</strong>
                          <small>Talk to your account manager</small>
                        </span>
                        <ArrowUpRight size={13} />
                      </Link>
                      <button type="button" className="clAction" onClick={() => handleLogout()} disabled={isLoggingOut}>
                        <i className="clIconTile clTone-slate">
                          <LockKeyhole size={15} />
                        </i>
                        <span>
                          <strong>{isLoggingOut ? "Signing out…" : "Sign out"}</strong>
                          <small>End this session</small>
                        </span>
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </section>

                  <section className="clPanel" aria-label="Account summary">
                    <div className="clPanelHead">
                      <div>
                        <h2>Account summary</h2>
                        <p>Details held for your company.</p>
                      </div>
                    </div>
                    <ul className="clAccessList">
                      <li>
                        <span>
                          <Building2 size={13} /> Company
                        </span>
                        <strong>{company?.legalName || "—"}</strong>
                      </li>
                      <li>
                        <span>
                          <MapPin size={13} /> Sites
                        </span>
                        <strong>{company?.activeSiteCount ?? "—"}</strong>
                      </li>
                      <li>
                        <span>
                          <FileSignature size={13} /> Contracts
                        </span>
                        <strong>{company?.activeContractCount ?? "—"}</strong>
                      </li>
                      <li>
                        <span>
                          <Users size={13} /> Workspace
                        </span>
                        <strong>{company?.linkedUserCount ?? "—"}</strong>
                      </li>
                    </ul>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <section className="clPanel clModuleCard">
              <div className="clPanelHead">
                <div>
                  <h2>{navigation.find((item) => item.view === activeView)?.label}</h2>
                  <p>{company?.legalName || "Your company"} workspace</p>
                </div>
                <i className="clIconTile clTone-indigo">
                  <ClipboardList size={15} />
                </i>
              </div>
              <p className="clModuleMessage">
                Requisition details are not available in this account summary. Contact your Shakti Manpower account manager for assistance.
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
