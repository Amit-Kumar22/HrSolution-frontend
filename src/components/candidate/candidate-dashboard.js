"use client";

import { useMemo } from "react";
import {
  Briefcase,
  CalendarClock,
  FileText,
  ListChecks,
  Send,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Spinner } from "./candidate-ui";
import { statusLabel } from "./candidate-ui";

function completionOf(profile) {
  if (!profile) return { percent: 0, missing: ["Profile not created"] };
  const checks = [
    ["Full name", Boolean(profile.fullName)],
    ["Phone number", Boolean(profile.phone)],
    ["City", Boolean(profile.city)],
    ["State", Boolean(profile.state)],
    ["Highest qualification", Boolean(profile.highestQualification)],
    ["Preferred category", profile.preferredCategoryId !== null && profile.preferredCategoryId !== undefined],
    ["Resume uploaded", Boolean(profile.resumeDocumentId)],
  ];
  const done = checks.filter(([, ok]) => ok);
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);
  return { percent: Math.round((done.length / checks.length) * 100), missing };
}

export default function CandidateDashboard({ session, profile, profileLoading, applications, applicationsLoading, onNavigate }) {
  const name =
    (profile && profile.fullName) ||
    (session?.user?.fullName) ||
    [session?.user?.firstName, session?.user?.lastName].filter(Boolean).join(" ") ||
    "there";

  const completion = useMemo(() => completionOf(profile), [profile]);

  const apps = useMemo(() => (Array.isArray(applications) ? applications : []), [applications]);

  const summary = useMemo(() => {
    const counts = new Map();
    for (const application of apps) {
      const key = application.status || "UNKNOWN";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries());
  }, [apps]);

  const upcoming = useMemo(
    () =>
      apps
        .filter((application) => application.nextInterviewAt && !application.terminal)
        .sort((a, b) => Date.parse(a.nextInterviewAt) - Date.parse(b.nextInterviewAt))
        .slice(0, 5),
    [apps],
  );

  return (
    <div className="cp-stack">
      <section className="cp-hero">
        <div>
          <h2>Welcome back, {name}</h2>
          <p>Track your job search, applications and interviews from one place.</p>
        </div>
        <button type="button" className="authButton cp-inlineButton" onClick={() => onNavigate("jobs")}>
          <Briefcase size={15} /> Browse jobs
        </button>
      </section>

      <div className="cp-statGrid">
        <div className="cp-stat">
          <span className="cp-statIcon"><Send size={16} /></span>
          <div>
            <strong>{profileLoading || applicationsLoading ? "…" : apps.length}</strong>
            <span>Total applications</span>
          </div>
        </div>
        <div className="cp-stat">
          <span className="cp-statIcon"><TrendingUp size={16} /></span>
          <div>
            <strong>{completion.percent}%</strong>
            <span>Profile completed</span>
          </div>
        </div>
        <div className="cp-stat">
          <span className="cp-statIcon"><CalendarClock size={16} /></span>
          <div>
            <strong>{upcoming.length}</strong>
            <span>Upcoming interviews</span>
          </div>
        </div>
        <div className="cp-stat">
          <span className="cp-statIcon"><FileText size={16} /></span>
          <div>
            <strong>{profile && profile.resumeDocumentId ? "Ready" : "Missing"}</strong>
            <span>Resume status</span>
          </div>
        </div>
      </div>

      <div className="cp-dashboardGrid">
        <section className="cp-panel">
          <div className="cp-panelHead">
            <div>
              <h2>Profile completion</h2>
              <p>Complete your profile to appear in more recruiter searches.</p>
            </div>
          </div>
          {profileLoading ? (
            <Spinner label="Checking your profile…" />
          ) : (
            <>
              <div className="cp-progressBig" role="progressbar" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100}>
                <span className="cp-progressBigBar" style={{ width: `${completion.percent}%` }} />
              </div>
              <p className="cp-hint">{completion.percent}% complete</p>
              {completion.missing.length > 0 ? (
                <ul className="cp-missing">
                  {completion.missing.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p className="cp-completeNote">All profile details are complete.</p>
              )}
              <div className="cp-quickLinks">
                <button type="button" className="cp-linkButton" onClick={() => onNavigate("profile")}>
                  <UserRound size={13} /> {profile ? "Edit profile" : "Complete profile"}
                </button>
                <button type="button" className="cp-linkButton" onClick={() => onNavigate("resume")}>
                  <FileText size={13} /> Manage resume
                </button>
              </div>
            </>
          )}
        </section>

        <section className="cp-panel">
          <div className="cp-panelHead">
            <div>
              <h2>Application status</h2>
              <p>A snapshot of where your applications currently stand.</p>
            </div>
          </div>
          {applicationsLoading ? (
            <Spinner label="Loading applications…" />
          ) : summary.length === 0 ? (
            <p className="cp-hint">No applications yet. Browse jobs to apply for your first role.</p>
          ) : (
            <ul className="cp-summaryList">
              {summary.map(([status, count]) => (
                <li key={status}>
                  <span className={`cp-dot cp-dot--${status.toLowerCase()}`} />
                  <span className="cp-summaryLabel">{statusLabel({ status })}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cp-panel cp-panel--wide">
          <div className="cp-panelHead">
            <div>
              <h2>Upcoming interviews</h2>
              <p>Scheduled conversations with recruiters.</p>
            </div>
          </div>
          {applicationsLoading ? (
            <Spinner label="Loading interviews…" />
          ) : upcoming.length === 0 ? (
            <p className="cp-hint">No interviews scheduled yet.</p>
          ) : (
            <ul className="cp-interviewList">
              {upcoming.map((application) => (
                <li key={application.id}>
                  <span className="cp-interviewIcon"><CalendarClock size={15} /></span>
                  <div>
                    <strong>{application.jobTitle || "Interview"}</strong>
                    <span>
                      {new Date(application.nextInterviewAt).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button type="button" className="cp-linkButton" onClick={() => onNavigate("applications")}>
                    <ListChecks size={13} /> Details
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
