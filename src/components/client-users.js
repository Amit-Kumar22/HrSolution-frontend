"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { Chip, EmptyState, ErrorState, LoadingState } from "@/app/admin/admin-ui";
import { listMyClientUsers } from "@/lib/clientApi";
import { clientErrorMessage, companyName, userStatusMeta } from "@/lib/client-format";

function usersError(error) {
  if (error && error.status === 403) {
    return "You do not have permission to view users for this company.";
  }
  return clientErrorMessage(error, "Your company's users could not be loaded.");
}

function ActiveChip({ active }) {
  if (active === true) return <Chip tone="success">Active</Chip>;
  if (active === false) return <Chip tone="neutral">Inactive</Chip>;
  return <Chip tone="neutral">—</Chip>;
}

export default function ClientUsers({ company, companyLoading = false, companyError = "", onCompanyRetry }) {
  const clientId = company && company.id != null ? company.id : null;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    listMyClientUsers(clientId)
      .then((data) => {
        if (cancelled) return;
        setUsers(data);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setUsers([]);
        setError(usersError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  function reload() {
    setLoading(true);
    setError("");
    setReloadToken((token) => token + 1);
  }

  if (companyLoading) {
    return (
      <section className="clPanel">
        <LoadingState label="Loading your company…" />
      </section>
    );
  }

  if (companyError) {
    return (
      <section className="clPanel">
        <ErrorState message={companyError} onRetry={onCompanyRetry} />
      </section>
    );
  }

  if (!clientId) {
    return (
      <section className="clPanel">
        <EmptyState
          icon={Users}
          title="No company linked"
          message="Your account is not associated with a client company, so users cannot be loaded."
        />
      </section>
    );
  }

  return (
    <section className="clPanel clientUsersPanel" aria-labelledby="client-users-title">
      <div className="clPanelHead">
        <div>
          <h2 id="client-users-title">Users</h2>
          <p>People at {companyName(company)} who can access the client portal.</p>
        </div>
        <div className="clientPanelActions">
          <span className="clCount">{users.length} user{users.length === 1 ? "" : "s"}</span>
          <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading company users…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users linked"
          message="No portal users are currently linked to your company."
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable clientUsersTable">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th className="cmColCenter">Account status</th>
                <th className="cmColCenter">Primary contact</th>
                <th className="cmColCenter">Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => {
                const status = userStatusMeta(entry.userStatus);
                return (
                  <tr key={entry.id ?? entry.userId ?? entry.email}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><Users size={16} /></span>
                        <span>
                          <strong>{entry.fullName || "—"}</strong>
                          {entry.id != null || entry.userId != null ? (
                            <small className="cmMuted cmBlock">
                              {entry.id != null ? `Link #${entry.id}` : ""}
                              {entry.id != null && entry.userId != null ? " · " : ""}
                              {entry.userId != null ? `User #${entry.userId}` : ""}
                            </small>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className="cmMuted cmCellWrap">{entry.email || "—"}</td>
                    <td className="cmMuted">{entry.phone || "—"}</td>
                    <td className="cmMuted">{entry.designation || "—"}</td>
                    <td className="cmColCenter"><Chip tone={status.tone}>{status.label}</Chip></td>
                    <td className="cmColCenter">
                      {entry.primaryContact === true ? <Chip tone="accent">Primary contact</Chip> : "—"}
                    </td>
                    <td className="cmColCenter"><ActiveChip active={entry.active} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
