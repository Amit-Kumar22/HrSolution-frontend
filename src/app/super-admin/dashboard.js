"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Factory,
  FileSignature,
  FileText,
  Inbox,
  Kanban,
  KeyRound,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Menu,
  Quote,
  Settings2,
  ShieldCheck,
  Tags,
  UserSearch,
  UsersRound,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import {
  AUTH_SESSION_ERROR,
  AUTH_SESSION_LOADING,
  changePassword,
  clearAuthSession,
  getAuthSessionSnapshot,
  getDashboardPath,
  getServerAuthSnapshot,
  getUnauthenticatedRedirectPath,
  hasPermission,
  hasRole,
  logout,
  refreshAuthSession,
  subscribeToAuthSession,
} from "../../lib/auth";
import { getUnreadContactCount } from "../../lib/adminApi";
import { styles } from "./super-admin-styles";
import DashboardOverview from "./dashboard-overview";
import AccountsPanel from "./accounts-panel";
import RolesPanel from "./roles-panel";
import DashboardsPanel from "./dashboards-panel";
import SettingsPanel from "./settings-panel";
import ContactMessagesPanel from "../admin/contact-messages-panel";
import EnquiriesPanel from "../admin/enquiries-panel";
import ManpowerCategoriesPanel from "../admin/manpower-categories-panel";
import SkillsPanel from "../admin/skills-panel";
import IndustriesPanel from "../admin/industries-panel";
import ServicesPanel from "../admin/services-panel";
import ClientsPanel from "../admin/clients-panel";
import ContractsPanel from "../admin/contracts-panel";
import CandidatesPanel from "../admin/candidates-panel";
import ApplicationsPanel from "../admin/applications-panel";
import InterviewManagementPanel from "../admin/interview-panel";
import JobsPanel from "../admin/jobs-panel";
import TestimonialsPanel from "../admin/testimonials-panel";
import RequisitionsPanel from "../admin/requisitions-panel";
import WorkerPanel from "../admin/worker-panel";
import AttendancePanel from "../admin/attendance-panel";
import LeaveManagementPanel from "../admin/leave-panel";
import HolidayManagementPanel from "../admin/holiday-panel";
import DeploymentsPanel from "../admin/deployments-panel";
import ExpiringDocumentsPanel from "../admin/expiring-documents-panel";
import PayrollPanel from "../admin/payroll-panel";
import InvoicePanel from "../admin/invoice-panel";

const navigation = [
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard, section: "main" },
  { label: "Clients", view: "clients", icon: Building2, section: "main" },
  { label: "Contracts", view: "contracts", icon: FileSignature, section: "main" },
  { label: "Requisitions", view: "requisitions", icon: ClipboardList, section: "main" },
  { label: "Deployments", view: "deployments", icon: ArrowRightLeft, section: "main" },
  { label: "Attendance", view: "attendance", icon: CalendarClock, section: "main" },
  { label: "Contact messages", view: "contact-messages", icon: Mail, section: "LEADS" },
  { label: "Enquiries", view: "enquiries", icon: Inbox, section: "LEADS" },
  { label: "Candidates", view: "candidates", icon: UserSearch, section: "WORKFORCE" },
  { label: "Jobs", view: "jobs", icon: BriefcaseBusiness, section: "WORKFORCE" },
  { label: "Applications", view: "applications", icon: Kanban, section: "WORKFORCE" },
  { label: "Interviews", view: "interviews", icon: CalendarClock, section: "WORKFORCE" },
  { label: "Workers", view: "workers", icon: UsersRound, section: "WORKFORCE" },
  { label: "Compliance", view: "compliance", icon: ShieldCheck, section: "WORKFORCE" },
  { label: "Payroll", view: "payroll", icon: Wallet, section: "WORKFORCE" },
  { label: "Invoices", view: "invoices", icon: FileText, section: "WORKFORCE" },
  { label: "Leave Management", view: "leave", icon: CalendarCheck, section: "WORKFORCE" },
  { label: "Holiday Calendar", view: "holiday", icon: CalendarDays, section: "WORKFORCE" },
  { label: "Manpower categories", view: "manpower-categories", icon: Tags, section: "WORKFORCE" },
  { label: "Skills", view: "skills", icon: Wrench, section: "WORKFORCE" },
  { label: "Industries", view: "industries", icon: Factory, section: "WEBSITE" },
  { label: "Services", view: "services", icon: Layers, section: "WEBSITE" },
  { label: "Testimonials", view: "testimonials", icon: Quote, section: "WEBSITE" },
  { label: "Accounts", view: "accounts", icon: UsersRound, section: "ACCESS" },
  { label: "Roles & permissions", view: "roles", icon: ShieldCheck, section: "ACCESS" },
  { label: "Settings", view: "settings", icon: Settings2, section: "SETTINGS" },
];

const sectionOrder = ["main", "LEADS", "WORKFORCE", "WEBSITE", "ACCESS", "SETTINGS"];
const sectionLabels = {
  LEADS: "LEADS",
  WORKFORCE: "WORKFORCE CATALOGUE",
  WEBSITE: "WEBSITE CONTENT",
  ACCESS: "ACCESS MANAGEMENT",
  SETTINGS: "SETTINGS",
};

function Brand() {
  return (
    <Link href="/" className={styles.brand}>
      <span className={styles.brandMark}>S</span>
      <span>
        <strong>Shakti Manpower</strong>
        <small>Super Admin Console</small>
      </span>
    </Link>
  );
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const userActionsRef = useRef(null);
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [pendingCreate, setPendingCreate] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadRefreshToken, setUnreadRefreshToken] = useState(0);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSessionInvalid, setPasswordSessionInvalid] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (sessionState === AUTH_SESSION_LOADING) return;
    if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) return;
    if (!sessionState) {
      router.replace(getUnauthenticatedRedirectPath());
      return;
    }
    if (!hasRole(sessionState, "SUPER_ADMIN")) {
      router.replace(getDashboardPath(sessionState));
    }
  }, [router, sessionState]);

  useEffect(() => {
    if (!sessionState || typeof sessionState !== "object" || !sessionState.accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const count = await getUnreadContactCount();
        if (!cancelled) setUnreadCount(Number.isFinite(count) ? count : 0);
      } catch {
        // Non-fatal: the badge keeps its previous value.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionState, unreadRefreshToken]);

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
      const node = userActionsRef.current;
      if (node && !node.contains(event.target)) setProfileOpen(false);
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

  async function handleLogout(allDevices = false) {
    if (!sessionState || isLoggingOut) return;
    setLogoutError("");
    setIsLoggingOut(true);
    try {
      await logout(sessionState, allDevices);
      window.location.replace("/");
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function openChangePassword() {
    setProfileOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordSessionInvalid(false);
    setPasswordChanged(false);
    setChangePasswordOpen(true);
  }

  function closeChangePassword() {
    if (isChangingPassword || passwordSessionInvalid) return;
    setChangePasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordChanged(false);
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    if (passwordChanged) return;
    setPasswordError("");
    setPasswordSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Current password, new password and confirm password are all required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    setIsChangingPassword(true);
    try {
      const payload = await changePassword(sessionState, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordChanged(true);
      setPasswordSuccess(
        payload && typeof payload.message === "string" && payload.message.trim()
          ? payload.message.trim()
          : "Password changed successfully.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Password change failed. Please try again.";
      setPasswordError(message);
      if (error && (error.status === 401 || error.status === 403)) setPasswordSessionInvalid(true);
    } finally {
      setIsChangingPassword(false);
    }
  }

  function handleReturnToSignIn() {
    try {
      clearAuthSession();
    } catch {
      setLogoutError("The session could not be cleared from this browser.");
      return;
    }
    router.replace("/login");
  }

  if (sessionState === AUTH_SESSION_LOADING) {
    return <main className={styles.loadingScreen}>Checking Super Admin session…</main>;
  }

  if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) {
    return (
      <main className={styles.loadingScreen} role="alert">
        {sessionState.error}
      </main>
    );
  }

  if (!sessionState || !hasRole(sessionState, "SUPER_ADMIN")) {
    return <main className={styles.loadingScreen}>Redirecting…</main>;
  }

  const session = sessionState;
  const canViewDeployments =
    hasPermission(session, "DEPLOYMENT_READ") || hasPermission(session, "DEPLOYMENT_MANAGE");
  const user = session.user || {};
  const fullName =
    user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Super Admin";
  const initials = fullName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function goToAccountCreate() {
    setActiveView("accounts");
    setPendingCreate((value) => value + 1);
    setSidebarOpen(false);
  }

  let content;
  if (activeView === "accounts") {
    content = (
      <AccountsPanel
        key={pendingCreate}
        initialCreateOpen={pendingCreate > 0}
        currentUserId={session.user ? session.user.id : undefined}
      />
    );
  }
  else if (activeView === "roles") content = <RolesPanel />;
  else if (activeView === "dashboards") {
    content = <DashboardsPanel onNavigate={setActiveView} onCreateAccount={goToAccountCreate} />;
  }
  else if (activeView === "clients") content = <ClientsPanel />;
  else if (activeView === "contracts") content = <ContractsPanel />;
  else if (activeView === "requisitions") content = <RequisitionsPanel session={session} />;
  else if (activeView === "deployments") content = <DeploymentsPanel session={session} />;
  else if (activeView === "attendance") content = <AttendancePanel session={session} />;
  else if (activeView === "leave") content = <LeaveManagementPanel session={session} />;
  else if (activeView === "holiday") content = <HolidayManagementPanel session={session} allowManagement={Boolean(user.permissions && user.permissions.includes("SETTINGS_MANAGE")) && (Array.isArray(user.roles) ? user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN") : false)} />;
  else if (activeView === "workers") content = <WorkerPanel session={session} />;
  else if (activeView === "compliance") content = <ExpiringDocumentsPanel session={session} />;
  else if (activeView === "payroll") content = <PayrollPanel session={session} />;
  else if (activeView === "invoices") content = <InvoicePanel session={session} />;
  else if (activeView === "candidates") content = <CandidatesPanel session={session} />;
  else if (activeView === "applications") content = <ApplicationsPanel session={session} />;
  else if (activeView === "interviews") content = <InterviewManagementPanel session={session} />;
  else if (activeView === "jobs") content = <JobsPanel session={session} />;
  else if (activeView === "contact-messages") {
    content = <ContactMessagesPanel onUnreadChange={() => setUnreadRefreshToken((token) => token + 1)} />;
  }
  else if (activeView === "enquiries") content = <EnquiriesPanel />;
  else if (activeView === "manpower-categories") content = <ManpowerCategoriesPanel />;
  else if (activeView === "skills") content = <SkillsPanel />;
  else if (activeView === "industries") content = <IndustriesPanel />;
  else if (activeView === "services") content = <ServicesPanel />;
  else if (activeView === "testimonials") content = <TestimonialsPanel />;
  else if (activeView === "settings") content = <SettingsPanel session={session} />;
  else {
    content = (
      <DashboardOverview
        session={session}
        onNavigate={setActiveView}
      />
    );
  }

  return (
    <main className={styles.adminShell}>
      {sidebarOpen && (
        <button className={styles.backdrop} aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`${styles.sidebar}${sidebarOpen ? ` ${styles.sidebarOpen}` : ""}`}>
        <Brand />
        <nav className={styles.sideNav} aria-label="Super Admin navigation">
          {sectionOrder.map((section) => {
            const items = navigation.filter(
              (item) => item.section === section && (item.view !== "deployments" || canViewDeployments),
            );
            if (!items.length) return null;
            return (
              <div className={styles.navGroup} key={section}>
                {section !== "main" && <div className={styles.navSection}>{sectionLabels[section]}</div>}
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.view;
                  const badge = item.view === "contact-messages"
                    ? (unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null)
                    : item.badge;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setActiveView(item.view);
                        setSidebarOpen(false);
                      }}
                      className={`${styles.navItem}${isActive ? ` ${styles.navActive}` : ""}`}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span>{item.label}</span>
                      {badge && <b>{badge}</b>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className={styles.payrollNotice}>
          <strong>Super Admin</strong>
          <span>Central control panel</span>
          <small>Create and manage every account, role, permission and dashboard.</small>
        </div>
        <button className={styles.signOut} type="button" onClick={() => handleLogout()} disabled={isLoggingOut}>
          <LockKeyhole size={15} />
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      <section className={styles.mainArea} id="dashboard">
        <header className={styles.topbar}>
          <button
            className={styles.mobileMenu}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="saDashboardBrand">
            <span className="saDashboardBrandIcon"><ShieldCheck size={17} strokeWidth={2.1} /></span>
            <span>Super Admin Panel</span>
          </div>
          <div className={styles.userActions} ref={userActionsRef}>
            <button
              className={styles.notification}
              aria-label={unreadCount > 0 ? `${unreadCount} unread contact messages` : "Notifications"}
              onClick={() => {
                setActiveView("contact-messages");
                setSidebarOpen(false);
                setProfileOpen(false);
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 ? <b className="notifBadge">{unreadCount > 99 ? "99+" : unreadCount}</b> : <i />}
            </button>
            <button className={styles.userProfile} aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}>
              <span className={styles.avatar}>{initials}</span>
              <span>
                <strong>{fullName}</strong>
                <small>Super Admin</small>
              </span>
              <ChevronDown size={15} />
            </button>
            {profileOpen && (
              <div className={styles.profileMenu}>
                <button type="button" className={styles.profileMenuItem} onClick={openChangePassword}>
                  <KeyRound size={13} /> Change password
                </button>
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
          {logoutError && (
            <p className={styles.actionError} role="alert">
              {logoutError}
            </p>
          )}
          {content}
        </div>
      </section>

      {changePasswordOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="sa-change-password-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="sa-change-password-title">Change password</h2>
                <p>Update the password for your Super Admin account.</p>
              </div>
              {!passwordChanged && !passwordSessionInvalid && (
                <button
                  type="button"
                  className={styles.modalClose}
                  aria-label="Close change password"
                  onClick={closeChangePassword}
                  disabled={isChangingPassword}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {passwordSuccess && (
              <p className={styles.actionSuccess} role="status">
                {passwordSuccess}
              </p>
            )}
            {passwordError && (
              <p className={styles.actionError} role="alert">
                {passwordError}
              </p>
            )}
            <form className={styles.passwordForm} onSubmit={handleChangePassword}>
              <label htmlFor="sa-current-password">Current password</label>
              <input
                id="sa-current-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={passwordChanged || isChangingPassword || passwordSessionInvalid}
              />
              <label htmlFor="sa-new-password">New password</label>
              <input
                id="sa-new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter a new password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={passwordChanged || isChangingPassword || passwordSessionInvalid}
              />
              <label htmlFor="sa-confirm-password">Confirm new password</label>
              <input
                id="sa-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={passwordChanged || isChangingPassword || passwordSessionInvalid}
              />
              <div className={styles.modalActions}>
                {passwordChanged ? (
                  <button type="button" className={styles.primaryButton} onClick={handleReturnToSignIn}>
                    Sign in again
                  </button>
                ) : passwordSessionInvalid ? (
                  <button type="button" className={styles.primaryButton} onClick={handleReturnToSignIn}>
                    Return to sign in
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={closeChangePassword}
                      disabled={isChangingPassword}
                    >
                      Cancel
                    </button>
                    <button type="submit" className={styles.primaryButton} disabled={isChangingPassword}>
                      {isChangingPassword ? "Changing…" : "Change password"}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
