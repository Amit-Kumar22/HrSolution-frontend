"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, UserCheck, UserPlus, UserX } from "lucide-react";
import {
  linkClientUser,
  listClientUsers,
  listUsers,
  setClientUserActive,
  setClientUserPrimaryContact,
} from "@/lib/adminApi";
import { emptyLinkForm, linkFormToPayload, validateLinkForm } from "@/lib/client-forms";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  Notice,
  Switch,
} from "./admin-ui";

function mapPayloadErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") return error.fields;
  return {};
}

function errorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function accessTone(user) {
  if (!user.active) return "danger";
  if (user.userStatus === "PENDING_VERIFICATION" || user.userStatus === "PENDING_APPROVAL") return "warn";
  if (user.userStatus === "ACTIVE") return "success";
  return "neutral";
}

function LinkUserDialog({ client, onClose, onDone }) {
  const [form, setForm] = useState(() => emptyLinkForm());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  useEffect(() => {
    let active = true;
    listUsers({ role: "CLIENT", size: 200, sort: ["email,ASC"] })
      .then((page) => { if (active) setUsers(page.content || []); })
      .catch((err) => { if (active) setUsersError(errorMessage(err, "The user list could not be loaded.")); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateLinkForm(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      await linkClientUser(client.id, linkFormToPayload(form));
      onDone("User linked to this client.");
    } catch (error) {
      const fields = mapPayloadErrors(error);
      setErrors(fields);
      setFormError(errorMessage(error, "The user could not be linked."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Link a user to this client"
      description={`${client?.legalName || ""} · ${client?.clientCode || ""}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="link-user-form" className="primaryButton cmBtn" disabled={saving || usersLoading}>
            {saving ? <><Loader2 size={15} className="spin" /> Linking…</> : <><Link2 size={15} /> Link user</>}
          </button>
        </>
      )}
    >
      <form id="link-user-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <Notice tone="info">
          One login can belong to only one client. Pick an existing CLIENT-role user; the server rejects the link
          if that login is already attached to another company.
        </Notice>
        <div className="cmFormGrid" style={{ marginTop: 14 }}>
          <Field label="User" htmlFor="link-user" required error={errors.userId} hint={usersError || undefined}>
            <select
              id="link-user"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              disabled={usersLoading}
            >
              <option value="">{usersLoading ? "Loading users…" : "Select a user"}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName || user.email} · {user.email} ({user.status})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Designation" htmlFor="link-designation" required error={errors.designation}>
            <input
              id="link-designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
          </Field>
          <div className="cmSwitchRow">
            <span className="cmFieldLabel">Primary contact</span>
            <Switch
              id="link-primary"
              checked={form.primaryContact}
              onChange={(next) => setForm({ ...form, primaryContact: next })}
              label={form.primaryContact ? "Make primary contact" : "Secondary contact"}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function ClientUsersTab({ client, onChanged }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [primaryTarget, setPrimaryTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listClientUsers(client.id);
      setUsers(Array.isArray(list) ? list : []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Client users could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load(cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function toggleActive(user) {
    if (busyId) return;
    const next = !user.active;
    setBusyId(user.id);
    try {
      await setClientUserActive(client.id, user.id, next);
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, active: next } : item)));
      if (typeof onChanged === "function") onChanged();
    } catch (err) {
      setError(errorMessage(err, next ? "Access could not be restored." : "Access could not be revoked."));
    } finally {
      setBusyId(null);
      setRevokeTarget(null);
    }
  }

  async function confirmPrimary() {
    if (!primaryTarget || dialogBusy) return;
    setDialogBusy(true);
    try {
      await setClientUserPrimaryContact(client.id, primaryTarget.id);
      const updatedId = primaryTarget.id;
      setUsers((current) => current.map((item) => ({ ...item, primaryContact: item.id === updatedId })));
      setPrimaryTarget(null);
      if (typeof onChanged === "function") onChanged();
    } catch (err) {
      setError(errorMessage(err, "The primary contact could not be changed."));
      setPrimaryTarget(null);
    } finally {
      setDialogBusy(false);
    }
  }

  return (
    <div>
      <div className="cmToolbar cmToolbarStart">
        <span className="cmCount">{users.length} user{users.length === 1 ? "" : "s"}</span>
        <button type="button" className="primaryButton cmBtn" onClick={() => setLinkOpen(true)}>
          <UserPlus size={15} /> Link user
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading client users…" />
      ) : error && users.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : users.length === 0 ? (
        <EmptyState icon={UserPlus} title="No linked users" message="Link an existing CLIENT-role login to give this company portal access." />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Designation</th>
                <th className="cmColCenter">Primary</th>
                <th className="cmColCenter">Account</th>
                <th className="cmColCenter">Access</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.fullName || "—"}</strong></td>
                  <td className="cmMuted">{user.email || "—"}</td>
                  <td className="cmMuted">{user.phone || "—"}</td>
                  <td className="cmMuted">{user.designation || "—"}</td>
                  <td className="cmColCenter">
                    {user.primaryContact ? <Chip tone="accent">Primary</Chip> : <span className="cmMuted">—</span>}
                  </td>
                  <td className="cmColCenter"><Chip tone={accessTone(user)}>{user.userStatus || "UNKNOWN"}</Chip></td>
                  <td className="cmColCenter">
                    <Switch
                      id={`user-active-${user.id}`}
                      checked={Boolean(user.active)}
                      disabled={busyId === user.id}
                      onChange={(next) => {
                        if (next) toggleActive(user);
                        else setRevokeTarget(user);
                      }}
                    />
                  </td>
                  <td className="cmColActions">
                    <div className="cmRowActions">
                      <button
                        type="button"
                        className="cmIconButton"
                        title="Make primary contact"
                        aria-label="Make primary contact"
                        disabled={busyId === user.id || user.primaryContact}
                        onClick={() => setPrimaryTarget(user)}
                      >
                        <UserCheck size={15} />
                      </button>
                      <button
                        type="button"
                        className={`cmIconButton${user.active ? " cmIconDanger" : ""}`}
                        title={user.active ? "Revoke access" : "Restore access"}
                        aria-label={user.active ? "Revoke access" : "Restore access"}
                        disabled={busyId === user.id}
                        onClick={() => { if (user.active) setRevokeTarget(user); else toggleActive(user); }}
                      >
                        {user.active ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && users.length > 0 && <p className="actionError" role="alert">{error}</p>}

      {linkOpen && (
        <LinkUserDialog
          client={client}
          onClose={() => setLinkOpen(false)}
          onDone={(message) => {
            setLinkOpen(false);
            if (typeof onChanged === "function") onChanged(message);
            load();
          }}
        />
      )}

      {revokeTarget && (
        <ConfirmDialog
          title="Revoke access"
          message={`Revoke ${revokeTarget.fullName || revokeTarget.email}'s portal access? The user-client link is preserved so the audit trail stays intact; you can restore access at any time.`}
          confirmLabel="Revoke access"
          busy={busyId === revokeTarget.id}
          onConfirm={() => toggleActive(revokeTarget)}
          onCancel={() => { if (busyId !== revokeTarget.id) setRevokeTarget(null); }}
        />
      )}

      {primaryTarget && (
        <ConfirmDialog
          title="Change primary contact"
          message={`Make ${primaryTarget.fullName || primaryTarget.email} the primary contact? Only one primary contact can exist per client, so the current one will be cleared.`}
          confirmLabel="Set as primary"
          busy={dialogBusy}
          onConfirm={confirmPrimary}
          onCancel={() => { if (!dialogBusy) setPrimaryTarget(null); }}
        />
      )}
    </div>
  );
}
