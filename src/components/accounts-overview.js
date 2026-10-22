"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CircleCheck,
  FileSignature,
  Grid3x3,
  KeyRound,
  Layers,
  Lock,
  ReceiptIndianRupee,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { listClients } from "@/lib/adminApi";
import { statusLabel, statusTone } from "@/lib/client-forms";
import { humanize, moduleIcon, moduleLabel, moduleOf, moduleTone } from "@/lib/permission-modules";
import { Chip, EmptyState, ErrorState, LoadingState } from "@/app/admin/admin-ui";

const FINANCE_MODULES = [
  { key: "PAYROLL", icon: Wallet, hint: "Payslips, salary runs and statutory deductions" },
  { key: "INVOICE", icon: ReceiptIndianRupee, hint: "Raise, track and settle client invoices" },
  { key: "CONTRACT", icon: FileSignature, hint: "Client agreements, terms and renewals" },
  { key: "CLIENT", icon: Building2, hint: "Billing entities, GST details and payment terms" },
  { key: "AUDIT", icon: ScrollText, hint: "Trail every financial action on the platform" },
  { key: "ATTENDANCE", icon: CalendarCheck, hint: "Attendance inputs that drive payroll" },
];

const STATUS_TONES = {
  ACTIVE: { label: "Active", tone: "active" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "pending" },
  PENDING: { label: "Pending approval", tone: "pending" },
  DISABLED: { label: "Disabled", tone: "blocked" },
  REJECTED: { label: "Rejected", tone: "blocked" },
  BLOCKED: { label: "Blocked", tone: "blocked" },
};

function accountStatus(status) {
  const key = String(status || "").toUpperCase();
  return STATUS_TONES[key] || { label: humanize(key) || "Unknown", tone: "unknown" };
}

function Kpi({ icon: Icon, tone, label, value, note, valueTone, valueText, meter }) {
  return (
    <article className="acKpi">
      <div className="acKpiTop">
        <span>{label}</span>
        <i className={`acIconTile acTone-${tone}`}>
          <Icon size={16} />
        </i>
      </div>
      <strong
        className={`acKpiValue${valueText ? " acKpiValue--text" : ""}${valueTone ? ` acKpiValue--${valueTone}` : ""}`}
      >
        {value}
      </strong>
      {note && <p>{note}</p>}
      {meter && (
        <div className="acMeter" role="img" aria-label={`${meter.percent}% of the permission catalogue granted`}>
          <span style={{ width: `${meter.percent}%` }} />
        </div>
      )}
    </article>
  );
}

export default function AccountsOverview({
  user,
  roles,
  permissions,
  modules,
  permissionMeta,
  catalogueTotal,
  onNavigate,
}) {
  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  );
  const [clients, setClients] = useState({ content: [], totalElements: 0 });
  const [clientsState, setClientsState] = useState("loading");
  const [clientsError, setClientsError] = useState("");

  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
  const firstName = user.firstName || fullName.split(/\s+/)[0] || "there";
  const status = accountStatus(user.status);

  const grantedKeys = useMemo(() => new Set(modules.map((module) => module.module)), [modules]);
  const canViewClients =
    grantedKeys.has("CLIENT") || permissions.some((permission) => moduleOf(permission) === "CLIENT");
  const clientsView = canViewClients ? clientsState : "denied";

  const permissionShare = useMemo(() => {
    if (!catalogueTotal) return 0;
    return Math.min(100, Math.round((permissions.length / catalogueTotal) * 100));
  }, [permissions.length, catalogueTotal]);

  useEffect(() => {
    if (!canViewClients) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await listClients({ page: 0, size: 6, sort: ["legalName,ASC"] });
        if (cancelled) return;
        setClients({ content: data.content || [], totalElements: data.totalElements || 0 });
        setClientsState("ready");
      } catch (error) {
        if (cancelled) return;
        setClientsError(
          error instanceof Error ? error.message : "Billing clients could not be loaded.",
        );
        setClientsState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewClients]);

  return (
    <div className="acOverview">
      <section className="acHero">
        <div className="acHeroText">
          <p className="acEyebrow">Accounts workspace</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="acHeroLead">
            Your finance workspace. Every module, figure and action below is derived from the permissions the
            server grants to your role.
          </p>
        </div>
        <div className="acHeroAside">
          <span className={`acStatusPill acStatusPill--${status.tone}`}>
            <i />
            {status.label}
          </span>
          <span className="acHeroDate" suppressHydrationWarning>
            {today}
          </span>
          <span className="acHeroEmail">{user.email || "—"}</span>
        </div>
      </section>

      <section className="acKpis" aria-label="Account summary">
        <Kpi
          icon={ShieldCheck}
          tone="blue"
          label="Account status"
          value={status.label}
          valueTone={status.tone}
          valueText
          note={
            user.emailVerified === true
              ? "Email verified"
              : user.emailVerified === false
                ? "Email not verified"
                : "Managed by the Super Admin"
          }
        />
        <Kpi
          icon={Layers}
          tone="indigo"
          label="Roles assigned"
          value={roles.length}
          note={roles.map((role) => humanize(role)).join(", ") || "No role assigned"}
        />
        <Kpi
          icon={KeyRound}
          tone="green"
          label="Permissions granted"
          value={permissions.length}
          note={catalogueTotal ? `of ${catalogueTotal} in the catalogue` : "Granted by the server"}
          meter={catalogueTotal ? { percent: permissionShare } : null}
        />
        <Kpi
          icon={Grid3x3}
          tone="amber"
          label="Authorised modules"
          value={modules.length}
          note="Modules open to your role"
        />
      </section>

      <div className="acLayout">
        <section className="acPanel acPanel--modules" aria-label="Authorised modules">
          <div className="acPanelHead">
            <div>
              <h2>Authorised modules</h2>
              <p>Each card lists the actions your role can perform inside that module.</p>
            </div>
            <span className="acCount">{modules.length} module{modules.length === 1 ? "" : "s"}</span>
          </div>

          {!modules.length ? (
            <EmptyState
              title="No modules assigned yet"
              message="Your role does not grant any module permissions. Ask the Super Admin to review your role."
            />
          ) : (
            <div className="acModuleGrid">
              {modules.map((module) => {
                const Icon = moduleIcon(module.module);
                const tone = moduleTone(module.module);
                const visible = module.items.slice(0, 4);
                const hidden = module.items.length - visible.length;
                return (
                  <article className="acModule" key={module.module}>
                    <div className="acModuleHead">
                      <i className={`acIconTile acTone-${tone}`}>
                        <Icon size={16} />
                      </i>
                      <div>
                        <strong>{module.label || moduleLabel(module.module)}</strong>
                        <small>
                          {module.items.length} permission{module.items.length === 1 ? "" : "s"}
                        </small>
                      </div>
                    </div>
                    <div className="acChips">
                      {visible.map((item) => {
                        const meta = permissionMeta ? permissionMeta.get(item) : null;
                        return (
                          <span className="acChip" key={item} title={meta && meta.description ? meta.description : item}>
                            {humanize(item)}
                          </span>
                        );
                      })}
                      {hidden > 0 && <span className="acChip acChip--more">+{hidden} more</span>}
                    </div>
                    <span className="acModuleKey">{module.module}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="acAside">
          <section className="acPanel" aria-label="Finance access">
            <div className="acPanelHead">
              <div>
                <h2>Finance access</h2>
                <p>What your role can reach across the money modules.</p>
              </div>
            </div>
            <div className="acAccessList">
              {FINANCE_MODULES.map((entry) => {
                const Icon = entry.icon;
                const granted = grantedKeys.has(entry.key);
                const count = modules.find((module) => module.module === entry.key);
                return (
                  <div className={`acAccessRow${granted ? "" : " acAccessRow--locked"}`} key={entry.key}>
                    <i className={`acAccessIcon${granted ? " acAccessIcon--granted" : ""}`}>
                      {granted ? <CircleCheck size={14} /> : <Lock size={13} />}
                    </i>
                    <span>
                      <strong>{moduleLabel(entry.key)}</strong>
                      <small>
                        {granted
                          ? `${count ? count.items.length : 0} permission${count && count.items.length === 1 ? "" : "s"} granted`
                          : entry.hint}
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="acPanel" aria-label="Your access">
            <div className="acPanelHead">
              <div>
                <h2>Your access</h2>
                <p>The server recomputes these permissions on every request.</p>
              </div>
            </div>
            <dl className="acFacts">
              <div>
                <dt>Signed in as</dt>
                <dd>{fullName}</dd>
              </div>
              <div>
                <dt>Primary role</dt>
                <dd>{roles.length ? humanize(roles[0]) : "—"}</dd>
              </div>
              <div>
                <dt>Last sign-in</dt>
                <dd suppressHydrationWarning>
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>
            <button type="button" className="acLinkButton" onClick={() => onNavigate("access")}>
              Review every permission <ArrowUpRight size={14} />
            </button>
          </section>
        </aside>
      </div>

      <section className="acPanel" aria-label="Billing clients">
        <div className="acPanelHead">
          <div>
            <h2>Billing clients</h2>
            <p>Client entities you can raise invoices against.</p>
          </div>
          <div className="acPanelActions">
            {clientsView === "ready" && (
              <span className="acCount">
                {clients.totalElements} client{clients.totalElements === 1 ? "" : "s"}
              </span>
            )}
            <button type="button" className="acLinkButton" onClick={() => onNavigate("clients")}>
              Open clients <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {clientsView === "loading" ? (
          <LoadingState label="Loading billing clients…" />
        ) : clientsView === "denied" ? (
          <EmptyState
            icon={Lock}
            title="Client records are outside your role"
            message="Your role does not carry client permissions, so billing entities are not loaded here."
          />
        ) : clientsView === "error" ? (
          <ErrorState message={clientsError} />
        ) : !clients.content.length ? (
          <EmptyState
            icon={Building2}
            title="No billing clients"
            message="Client records you are allowed to see will appear here."
          />
        ) : (
          <div className="cmTableWrap acTable">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Client code</th>
                  <th>GSTIN</th>
                  <th>Billing state</th>
                  <th>Terms</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.content.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile">
                          <Building2 size={15} />
                        </span>
                        <span>
                          <strong>{client.legalName || client.displayName || "—"}</strong>
                          <small>{client.billingCity || client.displayName || "—"}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="cmCode">{client.clientCode || "—"}</span>
                    </td>
                    <td className="cmMuted">{client.gstin || "—"}</td>
                    <td className="cmMuted">{client.billingState || "—"}</td>
                    <td className="cmMuted">
                      {client.paymentTermsDays ? `${client.paymentTermsDays} days` : "—"}
                    </td>
                    <td>
                      <Chip tone={statusTone(client.status)}>{statusLabel(client.status)}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
