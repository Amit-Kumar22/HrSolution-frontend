"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import {
  approveAccountClient,
  assignAccountRoles,
  disableAccount,
  enableAccount,
  getAccount,
  listAccounts,
  listRoles,
  rejectAccountClient,
  unlockAccount,
  updateAccount,
} from "../../lib/adminApi";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  Notice,
  SectionHead,
  formatDateTime,
  useFlash,
} from "../admin/admin-ui";
import {
  ACCOUNT_STATUSES,
  dashboardForRole,
  displayName,
  initialsOf,
  roleLabel,
  statusMeta,
} from "./account-meta";
import AccountForm from "./account-form";

const PAGE_SIZES = [10, 20, 50, 100];

function StatusPill({ status }) {
  const meta = statusMeta(status);
  return <Chip tone={meta.tone}>{meta.label}</Chip>;
}

function RoleTags({ roles }) {
  if (!Array.isArray(roles) || !roles.length) return <span className="cmMuted">No role</span>;
  return (
    <div className="saRoleTags">
      {roles.map((role) => (
        <span key={role} className={`saRoleTag${role === "SUPER_ADMIN" ? " saRoleTagSuper" : ""}`}>
          {roleLabel(role)}
        </span>
      ))}
    </div>
  );
}

function AccountCell({ account }) {
  const name = displayName(account);
  return (
    <div className="saAccountCell">
      <span className="cmAvatar cmAvatarFallback">{initialsOf(name)}</span>
      <span>
        <strong>{name}</strong>
        <small>{account.email}</small>
      </span>
    </div>
  );
}

function SortHeader({ label, field, sortBy, sortDir, onSort }) {
  const active = sortBy === field;
  return (
    <th aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={`saSort${active ? " saSortActive" : ""}`} onClick={() => onSort(field)}>
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp size={13} />
          ) : (
            <ArrowDown size={13} />
          )
        ) : (
          <ArrowUpDown size={13} />
        )}
      </button>
    </th>
  );
}

function isPendingClientRegistration(account) {
  if (!account || account.status !== "PENDING_APPROVAL") return false;
  if (account.pendingCompanyName) return true;
  return Array.isArray(account.roles) && account.roles.includes("CLIENT");
}

const EDIT_EMPTY = { firstName: "", lastName: "", phone: "" };

export default function AccountsPanel({ initialCreateOpen = false, currentUserId }) {
  const [pageData, setPageData] = useState({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const [createOpen, setCreateOpen] = useState(Boolean(initialCreateOpen));
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EDIT_EMPTY);
  const [editErrors, setEditErrors] = useState({});
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [rolesTarget, setRolesTarget] = useState(null);
  const [rolesDraft, setRolesDraft] = useState([]);
  const [rolesError, setRolesError] = useState("");
  const [rolesSaving, setRolesSaving] = useState(false);

  const [disableTarget, setDisableTarget] = useState(null);
  const [disableReason, setDisableReason] = useState("");
  const [disableBusy, setDisableBusy] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listRoles();
        if (!cancelled) setRoles(data);
      } catch {
        if (!cancelled) setRoles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listAccounts({
          search,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          page,
          size,
          sort: [`${sortBy},${sortDir}`],
        });
        if (cancelled) return;
        setPageData(data);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Accounts could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, roleFilter, statusFilter, page, size, sortBy, sortDir, reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  function toggleSort(field) {
    if (sortBy === field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "createdAt" || field === "lastLoginAt" ? "desc" : "asc");
    }
    setPage(0);
  }

  const roleOptions = useMemo(
    () => [...roles].sort((a, b) => roleLabel(a.name).localeCompare(roleLabel(b.name))),
    [roles],
  );

  async function runAction(id, work, successMessage) {
    if (busyId) return;
    setBusyId(id);
    try {
      await work();
      showFlash("success", successMessage);
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setBusyId(null);
    }
  }

  function openDetail(account) {
    setDetail(account);
    setDetailError("");
    setDetailLoading(true);
    getAccount(account.id)
      .then((full) => setDetail(full || account))
      .catch((error) => setDetailError(error instanceof Error ? error.message : "The account could not be loaded."))
      .finally(() => setDetailLoading(false));
  }

  function openEdit(account) {
    setEditTarget(account);
    setEditForm({
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      phone: account.phone || "",
    });
    setEditErrors({});
    setEditError("");
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (editSaving || !editTarget) return;
    const errors = {};
    if (!editForm.firstName.trim()) errors.firstName = "First name is required.";
    if (editForm.phone.trim() && !/^[6-9][0-9]{9}$/.test(editForm.phone.trim())) {
      errors.phone = "Enter a valid 10-digit mobile number, or leave blank.";
    }
    setEditErrors(errors);
    if (Object.keys(errors).length) return;

    setEditError("");
    setEditSaving(true);
    try {
      await updateAccount(editTarget.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
      });
      showFlash("success", "Account details updated.");
      setEditTarget(null);
      reload();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "The account could not be updated.");
    } finally {
      setEditSaving(false);
    }
  }

  function openRoles(account) {
    setRolesTarget(account);
    setRolesDraft(Array.isArray(account.roles) ? [...account.roles] : []);
    setRolesError("");
  }

  function toggleRoleDraft(roleName) {
    setRolesDraft((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName],
    );
    setRolesError("");
  }

  async function saveRoles(event) {
    event.preventDefault();
    if (rolesSaving || !rolesTarget) return;
    if (!rolesDraft.length) {
      setRolesError("A user must keep at least one role.");
      return;
    }
    setRolesError("");
    setRolesSaving(true);
    try {
      await assignAccountRoles(rolesTarget.id, rolesDraft);
      showFlash("success", "Roles updated. The user's sessions were revoked so the change applies at once.");
      setRolesTarget(null);
      reload();
    } catch (error) {
      setRolesError(error instanceof Error ? error.message : "The roles could not be updated.");
    } finally {
      setRolesSaving(false);
    }
  }

  async function confirmDisable() {
    if (!disableTarget || disableBusy) return;
    setDisableBusy(true);
    try {
      await disableAccount(disableTarget.id, disableReason);
      showFlash("success", "Account disabled and its sessions revoked.");
      setDisableTarget(null);
      setDisableReason("");
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The account could not be disabled.");
    } finally {
      setDisableBusy(false);
    }
  }

  async function confirmReject() {
    if (!rejectTarget || rejectBusy) return;
    if (!rejectReason.trim()) {
      showFlash("error", "A reason is required to reject a client registration.");
      return;
    }
    setRejectBusy(true);
    try {
      await rejectAccountClient(rejectTarget.id, rejectReason);
      showFlash("success", "Client registration rejected.");
      setRejectTarget(null);
      setRejectReason("");
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The registration could not be rejected.");
    } finally {
      setRejectBusy(false);
    }
  }

  const detailDashboard = detail ? dashboardForRole(Array.isArray(detail.roles) ? detail.roles[0] : null) : null;

  return (
    <div className="saAccountsPanel">
      <SectionHead
        title="Accounts"
        description="Every staff sign-in in one place. Create accounts, assign roles, and control which dashboard each person can reach."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <label className="cmSearchBox">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search accounts"
          />
        </label>
        <div className="cmToolbarControls">
          <label className="cmSelect">
            Role
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.name} value={role.name}>
                  {roleLabel(role.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            Status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All statuses</option>
              {ACCOUNT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusMeta(status).label}
                </option>
              ))}
            </select>
          </label>
          <span className="cmCount">{pageData.totalElements} account(s)</span>
          <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Add new account
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading accounts…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : !pageData.content.length ? (
        <EmptyState title="No accounts found" message="Adjust the filters or create a new account to get started." />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <SortHeader label="Account" field="firstName" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th>Phone</th>
                  <th>Roles</th>
                  <SortHeader label="Status" field="status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Created" field="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortHeader
                    label="Last sign-in"
                    field="lastLoginAt"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <AccountCell account={account} />
                    </td>
                    <td className="cmMuted">{account.phone || "—"}</td>
                    <td>
                      <RoleTags roles={account.roles} />
                    </td>
                    <td>
                      <div className="cmStatusRow">
                        <StatusPill status={account.status} />
                        {account.emailVerified ? (
                          <Chip tone="success">Verified</Chip>
                        ) : (
                          <Chip tone="info">Unverified</Chip>
                        )}
                        {account.locked && (
                          <Chip tone="warn">
                            <Lock size={10} /> Locked
                          </Chip>
                        )}
                      </div>
                    </td>
                    <td className="cmMuted">{formatDateTime(account.createdAt)}</td>
                    <td className="cmMuted">
                      {account.lastLoginAt ? (
                        <span className="saInlineStack">
                          <span>{formatDateTime(account.lastLoginAt)}</span>
                          {account.lastLoginIp ? <small>{account.lastLoginIp}</small> : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button
                          type="button"
                          className="cmIconButton"
                          title="View details"
                          onClick={() => openDetail(account)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="cmIconButton"
                          title="Edit details"
                          onClick={() => openEdit(account)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="cmIconButton"
                          title={account.id === currentUserId ? "You cannot change your own roles" : "Assign roles"}
                          disabled={account.id === currentUserId}
                          onClick={() => openRoles(account)}
                        >
                          <ShieldCheck size={15} />
                        </button>
                        {isPendingClientRegistration(account) && (
                          <>
                            <button
                              type="button"
                              className="cmIconButton"
                              title="Approve client registration"
                              disabled={busyId === account.id}
                              onClick={() =>
                                runAction(
                                  account.id,
                                  () => approveAccountClient(account.id),
                                  "Client registration approved.",
                                )
                              }
                            >
                              <ShieldCheck size={15} />
                            </button>
                            <button
                              type="button"
                              className="cmIconButton cmIconDanger"
                              title="Reject client registration"
                              disabled={busyId === account.id}
                              onClick={() => {
                                setRejectTarget(account);
                                setRejectReason("");
                              }}
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        {account.locked && (
                          <button
                            type="button"
                            className="cmIconButton"
                            title="Clear sign-in lockout"
                            disabled={busyId === account.id}
                            onClick={() =>
                              runAction(account.id, () => unlockAccount(account.id), "Account lockout cleared.")
                            }
                          >
                            <Unlock size={15} />
                          </button>
                        )}
                        {account.status === "DISABLED" ? (
                          <button
                            type="button"
                            className="cmIconButton"
                            title="Enable account"
                            disabled={busyId === account.id}
                            onClick={() =>
                              runAction(account.id, () => enableAccount(account.id), "Account enabled.")
                            }
                          >
                            <UserCheck size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="cmIconButton cmIconDanger"
                            title={account.id === currentUserId ? "You cannot disable your own account" : "Disable account"}
                            disabled={busyId === account.id || account.id === currentUserId}
                            onClick={() => {
                              setDisableTarget(account);
                              setDisableReason("");
                            }}
                          >
                            <UserX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cmPagination">
            <label className="cmSelect">
              Rows
              <select
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  setPage(0);
                }}
              >
                {PAGE_SIZES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <span className="cmPageInfo">
              Page {pageData.totalPages ? pageData.page + 1 : 0} of {pageData.totalPages}
            </span>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              disabled={pageData.first}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              disabled={pageData.last}
              onClick={() => setPage((value) => value + 1)}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}

      {createOpen && (
        <AccountForm
          roles={roleOptions}
          onClose={() => setCreateOpen(false)}
          onCreated={(account) => {
            setCreateOpen(false);
            showFlash("success", `${displayName(account)} can now sign in with the assigned role(s).`);
            reload();
          }}
        />
      )}

      {detail && (
        <Modal
          title="Account details"
          description={`Account #${detail.id}`}
          onClose={() => setDetail(null)}
          wide
        >
          {detailError && <Notice tone="error">{detailError}</Notice>}
          {detailLoading ? (
            <LoadingState label="Loading account…" />
          ) : (
            <>
              <div className="saProfileHead">
                <span className="cmAvatar cmAvatarFallback">{initialsOf(displayName(detail))}</span>
                <div>
                  <h2>{displayName(detail)}</h2>
                  <p>{detail.email}</p>
                </div>
              </div>
              <dl className="saMetaGrid">
                <div>
                  <dt>User ID</dt>
                  <dd>#{detail.id}</dd>
                </div>
                <div>
                  <dt>Full name</dt>
                  <dd>{detail.fullName || displayName(detail) || "—"}</dd>
                </div>
                <div>
                  <dt>First name</dt>
                  <dd>{detail.firstName || "—"}</dd>
                </div>
                <div>
                  <dt>Last name</dt>
                  <dd>{detail.lastName || "—"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{detail.phone || "—"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={detail.status} />
                  </dd>
                </div>
                <div>
                  <dt>Email verified</dt>
                  <dd>{detail.emailVerified ? "Yes" : "No"}</dd>
                </div>
                {detail.pendingCompanyName ? (
                  <div>
                    <dt>Pending company</dt>
                    <dd>{detail.pendingCompanyName}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Roles</dt>
                  <dd>
                    <RoleTags roles={detail.roles} />
                  </dd>
                </div>
                <div>
                  <dt>Dashboard</dt>
                  <dd>{detailDashboard ? detailDashboard.label : "—"}</dd>
                </div>
                <div>
                  <dt>Lockout</dt>
                  <dd>
                    {detail.locked ? `Locked · ${detail.lockRemainingSeconds || 0}s remaining` : "Not locked"}
                    {Number(detail.failedAttempts) > 0 ? ` · ${detail.failedAttempts} failed attempt(s)` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last sign-in</dt>
                  <dd>
                    {formatDateTime(detail.lastLoginAt)}
                    {detail.lastLoginIp ? ` · ${detail.lastLoginIp}` : ""}
                  </dd>
                </div>
              </dl>
              <div className="cmModalFooter">
                <button type="button" className="secondaryButton cmBtn" onClick={() => setDetail(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="secondaryButton cmBtn"
                  onClick={() => {
                    setDetail(null);
                    openRoles(detail);
                  }}
                >
                  <ShieldCheck size={15} /> Manage roles
                </button>
                <button
                  type="button"
                  className="primaryButton cmBtn"
                  onClick={() => {
                    setDetail(null);
                    openEdit(detail);
                  }}
                >
                  <Pencil size={15} /> Edit
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {editTarget && (
        <Modal
          title="Edit account"
          description="Email is immutable. Roles and status have their own controls."
          onClose={() => (editSaving ? null : setEditTarget(null))}
        >
          {editError && <Notice tone="error">{editError}</Notice>}
          <form className="cmForm cmFormGrid" onSubmit={saveEdit}>
            <div className="cmFormRow">
              <Field label="First name" htmlFor="ed-first" required error={editErrors.firstName}>
                <input
                  id="ed-first"
                  value={editForm.firstName}
                  onChange={(event) => setEditForm((p) => ({ ...p, firstName: event.target.value }))}
                  disabled={editSaving}
                  maxLength={100}
                />
              </Field>
              <Field label="Last name" htmlFor="ed-last">
                <input
                  id="ed-last"
                  value={editForm.lastName}
                  onChange={(event) => setEditForm((p) => ({ ...p, lastName: event.target.value }))}
                  disabled={editSaving}
                  maxLength={100}
                />
              </Field>
            </div>
            <Field label="Phone number" htmlFor="ed-phone" error={editErrors.phone} hint="Optional · 10-digit mobile">
              <input
                id="ed-phone"
                value={editForm.phone}
                onChange={(event) => setEditForm((p) => ({ ...p, phone: event.target.value }))}
                disabled={editSaving}
                maxLength={10}
              />
            </Field>
            <div className="cmModalFooter">
              <button
                type="button"
                className="secondaryButton cmBtn"
                onClick={() => setEditTarget(null)}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button type="submit" className="primaryButton cmBtn" disabled={editSaving}>
                {editSaving ? (
                  <>
                    <Loader2 size={15} className="spin" /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {rolesTarget && (
        <Modal
          title="Assign roles"
          description={`${displayName(rolesTarget)} · ${rolesTarget.email}`}
          onClose={() => (rolesSaving ? null : setRolesTarget(null))}
          wide
        >
          <Notice tone="warn">
            Replacing roles signs the user out everywhere so the new access takes effect immediately.
          </Notice>
          {rolesError && <Notice tone="error">{rolesError}</Notice>}
          <form className="cmForm cmFormGrid" onSubmit={saveRoles}>
            <div className="cmCheckList">
              {roleOptions.map((role) => {
                const checked = rolesDraft.includes(role.name);
                return (
                  <label key={role.name} className={`cmCheckItem${checked ? " cmCheckChecked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRoleDraft(role.name)}
                      disabled={rolesSaving}
                    />
                    <span className="cmCheckBox" aria-hidden="true" />
                    <span className="cmCheckText">
                      <strong>{roleLabel(role.name)}</strong>
                      <small>{role.description || `Dashboard: ${dashboardForRole(role.name).label}`}</small>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="cmModalFooter">
              <button
                type="button"
                className="secondaryButton cmBtn"
                onClick={() => setRolesTarget(null)}
                disabled={rolesSaving}
              >
                Cancel
              </button>
              <button type="submit" className="primaryButton cmBtn" disabled={rolesSaving}>
                {rolesSaving ? (
                  <>
                    <Loader2 size={15} className="spin" /> Saving…
                  </>
                ) : (
                  "Replace roles"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {disableTarget && (
        <ConfirmDialog
          title="Disable account"
          message={`${displayName(disableTarget)} will be signed out everywhere and blocked from signing in until re-enabled.`}
          confirmLabel="Disable account"
          busy={disableBusy}
          onCancel={() => {
            if (!disableBusy) {
              setDisableTarget(null);
              setDisableReason("");
            }
          }}
          onConfirm={confirmDisable}
        >
          <div className="cmForm">
            <Field label="Reason (optional)" htmlFor="disable-reason">
              <input
                id="disable-reason"
                value={disableReason}
                onChange={(event) => setDisableReason(event.target.value)}
                maxLength={300}
                placeholder="Recorded in the audit log"
                disabled={disableBusy}
              />
            </Field>
          </div>
        </ConfirmDialog>
      )}

      {rejectTarget && (
        <ConfirmDialog
          title="Reject client registration"
          message={`${
            rejectTarget.pendingCompanyName
              ? `${rejectTarget.pendingCompanyName} (${rejectTarget.email})`
              : displayName(rejectTarget)
          } will be rejected and the applicant will not be able to sign in.`}
          confirmLabel="Reject registration"
          busy={rejectBusy}
          onCancel={() => {
            if (!rejectBusy) {
              setRejectTarget(null);
              setRejectReason("");
            }
          }}
          onConfirm={confirmReject}
        >
          <div className="cmForm">
            <Field label="Reason" htmlFor="reject-reason" required>
              <input
                id="reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                maxLength={300}
                placeholder="Why is this registration being rejected?"
                disabled={rejectBusy}
              />
            </Field>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
