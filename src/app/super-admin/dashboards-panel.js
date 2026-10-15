"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Plus, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { listRoles } from "../../lib/adminApi";
import { ErrorState, LoadingState, SectionHead } from "../admin/admin-ui";
import { dashboardForRole, roleDescription, roleLabel } from "./account-meta";

const CANONICAL_TYPES = Object.freeze([
  { key: "super_admin", label: "Super Admin", matchers: ["SUPER_ADMIN"] },
  { key: "admin", label: "Admin", matchers: ["ADMIN", "MANAGER"] },
  { key: "hr", label: "HR", matchers: ["HR", "HR_RECRUITER", "HR_MANAGER"] },
  { key: "operator", label: "Operator", matchers: ["OPERATOR", "OPERATIONS", "OPERATIONS_MANAGER", "SECURITY_GUARD"] },
  { key: "accounts", label: "Accounts", matchers: ["ACCOUNTS", "ACCOUNTANT"] },
  { key: "supervisor", label: "Supervisor", matchers: ["SUPERVISOR"] },
]);

export default function DashboardsPanel({ onNavigate, onCreateAccount }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listRoles();
        if (!cancelled) {
          setRoles(data);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Roles could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const roleSet = useMemo(() => new Set(roles.map((role) => role.name)), [roles]);

  const typeCards = useMemo(
    () =>
      CANONICAL_TYPES.map((type) => {
        const matched = type.matchers.filter((name) => roleSet.has(name));
        const primary = matched[0] || type.matchers[0];
        return {
          ...type,
          available: matched,
          primary,
          dashboard: dashboardForRole(primary),
        };
      }),
    [roleSet],
  );

  const otherRoles = useMemo(
    () => roles.filter((role) => !CANONICAL_TYPES.some((type) => type.matchers.includes(role.name))),
    [roles],
  );

  return (
    <div>
      <SectionHead
        title="Dashboards & role management"
        description="Each role signs in through the shared login page and lands on the dashboard below. Access is decided by the authenticated user's role and permissions on the server."
        action={
          <button type="button" className="primaryButton cmBtn" onClick={onCreateAccount}>
            <Plus size={16} /> Create account
          </button>
        }
      />

      {loading ? (
        <LoadingState label="Loading dashboards…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => setReloadToken((t) => t + 1)} />
      ) : (
        <>
          <div className="saDashboardGrid">
            {typeCards.map((card) => (
              <div className="saDashboardCard" key={card.key}>
                <header>
                  <h3>{card.label}</h3>
                  <span className={`saRoleTag${card.primary === "SUPER_ADMIN" ? " saRoleTagSuper" : ""}`}>
                    {card.available.length ? roleLabel(card.primary) : "Role not found"}
                  </span>
                </header>
                <p>{roleDescription(card.primary)}</p>
                {card.available.length > 1 && (
                  <div className="saShares">
                    {card.available.map((name) => (
                      <span className="saShare" key={name}>
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                <span className="saDashboardPath">
                  <LayoutDashboard size={13} /> {card.dashboard.path}
                </span>
                <div className="cmRowActions">
                  <button type="button" className="secondaryButton cmBtn" onClick={() => onNavigate("roles")}>
                    <ShieldCheck size={14} /> Permissions
                  </button>
                  <button type="button" className="secondaryButton cmBtn" onClick={() => onNavigate("accounts")}>
                    <UsersRound size={14} /> Accounts
                  </button>
                </div>
              </div>
            ))}
          </div>

          {otherRoles.length > 0 && (
            <>
              <div className="saSectionLabel">Other roles available in the backend</div>
              <div className="saDashboardGrid">
                {otherRoles.map((role) => (
                  <div className="saDashboardCard" key={role.id}>
                    <header>
                      <h3>{roleLabel(role.name)}</h3>
                    </header>
                    <p>{role.description || roleDescription(role.name)}</p>
                    <span className="saDashboardPath">
                      <LayoutDashboard size={13} /> {dashboardForRole(role.name).path}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="saInlineNote" style={{ marginTop: 20 }}>
            <strong>How access is enforced.</strong> The server re-derives the signed-in user&apos;s roles and
            permissions from the database on every request using the access token, so nobody can reach another dashboard
            or API by editing anything in the browser. Role and permission changes revoke the affected user&apos;s
            sessions.
            <div className="cmRowActions" style={{ marginTop: 10 }}>
              <button type="button" className="secondaryButton cmBtn" onClick={() => onNavigate("roles")}>
                <Settings2 size={14} /> Manage roles & permissions
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
