"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Inbox,
  Kanban,
  Mail,
  TriangleAlert,
  UserSearch,
} from "lucide-react";
import {
  applicationStatusLabel,
  applicationStatusTone,
  getUnreadContactCount,
  jobStatusLabel,
  jobStatusTone,
  listApplications,
  listCandidates,
  listClients,
  listEnquiries,
  listJobs,
} from "../../lib/adminApi";
import { humanize, moduleLabel, moduleOf } from "../../lib/permission-modules";
import { Chip, formatDateTime } from "./admin-ui";
import { UrgentRequisitionsWidget } from "./requisitions-panel";

const ACCOUNT_TONES = {
  ACTIVE: { label: "Active", tone: "success" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warn" },
  PENDING: { label: "Pending approval", tone: "warn" },
  DISABLED: { label: "Disabled", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
  BLOCKED: { label: "Blocked", tone: "danger" },
};

const ENQUIRY_TONES = {
  NEW: { label: "New", tone: "info" },
  CONTACTED: { label: "Contacted", tone: "warn" },
  QUALIFIED: { label: "Qualified", tone: "accent" },
  CONVERTED: { label: "Converted", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  SPAM: { label: "Spam", tone: "danger" },
};

const CLIENT_TONES = {
  ACTIVE: { label: "Active", tone: "success" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warn" },
  SUSPENDED: { label: "Suspended", tone: "warn" },
  DISABLED: { label: "Disabled", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const QUICK_ACTIONS = [
  { view: "clients", label: "Clients", hint: "Accounts and sites", icon: Building2, tone: "blue" },
  { view: "requisitions", label: "Requisitions", hint: "Raise and approve demand", icon: BriefcaseBusiness, tone: "indigo" },
  { view: "enquiries", label: "Enquiries", hint: "New client requests", icon: Inbox, tone: "amber" },
  { view: "applications", label: "Applications", hint: "Hiring pipeline", icon: Kanban, tone: "green" },
];

function accountStatus(status) {
  const key = String(status || "").toUpperCase();
  return ACCOUNT_TONES[key] || { label: humanize(key) || "Unknown", tone: "neutral" };
}

function enquiryStatus(status) {
  return ENQUIRY_TONES[status] || { label: humanize(status) || "New", tone: "neutral" };
}

function clientStatus(status) {
  const key = String(status || "").toUpperCase();
  return CLIENT_TONES[key] || { label: humanize(key) || "Unknown", tone: "neutral" };
}

function Kpi({ icon: Icon, tone, label, value, note, loading, onClick }) {
  const Wrapper = onClick ? "button" : "article";
  return (
    <Wrapper type={onClick ? "button" : undefined} className="adKpi" onClick={onClick}>
      <div className="adKpiTop">
        <span>{label}</span>
        <i className={`adIconTile adTone-${tone}`}>
          <Icon size={15} />
        </i>
      </div>
      <strong className="adKpiValue">{loading ? "—" : value}</strong>
      <p>{note}</p>
    </Wrapper>
  );
}

export default function DashboardOverview({ session, onNavigate }) {
  const [clients, setClients] = useState({ content: [], totalElements: 0 });
  const [jobs, setJobs] = useState({ content: [], totalElements: 0 });
  const [candidates, setCandidates] = useState({ content: [], totalElements: 0 });
  const [applications, setApplications] = useState({ content: [], totalElements: 0 });
  const [enquiries, setEnquiries] = useState({ content: [], totalElements: 0 });
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState([]);
  const [state, setState] = useState("loading");

  const user = (session && session.user) || {};
  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Admin";
  const firstName = user.firstName || fullName.split(/\s+/)[0] || "Admin";
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = useMemo(
    () => (Array.isArray(user.permissions) ? user.permissions.filter((item) => typeof item === "string") : []),
    [user.permissions],
  );
  const status = accountStatus(user.status);

  const permissionModules = useMemo(() => {
    const seen = [];
    permissions.forEach((permission) => {
      const permissionModule = moduleOf(permission);
      if (!seen.includes(permissionModule)) seen.push(permissionModule);
    });
    return seen.map((permissionModule) => moduleLabel(permissionModule));
  }, [permissions]);

  useEffect(() => {
    let cancelled = false;
    const problems = [];

    async function load(label, call, apply) {
      try {
        const data = await call();
        if (cancelled) return;
        apply(data);
      } catch {
        if (cancelled) return;
        problems.push(label);
      }
    }

    const calls = [
      load("Clients", () => listClients({ page: 0, size: 5, sort: ["legalName,ASC"] }), setClients),
      load("Requisitions", () => listJobs({ page: 0, size: 5, sort: ["createdAt,DESC"] }), setJobs),
      load("Candidates", () => listCandidates({ page: 0, size: 1, sort: ["createdAt,DESC"] }), setCandidates),
      load("Applications", () => listApplications({ page: 0, size: 5, sort: ["appliedOn,DESC"] }), setApplications),
      load("Enquiries", () => listEnquiries({ page: 0, size: 5, sort: ["createdAt,DESC"] }), setEnquiries),
      load("Messages", () => getUnreadContactCount(), (count) => setUnread(Number.isFinite(count) ? count : 0)),
    ];

    Promise.all(calls).then(() => {
      if (cancelled) return;
      setFailed(problems);
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const openJobs = useMemo(
    () => (jobs.content || []).filter((job) => !job.status || job.status === "OPEN" || job.status === "PUBLISHED"),
    [jobs.content],
  );

  const loading = state === "loading";

  return (
    <div className="adOverview">
      <section className="adHero">
        <div className="adHeroText">
          <p className="adEyebrow">Admin console</p>
          <h1>Good morning, {firstName}</h1>
          <p className="adHeroLead">Live counts across clients, requisitions, pipeline and leads — straight from the server.</p>
        </div>
        <div className="adHeroAside">
          <span className={`adStatusPill adStatusPill--${status.tone}`}>
            <i />
            {status.label}
          </span>
          <span className="adHeroDate" suppressHydrationWarning>
            {formatDateTime(new Date())}
          </span>
          <span className="adHeroEmail">{user.email || "—"}</span>
        </div>
      </section>

      {failed.length > 0 && (
        <p className="adWarn" role="status">
          <TriangleAlert size={13} /> Some counters could not be loaded: {failed.join(", ")}.
        </p>
      )}

      <section className="adKpis" aria-label="Workspace summary">
        <Kpi icon={Building2} tone="blue" label="Clients" value={clients.totalElements} loading={loading} note="Active accounts on file" />
        <Kpi icon={BriefcaseBusiness} tone="indigo" label="Requisitions" value={jobs.totalElements} loading={loading} note={`${openJobs.length} shown open`} />
        <Kpi icon={UserSearch} tone="green" label="Candidates" value={candidates.totalElements} loading={loading} note="Profiles in the pipeline" />
        <Kpi icon={Kanban} tone="amber" label="Applications" value={applications.totalElements} loading={loading} note="Received across all roles" />
        <Kpi icon={Inbox} tone="slate" label="Enquiries" value={enquiries.totalElements} loading={loading} note="Client requests received" />
        <Kpi
          icon={Mail}
          tone="red"
          label="Unread messages"
          value={unread}
          loading={loading}
          note="Contact messages to answer"
          onClick={() => onNavigate && onNavigate("contact-messages")}
        />
      </section>

      <div className="adLayout">
        <section className="adPanel" aria-label="Quick actions">
          <div className="adPanelHead">
            <div>
              <h2>Quick actions</h2>
              <p>Jump straight into the module you need.</p>
            </div>
          </div>
          <div className="adActionGrid">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.view}
                  type="button"
                  className="adAction"
                  onClick={() => onNavigate && onNavigate(action.view)}
                >
                  <i className={`adIconTile adTone-${action.tone}`}>
                    <Icon size={15} />
                  </i>
                  <span>
                    <strong>{action.label}</strong>
                    <small>{action.hint}</small>
                  </span>
                  <ArrowUpRight size={13} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="adPanel" aria-label="Your account">
          <div className="adPanelHead">
            <div>
              <h2>Your account</h2>
              <p>Profile, roles and permissions for this session.</p>
            </div>
            <Chip tone={status.tone}>{status.label}</Chip>
          </div>
          <ul className="adAccountList">
            <li>
              <span>Name</span>
              <strong>{fullName}</strong>
            </li>
            <li>
              <span>Email</span>
              <strong>{user.email || "—"}</strong>
            </li>
            <li>
              <span>Phone</span>
              <strong>{user.phone || "—"}</strong>
            </li>
            <li>
              <span>Email verified</span>
              <strong>{user.emailVerified ? "Yes" : "No"}</strong>
            </li>
            <li>
              <span>Last sign-in</span>
              <strong>{formatDateTime(user.lastLoginAt)}</strong>
            </li>
            <li>
              <span>Permissions</span>
              <strong>{permissions.length}</strong>
            </li>
          </ul>
          <div className="adTagGroup">
            <p>Roles</p>
            <ul className="adTags">
              {roles.length ? roles.map((role) => <li key={role}>{humanize(role)}</li>) : <li>No role assigned</li>}
            </ul>
          </div>
          {permissionModules.length > 0 && (
            <div className="adTagGroup">
              <p>Access</p>
              <ul className="adTags">
                {permissionModules.map((label) => <li key={label}>{label}</li>)}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="adGrid2">
        <section className="adPanel" aria-label="Latest enquiries">
          <div className="adPanelHead">
            <div>
              <h2>Latest enquiries</h2>
              <p>Fresh client requests waiting for a response.</p>
            </div>
            <button type="button" className="adLinkButton" onClick={() => onNavigate && onNavigate("enquiries")}>
              View all <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            <p className="adHint">Loading enquiries…</p>
          ) : !enquiries.content.length ? (
            <p className="adHint">No enquiries have come in yet.</p>
          ) : (
            <ul className="adList">
              {enquiries.content.map((enquiry) => {
                const meta = enquiryStatus(enquiry.status);
                return (
                  <li key={enquiry.id}>
                    <div className="adListMain">
                      <strong>{enquiry.companyName || enquiry.reference || `Enquiry #${enquiry.id}`}</strong>
                      <span>
                        {enquiry.reference ? `${enquiry.reference} · ` : ""}
                        {[enquiry.city, enquiry.categoryLabel].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </div>
                    <div className="adListMeta">
                      <span>{enquiry.assignedToName || "Unassigned"}</span>
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="adPanel" aria-label="Requisitions">
          <div className="adPanelHead">
            <div>
              <h2>Requisitions</h2>
              <p>Roles you can staff right now, newest first.</p>
            </div>
            <button type="button" className="adLinkButton" onClick={() => onNavigate && onNavigate("jobs")}>
              Manage jobs <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            <p className="adHint">Loading requisitions…</p>
          ) : !jobs.content.length ? (
            <p className="adHint">No requisitions have been published yet.</p>
          ) : (
            <ul className="adList">
              {jobs.content.map((job) => (
                <li key={job.id}>
                  <div className="adListMain">
                    <strong>{job.title || `Job #${job.id}`}</strong>
                    <span>
                      {job.location || [job.city, job.state].filter(Boolean).join(", ") || "—"}
                      {job.categoryName ? ` · ${job.categoryName}` : ""}
                    </span>
                  </div>
                  <div className="adListMeta">
                    <span>{job.openings ?? "—"} openings</span>
                    <Chip tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Chip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adPanel" aria-label="Recent applications">
          <div className="adPanelHead">
            <div>
              <h2>Recent applications</h2>
              <p>Latest candidates moving through the pipeline.</p>
            </div>
            <button type="button" className="adLinkButton" onClick={() => onNavigate && onNavigate("applications")}>
              View all <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            <p className="adHint">Loading applications…</p>
          ) : !applications.content.length ? (
            <p className="adHint">No applications have come in yet.</p>
          ) : (
            <ul className="adList">
              {applications.content.map((application) => (
                <li key={application.id}>
                  <div className="adListMain">
                    <strong>{application.candidateName || `Application #${application.id}`}</strong>
                    <span>
                      {application.jobTitle || `Job #${application.jobId}`}
                      {application.appliedOn ? ` · ${formatDateTime(application.appliedOn)}` : ""}
                    </span>
                  </div>
                  <Chip tone={applicationStatusTone(application.status)}>{applicationStatusLabel(application.status)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adPanel" aria-label="Clients">
          <div className="adPanelHead">
            <div>
              <h2>Clients</h2>
              <p>Accounts you are servicing right now.</p>
            </div>
            <button type="button" className="adLinkButton" onClick={() => onNavigate && onNavigate("clients")}>
              Manage clients <ArrowUpRight size={13} />
            </button>
          </div>
          {loading ? (
            <p className="adHint">Loading clients…</p>
          ) : !clients.content.length ? (
            <p className="adHint">No clients have been added yet.</p>
          ) : (
            <ul className="adList">
              {clients.content.map((client) => {
                const meta = clientStatus(client.status);
                return (
                  <li key={client.id}>
                    <div className="adListMain">
                      <strong>{client.legalName || client.displayName || `Client #${client.id}`}</strong>
                      <span>
                        {[client.billingCity, client.billingState].filter(Boolean).join(", ") || "—"}
                        {client.clientCode ? ` · ${client.clientCode}` : ""}
                      </span>
                    </div>
                    <Chip tone={meta.tone}>{meta.label}</Chip>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="adGrid1" style={{ marginTop: 18 }}>
        <UrgentRequisitionsWidget onNavigate={onNavigate} />
      </div>

      <p className="adNote">
        <CalendarClock size={13} /> All figures are pulled live from the admin API for your session.
      </p>
    </div>
  );
}
