"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  IdCard,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import {
  AUTH_SESSION_ERROR,
  AUTH_SESSION_LOADING,
  getAuthSessionSnapshot,
  getDashboardPath,
  getServerAuthSnapshot,
  getUnauthenticatedRedirectPath,
  isWorkerRole,
  logout,
  subscribeToAuthSession,
} from "@/lib/auth";
import CandidateAccount from "@/components/candidate/candidate-account";
import CandidateWorkerProfile from "@/components/candidate/candidate-worker-profile";
import HolidayManagementPanel from "@/app/admin/holiday-panel";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "profile", label: "My Worker Profile", icon: IdCard },
  { id: "account", label: "Account Settings", icon: Settings },
];

export default function WorkerPortal() {
  const router = useRouter();
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (sessionState === AUTH_SESSION_LOADING || sessionState === AUTH_SESSION_ERROR) return;
    if (!sessionState) {
      router.replace(getUnauthenticatedRedirectPath());
      return;
    }
    if (!isWorkerRole(sessionState)) {
      router.replace(getDashboardPath(sessionState));
    }
  }, [router, sessionState]);

  async function handleSignOut() {
    if (!sessionState || isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout(sessionState);
    } finally {
      window.location.replace("/");
    }
  }

  if (sessionState === AUTH_SESSION_LOADING) {
    return <main className="workerPortalState">Loading your worker portal…</main>;
  }
  if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) {
    return <main className="workerPortalState" role="alert">{sessionState.error}</main>;
  }
  if (!sessionState || !isWorkerRole(sessionState)) {
    return <main className="workerPortalState">Taking you to the right dashboard…</main>;
  }

  const user = sessionState.user || {};
  const displayName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Worker";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="workerPortal">
      <header className="workerPortalTopbar">
        <Link href="/" className="workerPortalBrand" aria-label="Shakti Manpower home">
          <span className="workerPortalBrandMark">S</span>
          <span>
            <strong>Shakti Manpower</strong>
            <small>Worker Portal</small>
          </span>
        </Link>
        <div className="workerPortalUser">
          <span className="workerPortalAvatar">{initials}</span>
          <span className="workerPortalUserName" title={user.email || displayName}>{displayName}</span>
          <button type="button" className="workerPortalSignOut" onClick={handleSignOut} disabled={isLoggingOut}>
            <LogOut size={15} /> {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <nav className="workerPortalTabs" aria-label="Worker portal sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`workerPortalTab${active ? " workerPortalTabActive" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="workerPortalContent">
        {activeTab === "dashboard" && (
          <section className="workerPortalWelcome">
            <div className="workerPortalWelcomeCopy">
              <span className="workerPortalEyebrow">Your workspace</span>
              <h1>Welcome, {user.firstName || displayName.split(/\s+/)[0]}</h1>
              <p>Access your worker details, deployment history and the documents maintained by your HR team.</p>
            </div>
            <button type="button" className="workerPortalPrimary" onClick={() => setActiveTab("profile")}>
              <IdCard size={16} /> View my profile
            </button>
          </section>
        )}

        {activeTab === "profile" && <CandidateWorkerProfile session={sessionState} />}
        {activeTab === "account" && <CandidateAccount session={sessionState} />}
      </div>
    </main>
  );
}
