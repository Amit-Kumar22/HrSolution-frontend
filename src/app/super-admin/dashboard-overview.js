"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldAlert, ShieldCheck, UserCheck, UserCog, UsersRound } from "lucide-react";
import { listAccounts, listPermissions, listRoles } from "../../lib/adminApi";
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../admin/admin-ui";
import { displayName, initialsOf, roleLabel, statusMeta } from "./account-meta";
import { styles } from "./super-admin-styles";

function Metric({ tone, label, value, note, icon: Icon }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <span>{label}</span>
        <i className={styles[tone]}>
          <Icon size={18} />
        </i>
      </div>
      <strong className={styles.metricValue}>{value}</strong>
      {note && (
        <p>
          {note} <span>live</span>
        </p>
      )}
    </article>
  );
}

export default function DashboardOverview({ session, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [total, active, disabled, pending, recentPage, roles, permissions] = await Promise.all([
          listAccounts({ page: 0, size: 1 }),
          listAccounts({ status: "ACTIVE", page: 0, size: 1 }),
          listAccounts({ status: "DISABLED", page: 0, size: 1 }),
          listAccounts({ status: "PENDING_APPROVAL", page: 0, size: 1 }),
          listAccounts({ page: 0, size: 6 }),
          listRoles(),
          listPermissions(),
        ]);
        if (cancelled) return;
        setSummary({
          total: total.totalElements,
          active: active.totalElements,
          disabled: disabled.totalElements,
          pending: pending.totalElements,
          roles: roles.length,
          permissions: permissions.length,
        });
        setRecent(recentPage.content);
        setError("");
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "The overview could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const user = session && session.user ? session.user : {};
  const name = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Super Admin";

  return (
    <div>
      <div className={styles.pageHeading}>
        <div>
          <h1>Welcome back, {name.split(/\s+/)[0]}</h1>
          <p>Central control for accounts, roles and every dashboard in the HRM platform.</p>
        </div>
        <div className={styles.headingActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => onNavigate("roles")}>
            Roles & permissions
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => onNavigate("accounts")}>
            Manage accounts
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading platform summary…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className={styles.metricGrid}>
            <Metric tone="blue" label="Total accounts" value={summary.total} note="All sign-ins" icon={UsersRound} />
            <Metric tone="green" label="Active" value={summary.active} note="Can sign in" icon={UserCheck} />
            <Metric tone="amber" label="Pending approval" value={summary.pending} note="Awaiting review" icon={ShieldAlert} />
            <Metric tone="red" label="Disabled" value={summary.disabled} note="Blocked" icon={ShieldCheck} />
            <Metric tone="indigo" label="Roles" value={summary.roles} note="Configured" icon={UserCog} />
            <Metric tone="blue" label="Permissions" value={summary.permissions} note="Catalogue" icon={KeyRound} />
          </div>

          <div className="saSectionLabel">Recently created accounts</div>
          {!recent.length ? (
            <EmptyState
              title="No accounts yet"
              message="Use “Add new account” to create the first Operator, HR, Accounts or Supervisor sign-in."
            />
          ) : (
            <div className="cmTableWrap">
              <table className="cmTable">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Roles</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((account) => {
                    const meta = statusMeta(account.status);
                    return (
                      <tr key={account.id}>
                        <td>
                          <div className="saAccountCell">
                            <span className="cmAvatar cmAvatarFallback">{initialsOf(displayName(account))}</span>
                            <span>
                              <strong>{displayName(account)}</strong>
                              <small>{account.email}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="saRoleTags">
                            {(account.roles || []).map((role) => (
                              <span key={role} className="saRoleTag">
                                {roleLabel(role)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <Chip tone={meta.tone}>{meta.label}</Chip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
