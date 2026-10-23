"use client";

import { ArrowUpRight, KeyRound, Layers, ShieldCheck, Users } from "lucide-react";
import { humanize, moduleIcon, moduleLabel, moduleTone } from "@/lib/permission-modules";
import { Chip, EmptyState } from "@/app/admin/admin-ui";

const STATUS_TONES = {
  ACTIVE: { label: "Active", tone: "success", pill: "active" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warn", pill: "pending" },
  PENDING: { label: "Pending approval", tone: "warn", pill: "pending" },
  DISABLED: { label: "Disabled", tone: "danger", pill: "blocked" },
  REJECTED: { label: "Rejected", tone: "danger", pill: "blocked" },
  BLOCKED: { label: "Blocked", tone: "danger", pill: "blocked" },
};

function accountStatus(status) {
  const key = String(status || "").toUpperCase();
  return STATUS_TONES[key] || { label: humanize(key) || "Unknown", tone: "neutral", pill: "" };
}

function Kpi({ icon: Icon, tone, label, value, note }) {
  return (
    <article className="opKpi">
      <div className="opKpiTop">
        <span>{label}</span>
        <i className={`opIconTile opTone-${tone}`}>
          <Icon size={15} />
        </i>
      </div>
      <strong className="opKpiValue">{value}</strong>
      <p>{note}</p>
    </article>
  );
}

export default function SupervisorOverview({ user, roles, permissions, modules, onNavigate }) {
  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Supervisor";
  const firstName = user.firstName || fullName.split(/\s+/)[0] || "there";
  const status = accountStatus(user.status);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const roleLabels = roles.map((role) => humanize(role)).filter(Boolean);

  return (
    <div className="opOverview">
      <section className="opHero">
        <div className="opHeroText">
          <p className="opEyebrow">Supervision workspace</p>
          <h1>Welcome back, {firstName}</h1>
          <p className="opHeroLead">
            Your supervision workspace. You only see the modules and actions granted to your role.
          </p>
        </div>
        <div className="opHeroAside">
          <span className={`opStatusPill opStatusPill--${status.pill}`}>
            <i />
            {status.label}
          </span>
          <span className="opHeroDate" suppressHydrationWarning>
            {today}
          </span>
          <span className="opHeroEmail">{user.email || "—"}</span>
        </div>
      </section>

      <section className="opKpis" aria-label="Account summary">
        <Kpi
          icon={ShieldCheck}
          tone="blue"
          label="Account"
          value={status.label}
          note={user.email || "—"}
        />
        <Kpi
          icon={Users}
          tone="indigo"
          label="Roles"
          value={roles.length}
          note={roleLabels.join(", ") || "None"}
        />
        <Kpi
          icon={KeyRound}
          tone="green"
          label="Permissions"
          value={permissions.length}
          note="Granted by the server"
        />
        <Kpi
          icon={Layers}
          tone="amber"
          label="Modules"
          value={modules.length}
          note="Authorised for your role"
        />
      </section>

      <div className="opLayout">
        <section className="opPanel" aria-label="Your account">
          <div className="opPanelHead">
            <div>
              <h2>Your account</h2>
              <p>Profile, roles and permissions for this session.</p>
            </div>
            <Chip tone={status.tone}>{status.label}</Chip>
          </div>
          <ul className="opAccessList">
            <li>
              <span>
                <ShieldCheck size={13} /> Name
              </span>
              <strong>{fullName}</strong>
            </li>
            <li>
              <span>
                <Users size={13} /> Email
              </span>
              <strong>{user.email || "—"}</strong>
            </li>
            <li>
              <span>
                <Layers size={13} /> Roles
              </span>
              <strong>{roleLabels.join(", ") || "None"}</strong>
            </li>
            <li>
              <span>
                <KeyRound size={13} /> Permissions
              </span>
              <strong>{permissions.length}</strong>
            </li>
            <li>
              <span>
                <Layers size={13} /> Modules
              </span>
              <strong>{modules.length}</strong>
            </li>
          </ul>
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
              <button type="button" className="opAction" onClick={() => onNavigate("access")}>
                <i className="opIconTile opTone-indigo">
                  <ShieldCheck size={15} />
                </i>
                <span>
                  <strong>My access</strong>
                  <small>What your role can do</small>
                </span>
                <ArrowUpRight size={13} />
              </button>
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
        {!modules.length ? (
          <EmptyState
            title="No modules assigned yet"
            message="Your role does not grant any module permissions. Ask the Super Admin to review your role."
          />
        ) : (
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
        )}
      </section>
    </div>
  );
}
