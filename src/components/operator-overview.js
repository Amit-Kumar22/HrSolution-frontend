"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  BriefcaseBusiness,
  CircleCheck,
  Inbox,
  KeyRound,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  listApplications,
  listClients,
  listEnquiries,
  listJobs,
} from "@/lib/adminApi";
import { statusLabel, statusTone } from "@/lib/client-forms";
import { humanize, moduleIcon, moduleLabel, moduleTone } from "@/lib/permission-modules";
import { Chip, EmptyState, LoadingState, Notice } from "@/app/admin/admin-ui";
import { UrgentRequisitionsWidget } from "@/app/admin/requisitions-panel";

const ACCOUNT_TONES = {
  ACTIVE: { label: "Active", tone: "active" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "pending" },
  PENDING: { label: "Pending approval", tone: "pending" },
  DISABLED: { label: "Disabled", tone: "blocked" },
  REJECTED: { label: "Rejected", tone: "blocked" },
  BLOCKED: { label: "Blocked", tone: "blocked" },
};

const QUICK_ACTIONS = [
  { view: "clients", label: "Clients", hint: "Sites, users and contracts", icon: Building2, tone: "blue" },
  { view: "access", label: "My access", hint: "What your role can do", icon: ShieldCheck, tone: "indigo" },
];

function accountStatus(status) {
  const key = String(status || "").toUpperCase();
  return ACCOUNT_TONES[key] || { label: humanize(key) || "Unknown", tone: "unknown" };
}

function Kpi({ icon: Icon, tone, label, value, note, loading }) {
  return (
    <article className="opKpi">
      <div className="opKpiTop">
        <span>{label}</span>
        <i className={`opIconTile opTone-${tone}`}>
          <Icon size={15} />
        </i>
      </div>
      <strong className="opKpiValue">{loading ? "—" : value}</strong>
      <p>{note}</p>
    </article>
  );
}

export default function OperatorOverview({ user, roles, permissions, modules, catalogueTotal, onNavigate }) {
  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }),
  );
  const [clients, setClients] = useState({ content: [], totalElements: 0 });
  const [jobs, setJobs] = useState({ content: [], totalElements: 0 });
  const [applications, setApplications] = useState({ content: [], totalElements: 0 });
  const [enquiries, setEnquiries] = useState({ content: [], totalElements: 0 });
  const [clientsError, setClientsError] = useState("");
  const [enquiriesError, setEnquiriesError] = useState("");
  const [state, setState] = useState("loading");

  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
  const firstName = user.firstName || fullName.split(/\s+/)[0] || "there";
  const status = accountStatus(user.status);

  const grantedKeys = useMemo(() => new Set(modules.map((module) => module.module)), [modules]);
  const catalogueReady = modules.length > 0 || (permissions && permissions.length > 0);
  const canView = useMemo(
    () => ({
      clients: !catalogueReady || grantedKeys.has("CLIENT"),
      enquiries: !catalogueReady || grantedKeys.has("ENQUIRY"),
      jobs: !catalogueReady || grantedKeys.has("RECRUITMENT") || grantedKeys.has("WORKFORCE"),
    }),
    [grantedKeys, catalogueReady],
  );

  useEffect(() => {
    let cancelled = false;

    async function load(call, apply, onError) {
      try {
        const data = await call();
        if (cancelled) return;
        apply(data);
      } catch (error) {
        if (cancelled) return;
        if (onError) {
          onError(error && typeof error.message === "string" && error.message ? error.message : "");
        }
      }
    }

    const calls = [];
    if (canView.clients) {
      calls.push(
        load(
          () => listClients({ page: 0, size: 25, sort: ["legalName,ASC"] }),
          setClients,
          setClientsError,
        ),
      );
    }
    if (canView.enquiries) {
      calls.push(
        load(() => listEnquiries({ page: 0, size: 10, sort: ["createdAt,DESC"] }), setEnquiries, setEnquiriesError),
      );
    }
    if (canView.jobs) {
      calls.push(load(() => listJobs({ page: 0, size: 1, sort: ["createdAt,DESC"] }), setJobs));
      calls.push(load(() => listApplications({ page: 0, size: 1, sort: ["appliedOn,DESC"] }), setApplications));
    }

    Promise.all(calls).then(() => {
      if (!cancelled) setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [canView]);

  const activeClients = useMemo(
    () => (clients.content || []).filter((client) => String(client.status || "").toUpperCase() === "ACTIVE").length,
    [clients.content],
  );

  const loading = state === "loading";

  return (
    <div className="opOverview">
      <section className="opHero">
        <div className="opHeroText">
          <p className="opEyebrow">Operations workspace</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="opHeroLead">Client operations, live enquiries and staffing numbers for your role.</p>
        </div>
        <div className="opHeroAside">
          <span className={`opStatusPill opStatusPill--${status.tone}`}>
            <i />
            {status.label}
          </span>
          <span className="opHeroDate" suppressHydrationWarning>
            {today}
          </span>
          <span className="opHeroEmail">{user.email || "—"}</span>
        </div>
      </section>

      <section className="opKpis" aria-label="Operations summary">
        <Kpi
          icon={Building2}
          tone="blue"
          label="Clients"
          value={clients.totalElements}
          loading={loading}
          note={`${activeClients} active on your list`}
        />
        <Kpi
          icon={BriefcaseBusiness}
          tone="indigo"
          label="Open vacancies"
          value={jobs.totalElements}
          loading={loading}
          note="Roles ready to staff"
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
          icon={Inbox}
          tone="amber"
          label="Enquiries"
          value={enquiries.totalElements}
          loading={loading}
          note="Latest client enquiries"
        />
      </section>

      <div className="opLayout">
        <section className="opPanel" aria-label="Clients">
          <div className="opPanelHead">
            <div>
              <h2>Clients on your list</h2>
              <p>Accounts you can service right now.</p>
            </div>
            <div className="opPanelActions">
              {!loading && clients.content.length > 0 && (
                <span className="opCount">{clients.totalElements} client{clients.totalElements === 1 ? "" : "s"}</span>
              )}
              <button type="button" className="opLinkButton" onClick={() => onNavigate("clients")}>
                Open clients <ArrowUpRight size={13} />
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingState label="Loading clients…" />
          ) : clientsError ? (
            <EmptyState icon={Building2} title="Clients could not be loaded" message={clientsError} />
          ) : !clients.content.length ? (
            <EmptyState
              icon={Building2}
              title="No clients yet"
              message="Client accounts linked to your role will appear here."
            />
          ) : (
            <ul className="opClientList">
              {clients.content.slice(0, 6).map((client) => (
                <li className="opClientRow" key={client.id}>
                  <div className="opClientMain">
                    <strong>{client.legalName || client.displayName || `Client #${client.id}`}</strong>
                    <span>
                      <MapPin size={11} />{" "}
                      {[client.billingCity, client.billingState].filter(Boolean).join(", ") || "—"}
                      {client.clientCode ? ` · ${client.clientCode}` : ""}
                    </span>
                  </div>
                  <Chip tone={statusTone(client.status)}>{statusLabel(client.status)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="opAside">
          <section className="opPanel" aria-label="Quick actions">
            <div className="opPanelHead">
              <div>
                <h2>Quick actions</h2>
                <p>Jump straight into your day-to-day work.</p>
              </div>
            </div>
            <div className="opActionGrid">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.view}
                    type="button"
                    className="opAction"
                    onClick={() => onNavigate(action.view)}
                  >
                    <i className={`opIconTile opTone-${action.tone}`}>
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

          <section className="opPanel" aria-label="Access summary">
            <div className="opPanelHead">
              <div>
                <h2>Access summary</h2>
                <p>Granted by the server for your role.</p>
              </div>
            </div>
            <ul className="opAccessList">
              <li>
                <span>
                  <KeyRound size={13} /> Roles
                </span>
                <strong>{roles.length}</strong>
              </li>
              <li>
                <span>
                  <ShieldCheck size={13} /> Permissions
                </span>
                <strong>{permissions.length}</strong>
              </li>
              <li>
                <span>
                  <Users size={13} /> Modules
                </span>
                <strong>{modules.length}</strong>
              </li>
            </ul>
            <button type="button" className="opLinkButton opLinkButton--block" onClick={() => onNavigate("access")}>
              Review my access <ArrowUpRight size={13} />
            </button>
          </section>
        </aside>
      </div>

      <section className="opPanel" aria-label="Enquiries">
        <div className="opPanelHead">
          <div>
            <h2>Latest enquiries</h2>
            <p>Fresh client requests waiting for a response.</p>
          </div>
          <div className="opPanelActions">
            {!loading && enquiries.content.length > 0 && (
              <span className="opCount">{enquiries.totalElements} total</span>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading enquiries…" />
        ) : enquiriesError ? (
          <Notice tone="error">{enquiriesError}</Notice>
        ) : !enquiries.content.length ? (
          <EmptyState
            icon={Inbox}
            title="No enquiries"
            message="New client enquiries will land here as soon as they arrive."
          />
        ) : (
          <ul className="opEnquiryList">
            {enquiries.content.slice(0, 5).map((enquiry) => (
              <li className="opEnquiryRow" key={enquiry.id}>
                <div className="opEnquiryMain">
                  <strong>{enquiry.companyName || enquiry.reference || `Enquiry #${enquiry.id}`}</strong>
                  <span>
                    {enquiry.reference ? `${enquiry.reference} · ` : ""}
                    {[enquiry.city, enquiry.categoryLabel].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
                <div className="opEnquiryMeta">
                  <span>{enquiry.assignedToName || "Unassigned"}</span>
                  <Chip tone={enquiry.status === "NEW" ? "info" : "neutral"}>{humanize(enquiry.status) || "New"}</Chip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modules.length > 0 && (
        <section className="opPanel" aria-label="Authorised modules">
          <div className="opPanelHead">
            <div>
              <h2>Authorised modules</h2>
              <p>Each card lists what your role can do inside that module.</p>
            </div>
            <span className="opCount">
              {modules.length} module{modules.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="opModuleGrid">
            {modules.map((module) => {
              const Icon = moduleIcon(module.module);
              const tone = moduleTone(module.module);
              const visible = module.items.slice(0, 3);
              const hidden = module.items.length - visible.length;
              return (
                <article className="opModule" key={module.module}>
                  <div className="opModuleHead">
                    <i className={`opIconTile opTone-${tone}`}>
                      <Icon size={15} />
                    </i>
                    <div>
                      <strong>{module.label || moduleLabel(module.module)}</strong>
                      <small>
                        {module.items.length} permission{module.items.length === 1 ? "" : "s"}
                      </small>
                    </div>
                  </div>
                  <div className="opModuleChips">
                    {visible.map((item) => (
                      <span className="opChip" key={item}>
                        {humanize(item)}
                      </span>
                    ))}
                    {hidden > 0 && <span className="opChip opChip--more">+{hidden}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="opPanel" aria-label="Urgent to Fill" style={{ marginTop: 18 }}>
        <UrgentRequisitionsWidget onNavigate={onNavigate} />
      </section>
    </div>
  );
}
