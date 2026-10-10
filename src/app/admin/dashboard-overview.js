"use client";

import { Building2, ClipboardList, FileText, UsersRound, Wallet } from "lucide-react";
import { styles } from "./admin-styles";

const metrics = [
  { label: "Active clients", value: "48", detail: "▲ 3 new", icon: Building2, tone: "blue" },
  { label: "Workers deployed", value: "4,812", detail: "▲ 6.2%", icon: UsersRound, tone: "green" },
  { label: "On bench", value: "186", detail: "▼ 24", icon: UsersRound, tone: "amber" },
  { label: "Open requisitions", value: "23", detail: "7 need action", icon: ClipboardList, tone: "indigo" },
  { label: "Billing · Sep", value: "₹2.84 Cr", detail: "▲ 4.1%", icon: FileText, tone: "amber" },
  { label: "Outstanding", value: "₹46.2 L", detail: "12 invoices overdue", icon: Wallet, tone: "red" },
];

const billing = [
  { month: "May", billed: 78, collected: 73 },
  { month: "Jun", billed: 82, collected: 77 },
  { month: "Jul", billed: 88, collected: 82 },
  { month: "Aug", billed: 91, collected: 86 },
  { month: "Sep", billed: 100, collected: 80 },
  { month: "Oct", billed: 42, collected: 32 },
];

const workerTypes = [
  ["Security guards", "38%", "navy"],
  ["Helpers & loaders", "27%", "amber"],
  ["Machine operators", "15%", "blue"],
  ["Housekeeping", "12%", "green"],
  ["Office staff", "8%", "gray"],
];

export default function DashboardOverview({ session }) {
  const fullName = session.user.fullName || session.user.email;
  const roles = Array.isArray(session.user.roles) ? session.user.roles : [];
  const permissions = Array.isArray(session.user.permissions) ? session.user.permissions : [];
  const statusTone =
    session.user.status === "ACTIVE"
      ? "accountStatus--active"
      : session.user.status === "DISABLED" || session.user.status === "REJECTED"
        ? "accountStatus--blocked"
        : "accountStatus--pending";
  const lastLogin = session.user.lastLoginAt
    ? new Date(session.user.lastLoginAt).toLocaleString()
    : "—";

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <h1>Good morning, {session.user.firstName || fullName} <span>👋</span></h1>
          <p>Here is what is happening across 48 client sites today · Wed, 07-10-2026</p>
        </div>
        <div className={styles.headingActions}>
          <button className={styles.secondaryButton}>Export report</button>
          <button className={styles.primaryButton}>+ New requisition</button>
        </div>
      </div>

      <section className={styles.metricGrid} aria-label="Workforce summary">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article className={styles.metricCard} key={label}>
            <div className={styles.metricTop}><span>{label}</span><i className={styles[tone]}><Icon size={17} /></i></div>
            <strong className={styles.metricValue}>{value}</strong>
            <p className={styles[tone]}>{detail} <span>vs last month</span></p>
          </article>
        ))}
      </section>

      <div className={styles.chartGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><h2>Billing vs collection</h2><p>₹ in crore · last 6 months</p></div>
            <div className={styles.chartLegend}><span><i className={styles.legendNavy} />Billed</span><span><i className={styles.legendAmber} />Collected</span></div>
          </div>
          <div className={styles.barChart} aria-label="Bar chart comparing monthly billed and collected amounts">
            {billing.map(({ month, billed: billedValue, collected }) => (
              <div className={styles.barGroup} key={month}>
                <div className={styles.bars}>
                  <i className={styles.billedBar} style={{ height: `${billedValue}%` }} />
                  <i className={styles.collectedBar} style={{ height: `${collected}%` }} />
                </div>
                <span>{month}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><h2>Workers by category</h2><p>Across all active deployments</p></div>
          </div>
          <div className={styles.donutLayout}>
            <div className={styles.donut} role="img" aria-label="Worker category distribution">
              <div><strong>4,812</strong><span>deployed</span></div>
            </div>
            <ul className={styles.donutLegend}>
              {workerTypes.map(([label, value, tone]) => (
                <li key={label}><span><i className={styles[`legend${tone[0].toUpperCase()}${tone.slice(1)}`]} />{label}</span><b>{value}</b></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <p className={styles.previewNotice}>Dashboard preview · Sample figures for interface demonstration</p>

      <section className={styles.panel} aria-label="Your account">
        <div className={styles.panelHeading}>
          <div><h2>Your account</h2><p>Profile, roles and permissions for this session</p></div>
        </div>
        <div className={styles.chartGrid}>
          <div>
            <dl>
              <div className="accountField"><dt>Name</dt><dd>{fullName}</dd></div>
              <div className="accountField"><dt>Email</dt><dd>{session.user.email}</dd></div>
              <div className="accountField"><dt>Phone</dt><dd>{session.user.phone || "—"}</dd></div>
            </dl>
          </div>
          <div>
            <dl>
              <div className="accountField">
                <dt>Status</dt>
                <dd><span className={`accountStatus ${statusTone}`}>{session.user.status || "UNKNOWN"}</span></dd>
              </div>
              <div className="accountField"><dt>Email verified</dt><dd>{session.user.emailVerified ? "Yes" : "No"}</dd></div>
              <div className="accountField"><dt>Last sign-in</dt><dd>{lastLogin}</dd></div>
            </dl>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", color: "#8496ad", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Roles</p>
          <ul className="accountTags">{roles.map((role) => <li key={role}>{role}</li>)}</ul>
        </div>
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", color: "#8496ad", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Permissions</p>
          {permissions.length ? (
            <ul className="accountTags">{permissions.map((permission) => <li key={permission}>{permission}</li>)}</ul>
          ) : (
            <p style={{ margin: 0, color: "#63748b", fontSize: 13 }}>No permissions were returned for this account.</p>
          )}
        </div>
      </section>
    </>
  );
}
