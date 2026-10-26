"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  Clock3,
  KeyRound,
  Layers,
  Lock,
  MapPin,
  ShieldCheck,
  UserSearch,
  Users,
} from "lucide-react";
import {
  interviewModeLabel,
  interviewResultLabel,
  jobStatusLabel,
  jobStatusTone,
  listApplications,
  listCandidates,
  listInterviews,
  listJobs,
} from "@/lib/adminApi";
import { humanize, moduleIcon, moduleLabel, moduleTone } from "@/lib/permission-modules";
import { listPublicJobs } from "@/lib/publicApi";
import { Chip, EmptyState, LoadingState, Notice } from "@/app/admin/admin-ui";
import { UrgentRequisitionsWidget } from "@/app/admin/requisitions-panel";

const STATUS_TONES = {
  ACTIVE: { label: "Active", tone: "active" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "pending" },
  PENDING: { label: "Pending approval", tone: "pending" },
  DISABLED: { label: "Disabled", tone: "blocked" },
  REJECTED: { label: "Rejected", tone: "blocked" },
  BLOCKED: { label: "Blocked", tone: "blocked" },
};

const QUICK_ACTIONS = [
  { view: "candidates", label: "Candidates", hint: "Search and tag profiles", icon: UserSearch, tone: "indigo" },
  { view: "jobs", label: "Vacancies", hint: "Open and close roles", icon: Layers, tone: "blue" },
  { view: "interviews", label: "Interviews", hint: "Schedule and record rounds", icon: CalendarClock, tone: "amber" },
  { view: "clients", label: "Clients", hint: "Sites and headcount", icon: Building2, tone: "green" },
];

function accountStatus(status) {
  const key = String(status || "").toUpperCase();
  return STATUS_TONES[key] || { label: humanize(key) || "Unknown", tone: "unknown" };
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Kpi({ icon: Icon, tone, label, value, note, loading }) {
  return (
    <article className="hrKpi">
      <div className="hrKpiTop">
        <span>{label}</span>
        <i className={`hrIconTile hrTone-${tone}`}>
          <Icon size={16} />
        </i>
      </div>
      <strong className="hrKpiValue">{loading ? "—" : value}</strong>
      <p>{note}</p>
    </article>
  );
}

export default function HrOverview({ user, roles, permissions, modules, permissionMeta, catalogueTotal, onNavigate }) {
  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  );
  const [jobs, setJobs] = useState({ content: [], totalElements: 0 });
  const [candidates, setCandidates] = useState({ content: [], totalElements: 0 });
  const [interviews, setInterviews] = useState({ content: [], totalElements: 0, upcomingCount: 0, now: 0 });
  const [interviewsError, setInterviewsError] = useState("");
  const [interviewTab, setInterviewTab] = useState("ALL");
  const [applications, setApplications] = useState({ content: [], totalElements: 0 });
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");

  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
  const firstName = user.firstName || fullName.split(/\s+/)[0] || "there";
  const status = accountStatus(user.status);

  const grantedKeys = useMemo(() => new Set(modules.map((module) => module.module)), [modules]);
  const catalogueReady = modules.length > 0 || (permissions && permissions.length > 0);
  const canView = useMemo(
    () => ({
      candidates: !catalogueReady || grantedKeys.has("RECRUITMENT") || grantedKeys.has("WORKFORCE"),
      jobs: !catalogueReady || grantedKeys.has("RECRUITMENT"),
      interviews: !catalogueReady || grantedKeys.has("RECRUITMENT"),
      clients: !catalogueReady || grantedKeys.has("CLIENT"),
    }),
    [grantedKeys, catalogueReady],
  );

  useEffect(() => {
    let cancelled = false;
    const from = new Date().toISOString();

    async function load(call, apply) {
      try {
        const data = await call();
        if (cancelled) return;
        apply(data);
      } catch (error) {
        if (cancelled) return;
        setError(
          error && typeof error.message === "string" && error.message
            ? error.message
            : "This list could not be loaded for your role.",
        );
      }
    }

    const calls = [];
    calls.push(loadVacancies());
    if (canView.candidates) {
      calls.push(load(() => listCandidates({ page: 0, size: 1, sort: ["createdAt,DESC"] }), setCandidates));
      calls.push(load(() => listApplications({ page: 0, size: 1, sort: ["appliedOn,DESC"] }), setApplications));
    }
    calls.push(loadInterviews());

    Promise.all(calls).then(() => {
      if (!cancelled) setState("ready");
    });

    return () => {
      cancelled = true;
    };

    async function loadInterviews() {
      try {
        const data = await listInterviews({ page: 0, size: 50, sort: ["scheduledAt,ASC"] });
        if (cancelled) return;
        const rows = data.content || [];
        const now = Date.now();
        const upcoming = rows.filter((row) => {
          const when = Date.parse(row.scheduledAt || "");
          return Number.isNaN(when) ? false : when >= now;
        });
        setInterviews({
          content: rows,
          totalElements: data.totalElements || rows.length,
          upcomingCount: upcoming.length,
          now,
        });
      } catch (error) {
        if (cancelled) return;
        setInterviewsError(
          error && typeof error.message === "string" && error.message
            ? error.message
            : "Interviews could not be loaded for your role.",
        );
        try {
          const data = await listInterviews({
            from: new Date().toISOString(),
            page: 0,
            size: 5,
            sort: ["scheduledAt,ASC"],
          });
          if (cancelled) return;
          const rows = data.content || [];
          setInterviews({
            content: rows,
            totalElements: data.totalElements || rows.length,
            upcomingCount: rows.length,
            now: Date.now(),
          });
        } catch {
          // Keep the inline error message.
        }
      }
    }

    async function loadVacancies() {
      try {
        const data = await listJobs({ page: 0, size: 25, sort: ["createdAt,DESC"] });
        const rows = (data.content || []).filter(
          (job) => !job.status || job.status === "OPEN" || job.status === "PUBLISHED" || job.status === "ACTIVE",
        );
        if (rows.length) {
          if (!cancelled) setJobs({ content: rows.slice(0, 5), totalElements: rows.length });
          return;
        }
      } catch {
        // Fall through to the public vacancies feed below.
      }
      try {
        const data = await listPublicJobs({ page: 0, size: 5 });
        if (cancelled) return;
        setJobs({ content: data.content || [], totalElements: data.totalElements || 0 });
      } catch (error) {
        if (cancelled) return;
        setError(
          error && typeof error.message === "string" && error.message
            ? error.message
            : "Vacancies could not be loaded right now.",
        );
      }
    }
  }, [canView]);

  const permissionShare = useMemo(() => {
    if (!catalogueTotal) return 0;
    return Math.min(100, Math.round((permissions.length / catalogueTotal) * 100));
  }, [permissions.length, catalogueTotal]);

  const interviewTabs = useMemo(() => {
    const rows = interviews.content || [];
    const now = interviews.now || 0;
    const upcoming = rows.filter((row) => {
      const when = Date.parse(row.scheduledAt || "");
      return Number.isNaN(when) ? false : when >= now;
    });
    const awaiting = rows.filter(
      (row) => row.awaitingFeedback === true || (row.result === "PENDING" && row.upcoming === false),
    );
    const completed = rows.filter((row) => row.result && row.result !== "PENDING");
    return [
      { value: "ALL", label: "All", count: rows.length },
      { value: "UPCOMING", label: "Upcoming", count: upcoming.length },
      { value: "AWAITING", label: "Awaiting feedback", count: awaiting.length },
      { value: "COMPLETED", label: "Completed", count: completed.length },
    ];
  }, [interviews.content, interviews.now]);

  const interviewRows = useMemo(() => {
    const rows = interviews.content || [];
    const now = interviews.now || 0;
    if (interviewTab === "UPCOMING") {
      return rows.filter((row) => {
        const when = Date.parse(row.scheduledAt || "");
        return Number.isNaN(when) ? false : when >= now;
      });
    }
    if (interviewTab === "AWAITING") {
      return rows.filter(
        (row) => row.awaitingFeedback === true || (row.result === "PENDING" && row.upcoming === false),
      );
    }
    if (interviewTab === "COMPLETED") {
      return rows.filter((row) => row.result && row.result !== "PENDING");
    }
    return rows;
  }, [interviews.content, interviews.now, interviewTab]);

  const loading = state === "loading";

  return (
    <div className="hrOverview">
      <section className="hrHero">
        <div className="hrHeroText">
          <p className="hrEyebrow">HR workspace</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="hrHeroLead">
            Recruitment, candidate pipeline and interview schedules for your role — everything the server
            allows you to see.
          </p>
        </div>
        <div className="hrHeroAside">
          <span className={`hrStatusPill hrStatusPill--${status.tone}`}>
            <i />
            {status.label}
          </span>
          <span className="hrHeroDate" suppressHydrationWarning>
            {today}
          </span>
          <span className="hrHeroEmail">{user.email || "—"}</span>
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      <section className="hrKpis" aria-label="Hiring summary">
        <Kpi
          icon={Layers}
          tone="blue"
          label="Open vacancies"
          value={jobs.totalElements}
          loading={loading}
          note={jobs.content.length ? `${jobs.content.length} most recent on top` : "Live openings right now"}
        />
        <Kpi
          icon={Users}
          tone="indigo"
          label="Candidates"
          value={candidates.totalElements}
          loading={loading}
          note="Profiles in your workspace"
        />
        <Kpi
          icon={CircleCheck}
          tone="green"
          label="Applications"
          value={applications.totalElements}
          loading={loading}
          note="Received across all roles"
        />
        <Kpi
          icon={CalendarCheck}
          tone="amber"
          label="Interviews ahead"
          value={interviews.upcomingCount || interviews.totalElements}
          loading={loading}
          note={`${interviews.totalElements} total scheduled`}
        />
      </section>

      <div className="hrLayout">
        <section className="hrPanel" aria-label="Open vacancies">
          <div className="hrPanelHead">
            <div>
              <h2>Open vacancies</h2>
              <p>Roles you can staff right now, newest first.</p>
            </div>
            <div className="hrPanelActions">
              {!loading && (
                <span className="hrCount">
                  {jobs.totalElements} open job{jobs.totalElements === 1 ? "" : "s"}
                </span>
              )}
              <button type="button" className="hrLinkButton" onClick={() => onNavigate("jobs")}>
                Manage jobs <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingState label="Loading open vacancies…" />
          ) : !jobs.content.length ? (
            <EmptyState
              icon={Layers}
              title="No open vacancies"
              message="Publish a job to start receiving candidate applications."
            />
          ) : (
            <ul className="hrJobList">
              {jobs.content.map((job) => (
                <li className="hrJobRow" key={job.id || job.slug}>
                  <div className="hrJobMain">
                    <strong>{job.title || `Job #${job.id}`}</strong>
                    <span>
                      <MapPin size={12} /> {job.location || [job.city, job.state].filter(Boolean).join(", ") || "—"}
                      {job.categoryName ? ` · ${job.categoryName}` : ""}
                    </span>
                  </div>
                  <div className="hrJobMeta">
                    <span className="hrJobOpenings">
                      {job.openings ?? "—"} opening{job.openings === 1 ? "" : "s"}
                    </span>
                    {job.status ? (
                      <Chip tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Chip>
                    ) : (
                      <Chip tone="success">Open</Chip>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="hrAside">
          <section className="hrPanel" aria-label="Quick actions">
            <div className="hrPanelHead">
              <div>
                <h2>Quick actions</h2>
                <p>Jump straight into your day-to-day work.</p>
              </div>
            </div>
            <div className="hrActionGrid">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button type="button" className="hrAction" key={action.view} onClick={() => onNavigate(action.view)}>
                    <i className={`hrIconTile hrTone-${action.tone}`}>
                      <Icon size={15} />
                    </i>
                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.hint}</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="hrPanel" aria-label="Your access">
            <div className="hrPanelHead">
              <div>
                <h2>Your access</h2>
                <p>Recomputed by the server on every request.</p>
              </div>
            </div>
            <dl className="hrFacts">
              <div>
                <dt>Signed in as</dt>
                <dd>{fullName}</dd>
              </div>
              <div>
                <dt>Primary role</dt>
                <dd>{roles.length ? humanize(roles[0]) : "—"}</dd>
              </div>
              <div>
                <dt>Permissions</dt>
                <dd>
                  {permissions.length}
                  {catalogueTotal ? ` of ${catalogueTotal}` : ""}
                </dd>
              </div>
            </dl>
            <div className="hrMeter" role="img" aria-label={`${permissionShare}% of permissions granted`}>
              <span style={{ width: `${permissionShare}%` }} />
            </div>
            <button type="button" className="hrLinkButton" onClick={() => onNavigate("access")}>
              Review every permission <ArrowUpRight size={14} />
            </button>
          </section>
        </aside>
      </div>

      <section className="hrPanel" aria-label="Upcoming interviews">
        <div className="hrPanelHead">
          <div>
            <h2>Interviews</h2>
            <p>Same schedule as the Interview management screen.</p>
          </div>
          <div className="hrPanelActions">
            {!loading && !interviewsError && (
              <span className="hrCount">
                {interviews.totalElements} interview{interviews.totalElements === 1 ? "" : "s"}
              </span>
            )}
            <button type="button" className="hrLinkButton" onClick={() => onNavigate("interviews")}>
              Open interviews <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {!loading && !interviewsError && interviews.content.length > 0 && (
          <div className="hrTabBar" role="tablist" aria-label="Interview views">
            {interviewTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={interviewTab === tab.value}
                className={`hrTab${interviewTab === tab.value ? " hrTabActive" : ""}`}
                onClick={() => setInterviewTab(tab.value)}
              >
                {tab.label} <span>{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <LoadingState label="Loading interview schedule…" />
        ) : interviewsError ? (
          <EmptyState
            icon={Lock}
            title="Interviews could not be loaded"
            message={interviewsError}
          />
        ) : !interviews.content.length ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled"
            message="Interviews scheduled from today will show up here."
          />
        ) : !interviewRows.length ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing in this view"
            message="Switch to another view to see the remaining interview rounds."
          />
        ) : (
          <div className="cmTableWrap hrTable">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Application</th>
                  <th>Round</th>
                  <th>Scheduled</th>
                  <th>Duration</th>
                  <th>Mode</th>
                  <th>Venue / link</th>
                  <th>Interviewer</th>
                  <th>Result</th>
                  <th>Rating</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {interviewRows.slice(0, 8).map((interview) => (
                  <tr key={interview.id}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile">
                          <UserSearch size={15} />
                        </span>
                        <span>
                          <strong>{interview.candidateName || "—"}</strong>
                          <small>#{interview.id}</small>
                        </span>
                      </div>
                    </td>
                    <td className="cmMuted">{interview.jobTitle || "—"}</td>
                    <td>
                      <span className="cmCode">
                        {interview.applicationId ? `#${interview.applicationId}` : "—"}
                      </span>
                    </td>
                    <td>
                      <span className="cmCode">{interview.roundNumber ? `Round ${interview.roundNumber}` : "—"}</span>
                    </td>
                    <td className="cmMuted">
                      <span className="hrWhen">
                        <Clock3 size={12} /> {formatDateTime(interview.scheduledAt)}
                      </span>
                    </td>
                    <td className="cmMuted">
                      {interview.durationMinutes ? `${interview.durationMinutes} min` : "—"}
                    </td>
                    <td className="cmMuted">{interviewModeLabel(interview.mode)}</td>
                    <td className="cmMuted cmCellWrap">{interview.venueOrLink || "—"}</td>
                    <td className="cmMuted">{interview.interviewerName || "—"}</td>
                    <td>
                      <Chip tone={interview.result && interview.result !== "PENDING" ? "success" : "neutral"}>
                        {interviewResultLabel(interview.result)}
                      </Chip>
                    </td>
                    <td className="cmMuted">
                      {interview.rating != null && interview.rating !== "" ? interview.rating : "—"}
                    </td>
                    <td className="cmMuted hrFeedbackCell">{interview.feedback || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modules.length > 0 && (
        <section className="hrPanel" aria-label="Authorised modules">
          <div className="hrPanelHead">
            <div>
              <h2>Authorised modules</h2>
              <p>Each card lists what your role can do inside that module.</p>
            </div>
            <span className="hrCount">
              {modules.length} module{modules.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="hrModuleGrid">
            {modules.map((module) => {
              const Icon = moduleIcon(module.module);
              const tone = moduleTone(module.module);
              const visible = module.items.slice(0, 4);
              const hidden = module.items.length - visible.length;
              return (
                <article className="hrModule" key={module.module}>
                  <div className="hrModuleHead">
                    <i className={`hrIconTile hrTone-${tone}`}>
                      <Icon size={16} />
                    </i>
                    <div>
                      <strong>{module.label || moduleLabel(module.module)}</strong>
                      <small>
                        {module.items.length} permission{module.items.length === 1 ? "" : "s"}
                      </small>
                    </div>
                  </div>
                  <div className="hrChips">
                    {visible.map((item) => {
                      const meta = permissionMeta ? permissionMeta.get(item) : null;
                      return (
                        <span className="hrChip" key={item} title={meta && meta.description ? meta.description : item}>
                          {humanize(item)}
                        </span>
                      );
                    })}
                    {hidden > 0 && <span className="hrChip hrChip--more">+{hidden} more</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="hrPanel" aria-label="Urgent to Fill" style={{ marginTop: 18 }}>
        <UrgentRequisitionsWidget onNavigate={onNavigate} />
      </section>

      <p className="hrFootnote">
        <ShieldCheck size={13} /> Everything on this page is derived from the permissions granted to{" "}
        {roles.length ? humanize(roles[0]) : "your role"} — they cannot be changed from the browser.
      </p>
    </div>
  );
}
