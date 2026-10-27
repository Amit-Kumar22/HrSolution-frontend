"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import {
  AUTH_SESSION_ERROR,
  AUTH_SESSION_LOADING,
  getAuthSessionSnapshot,
  getDashboardPath,
  getServerAuthSnapshot,
  getUnauthenticatedRedirectPath,
  isCandidateRole,
  logout,
  subscribeToAuthSession,
} from "@/lib/auth";
import { getCandidateProfile, listApplications } from "@/lib/candidateApi";
import CandidateDashboard from "./candidate-dashboard";
import CandidateProfile from "./candidate-profile";
import CandidateResume from "./candidate-resume";
import CandidateJobs from "./candidate-jobs";
import CandidateApplications from "./candidate-applications";
import CandidateAccount from "./candidate-account";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "profile", label: "My Profile", icon: UserRound },
  { id: "resume", label: "My Resume", icon: FileText },
  { id: "jobs", label: "Browse Jobs", icon: Briefcase },
  { id: "applications", label: "My Applications", icon: ListChecks },
  { id: "account", label: "Account Settings", icon: Settings },
];

function isUnauthorized(error) {
  return Boolean(error && error.status === 401);
}

function errorText(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function CandidatePortal() {
  const router = useRouter();
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );

  const [activeTab, setActiveTab] = useState("dashboard");
  const [profileState, setProfileState] = useState({ loading: true, data: undefined, error: "" });
  const [appsState, setAppsState] = useState({ loading: true, data: [], error: "" });

  const session = useMemo(
    () => (sessionState && typeof sessionState === "object" && sessionState.accessToken ? sessionState : null),
    [sessionState],
  );
  const tabs = TABS;

  const redirectToLogin = useCallback(() => {
    router.replace(getUnauthenticatedRedirectPath());
  }, [router]);

  // Initial data load. setState only happens after the awaited fetch resolves.
  useEffect(() => {
    if (!session || !isCandidateRole(session)) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const data = await getCandidateProfile();
        if (!cancelled) setProfileState({ loading: false, data: data || null, error: "" });
      } catch (error) {
        if (cancelled) return;
        if (isUnauthorized(error)) {
          redirectToLogin();
          return;
        }
        setProfileState({ loading: false, data: null, error: errorText(error, "Your profile could not be loaded.") });
      }
    })();

    (async () => {
      try {
        const data = await listApplications();
        if (!cancelled) setAppsState({ loading: false, data, error: "" });
      } catch (error) {
        if (cancelled) return;
        if (isUnauthorized(error)) {
          redirectToLogin();
          return;
        }
        setAppsState({ loading: false, data: [], error: errorText(error, "Your applications could not be loaded.") });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, redirectToLogin]);

  // Event-driven refreshes (used by retry buttons and after apply/upload).
  const refreshProfile = useCallback(() => {
    setProfileState((current) => ({ ...current, loading: true, error: "" }));
    return getCandidateProfile()
      .then((data) => {
        setProfileState({ loading: false, data: data || null, error: "" });
        return data;
      })
      .catch((error) => {
        if (isUnauthorized(error)) {
          redirectToLogin();
          return null;
        }
        setProfileState({ loading: false, data: null, error: errorText(error, "Your profile could not be loaded.") });
        return null;
      });
  }, [redirectToLogin]);

  const refreshApplications = useCallback(() => {
    setAppsState((current) => ({ ...current, loading: true, error: "" }));
    return listApplications()
      .then((data) => {
        setAppsState({ loading: false, data, error: "" });
        return data;
      })
      .catch((error) => {
        if (isUnauthorized(error)) {
          redirectToLogin();
          return [];
        }
        setAppsState({ loading: false, data: [], error: errorText(error, "Your applications could not be loaded.") });
        return [];
      });
  }, [redirectToLogin]);

  useEffect(() => {
    if (sessionState === AUTH_SESSION_LOADING) return;
    if (!sessionState || (sessionState && "error" in sessionState)) {
      if (!sessionState) redirectToLogin();
      return;
    }
    if (!isCandidateRole(sessionState)) {
      router.replace(getDashboardPath(sessionState));
    }
  }, [sessionState, router, redirectToLogin]);

  async function handleSignOut() {
    try {
      await logout(session, false);
    } finally {
      window.location.replace("/");
    }
  }

  if (sessionState === AUTH_SESSION_LOADING) {
    return (
      <main className="cp-shell">
        <div className="cp-centeredState">Loading your candidate portal…</div>
      </main>
    );
  }

  if (sessionState === AUTH_SESSION_ERROR) {
    return (
      <main className="cp-shell">
        <div className="cp-centeredState cp-centeredState--error" role="alert">
          Could not read the sign-in session from this browser. Please sign in again.
        </div>
      </main>
    );
  }

  if (!session || !isCandidateRole(session)) {
    return (
      <main className="cp-shell">
        <div className="cp-centeredState">Taking you to the right dashboard…</div>
      </main>
    );
  }

  const displayName =
    (profileState.data && profileState.data.fullName) ||
    session.user.fullName ||
    [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") ||
    session.user.email;

  return (
    <main className="cp-shell">
      <header className="cp-topbar">
        <Link href="/" className="cp-brand" aria-label="Shakti Manpower home">
          <span className="cp-brandMark">S</span>
          <span className="cp-brandCopy">
            <strong>Shakti Manpower</strong>
            <small>Candidate Portal</small>
          </span>
        </Link>
        <div className="cp-topbarRight">
          <span className="cp-user" title={session.user.email}>
            <UserRound size={15} /> {displayName}
          </span>
          <button type="button" className="cp-topbarButton" onClick={handleSignOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <nav className="cp-tabs" aria-label="Candidate portal sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`cp-tab${active ? " cp-tab--active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="cp-content">
        {activeTab === "dashboard" && (
          <CandidateDashboard
            session={session}
            profile={profileState.data}
            profileLoading={profileState.loading}
            applications={appsState.data}
            applicationsLoading={appsState.loading}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === "profile" && (
          <CandidateProfile
            profile={profileState.data}
            loading={profileState.loading}
            error={profileState.error}
            session={session}
            onRefresh={refreshProfile}
            onSaved={(updated) => setProfileState({ loading: false, data: updated || null, error: "" })}
          />
        )}

        {activeTab === "resume" && (
          <CandidateResume
            profile={profileState.data}
            loading={profileState.loading}
            error={profileState.error}
            onRefresh={refreshProfile}
            onUploaded={(updated) => {
              setProfileState({ loading: false, data: updated || null, error: "" });
              refreshApplications();
            }}
          />
        )}

        {activeTab === "jobs" && (
          <CandidateJobs
            profile={profileState.data}
            onNavigateResume={() => setActiveTab("resume")}
            onApplied={() => {
              refreshApplications();
              refreshProfile();
            }}
          />
        )}

        {activeTab === "applications" && (
          <CandidateApplications
            applications={appsState.data}
            loading={appsState.loading}
            error={appsState.error}
            onRefresh={refreshApplications}
            onBrowseJobs={() => setActiveTab("jobs")}
          />
        )}

        {activeTab === "account" && <CandidateAccount session={session} />}
      </div>
    </main>
  );
}
