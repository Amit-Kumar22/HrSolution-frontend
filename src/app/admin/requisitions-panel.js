"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Send,
  XCircle,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  listRequisitions,
  getRequisition,
  getRequisitionDetail,
  createRequisition,
  updateRequisition,
  updateRequisitionStatus,
  updateRequisitionApproval,
  deleteRequisition,
  listUrgentRequisitions,
  requisitionStatusLabel,
  requisitionStatusTone,
  SKILL_LEVELS,
  SHIFT_OPTIONS,
  skillLevelLabel,
  shiftLabel,
} from "@/lib/requisitionApi";
import { listClients, listClientSites, listManpowerCategories } from "@/lib/adminApi";
import { getAuthSession, hasPermission } from "@/lib/auth";
import { getMyClient, listMySites } from "@/lib/clientApi";
import {
  Chip,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  SectionHead,
  formatDate,
  formatDateTime,
  useFlash,
} from "./admin-ui";

function errorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function payloadErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") return error.fields;
  return {};
}

const STATUS_OPTIONS = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELLED",
  "CLOSED",
];

const TERMINAL_STATUSES = ["FULFILLED", "CANCELLED", "CLOSED", "REJECTED"];

function StatusChip({ status }) {
  return <Chip tone={requisitionStatusTone(status)}>{requisitionStatusLabel(status)}</Chip>;
}

function todayDateString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function allowedStatusesOf(req) {
  if (!req) return [];
  const raw = req.allowedNextStatuses || req.nextStatuses || req.allowedStatuses || req.allowedTransitions;
  return Array.isArray(raw) ? raw : [];
}

function canTransition(req, target) {
  return allowedStatusesOf(req).includes(target);
}

function isTerminal(req) {
  if (req && typeof req.terminal === "boolean") return req.terminal;
  return TERMINAL_STATUSES.includes(req && req.status);
}

function requisitionIdOf(req) {
  return req ? req.id ?? req.requisitionId : null;
}

function requisitionNumber(req) {
  return req ? req.requisitionNumber || req.number || `#${requisitionIdOf(req)}` : "—";
}

function clientName(req) {
  if (!req) return "—";
  if (req.clientName) return req.clientName;
  const client = req.client || {};
  return client.legalName || client.displayName || "—";
}

function siteLabel(req) {
  if (!req) return "—";
  const site = req.site || {};
  return req.siteCode || site.siteCode || req.siteName || site.siteName || site.name || "—";
}

function categoryName(req) {
  if (!req) return "—";
  const category = req.manpowerCategory || {};
  return req.categoryName || category.name || category.categoryName || "—";
}

function useRequisitionPermissions(session) {
  return useMemo(() => {
    const user = (session && session.user) || {};
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const has = (list) => roles.some((role) => list.includes(String(role)));
    const isClient = has(["CLIENT"]);
    const isHr = has(["HR", "HR_RECRUITER", "HR_MANAGER"]);
    const isStaff = has(["SUPER_ADMIN", "ADMIN", "OPERATOR", "OPERATIONS", "OPERATIONS_MANAGER"]) && !isHr;
    const canApprove = !isClient && !isHr && (has(["SUPER_ADMIN", "ADMIN", "OPERATOR", "OPERATIONS", "OPERATIONS_MANAGER"]) || hasPermission(session, "REQUISITION_APPROVE"));
    const canCreate = isClient || isStaff;
    const canMutate = isClient || isStaff;
    const canDelete = !isHr && (hasPermission(session, "REQUISITION_DELETE") || hasPermission(session, "REQUISITION_MANAGE"));
    return {
      roles,
      isClient,
      isHr,
      isStaff,
      canApprove,
      canCreate,
      canSubmit: canMutate,
      canCancel: canMutate,
      canEdit: canMutate,
      canDelete,
    };
  }, [session]);
}

function useLookups({ isClient, isHr }) {
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [client, setClient] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const cats = await listManpowerCategories();
        setCategories(Array.isArray(cats) ? cats : []);
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (isClient) {
      getMyClient()
        .then((data) => setClient(data))
        .catch(() => setClient(null));
      return;
    }
    if (isHr) return;
    (async () => {
      try {
        const page = await listClients({ size: 100 });
        setClients(Array.isArray(page.content) ? page.content : []);
      } catch {
        setClients([]);
      }
    })();
  }, [isClient, isHr]);

  return { clients, categories, client };
}

async function loadSites(clientId, isClient) {
  if (!clientId) return [];
  try {
    const data = isClient ? await listMySites(clientId) : await listClientSites(clientId);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function RequisitionsPanel({ session: passedSession, onChanged } = {}) {
  const session = passedSession || getAuthSession();
  const perms = useRequisitionPermissions(session);
  const { isClient, isHr, canCreate, canApprove } = perms;

  const [tab, setTab] = useState("list");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const [filters, setFilters] = useState({ clientId: "", siteId: "", status: "", categoryId: "" });
  const [filterSites, setFilterSites] = useState([]);
  const { clients, categories, client } = useLookups({ isClient, isHr });

  const [flash, showFlash] = useFlash();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdRequisition, setCreatedRequisition] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (isClient || !filters.clientId) return undefined;
    let cancelled = false;
    loadSites(filters.clientId, false).then((sites) => {
      if (!cancelled) setFilterSites(sites);
    });
    return () => {
      cancelled = true;
    };
  }, [filters.clientId, isClient]);

  const load = useCallback(async () => {
    try {
      const res = await listRequisitions({
        clientId: isClient ? undefined : filters.clientId || undefined,
        siteId: filters.siteId || undefined,
        status: filters.status || undefined,
        categoryId: filters.categoryId || undefined,
        page,
        size,
      });
      setItems(Array.isArray(res.content) ? res.content : []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Requisitions could not be loaded."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters, isClient, page, size]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load, reloadToken]);

  function reload(message) {
    setLoading(true);
    setReloadToken((token) => token + 1);
    if (message) showFlash("success", message);
    if (typeof onChanged === "function") onChanged();
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteRequisition(requisitionIdOf(deleteTarget));
      const number = requisitionNumber(deleteTarget);
      setDeleteTarget(null);
      reload(`Requisition ${number} deleted.`);
    } catch (err) {
      setDeleteError(errorMessage(err, "The requisition could not be deleted."));
    } finally {
      setDeleteBusy(false);
    }
  }

  const approvals = useMemo(
    () => items.filter(
      (req) =>
        req.status === "SUBMITTED" ||
        canTransition(req, "APPROVED") ||
        canTransition(req, "REJECTED") ||
        canTransition(req, "CLOSED"),
    ),
    [items],
  );

  const displayItems = tab === "approvals" ? approvals : items;

  return (
    <div className="cmRequisitionsPanel">
      <SectionHead
        title={isClient ? "My Requisitions" : "Requisitions"}
        description={
          isClient
            ? "Raise staffing requirements and track their approval."
            : isHr
              ? "Read-only view of staffing requisitions and their approval history."
              : "Manage client staffing requisitions, approvals and fulfilment."
        }
        action={
          canCreate ? (
            <button type="button" className="primaryButton cmBtn" onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> {isClient ? "Raise Requirement" : "New Requisition"}
            </button>
          ) : null
        }
      />

      <FlashBanner flash={flash} />

      {canApprove && (
        <div className="cmTabs" role="tablist" aria-label="Requisition views">
          <button type="button" role="tab" aria-selected={tab === "list"} className={tab === "list" ? "cmTab cmTabActive" : "cmTab"} onClick={() => setTab("list")}>
            <ClipboardList size={14} /> All requisitions
          </button>
          <button type="button" role="tab" aria-selected={tab === "approvals"} className={tab === "approvals" ? "cmTab cmTabActive" : "cmTab"} onClick={() => setTab("approvals")}>
            <CheckCircle2 size={14} /> Approvals {approvals.length ? `(${approvals.length})` : ""}
          </button>
        </div>
      )}

      {tab === "list" && (
        <div className="cmToolbar">
          {!isClient && !isHr && (
            <label className="cmSelect">
              <Building2 size={14} />
              <select
                value={filters.clientId}
                onChange={(event) => {
                  setFilters((f) => ({ ...f, clientId: event.target.value, siteId: "" }));
                  setFilterSites([]);
                  setPage(0);
                }}
                aria-label="Filter by client"
              >
                <option value="">All clients</option>
                {clients.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.legalName || entry.displayName || entry.clientCode}</option>
                ))}
              </select>
            </label>
          )}
          {!isClient && !isHr && (
            <label className="cmSelect">
              <Filter size={14} />
              <select
                value={filters.siteId}
                onChange={(event) => { setFilters((f) => ({ ...f, siteId: event.target.value })); setPage(0); }}
                aria-label="Filter by site"
                disabled={!filters.clientId}
              >
                <option value="">All sites</option>
                {filterSites.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.siteCode || entry.siteName || entry.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="cmSelect">
            <Filter size={14} />
            <select
              value={filters.status}
              onChange={(event) => { setFilters((f) => ({ ...f, status: event.target.value })); setPage(0); }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{requisitionStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <Filter size={14} />
            <select
              value={filters.categoryId}
              onChange={(event) => { setFilters((f) => ({ ...f, categoryId: event.target.value })); setPage(0); }}
              aria-label="Filter by manpower category"
            >
              <option value="">All categories</option>
              {categories.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name || entry.categoryName}</option>
              ))}
            </select>
          </label>
          <button type="button" className="secondaryButton cmBtn" onClick={() => reload()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading requisitions…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : displayItems.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === "approvals" ? "No requisitions waiting for approval" : "No requisitions found"}
          message={
            tab === "approvals"
              ? "Requisitions submitted for approval will appear here."
              : isClient
                ? "You have not raised any requisitions yet."
                : "No requisitions match the current filters."
          }
        />
      ) : (
        <>
          <div className="cmTableWrap" style={{ marginTop: 12 }}>
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Requisition No.</th>
                  {!isClient && <th>Client</th>}
                  <th>Site</th>
                  <th>Category</th>
                  <th className="cmColCenter">Required</th>
                  <th className="cmColCenter">Deployed</th>
                  <th className="cmColCenter">Outstanding</th>
                  <th>Required From</th>
                  <th className="cmColCenter">Status</th>
                  <th className="cmColCenter">Urgent</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((req) => {
                  const id = requisitionIdOf(req);
                  return (
                    <tr key={id}>
                      <td><span className="cmCode">{requisitionNumber(req)}</span></td>
                      {!isClient && <td className="cmMuted">{clientName(req)}</td>}
                      <td className="cmMuted">{siteLabel(req)}</td>
                      <td className="cmMuted">{categoryName(req)}</td>
                      <td className="cmColCenter">{req.quantityRequired ?? "—"}</td>
                      <td className="cmColCenter">{req.quantityDeployed ?? "—"}</td>
                      <td className="cmColCenter">{req.quantityOutstanding ?? "—"}</td>
                      <td className="cmMuted">{req.requiredFrom ? formatDate(req.requiredFrom) : "—"}</td>
                      <td className="cmColCenter"><StatusChip status={req.status} /></td>
                      <td className="cmColCenter">{req.urgent ? <Chip tone="danger">Urgent</Chip> : "—"}</td>
                      <td className="cmColActions">
                        <div className="cmRowActions">
                          <button type="button" className="cmIconButton" title="View details" aria-label={`View ${requisitionNumber(req)}`} onClick={() => setDetailId(id)}>
                            <Eye size={15} />
                          </button>
                          {perms.canDelete && (
                            <button type="button" className="cmIconButton cmIconDanger" title="Delete requisition" aria-label={`Delete ${requisitionNumber(req)}`} onClick={() => { setDeleteError(""); setDeleteTarget(req); }}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="cmPagination">
              <button type="button" className="secondaryButton cmBtn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
              <span className="cmMuted">Page {page + 1} of {totalPages} · {totalElements} requisition{totalElements === 1 ? "" : "s"}</span>
              <button type="button" className="secondaryButton cmBtn" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {createOpen && (
        <RequisitionForm
          session={session}
          perms={perms}
          clients={clients}
          client={client}
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onDone={async (created) => {
            setCreateOpen(false);
            reload("Requisition created as DRAFT.");
            if (created) {
              const id = requisitionIdOf(created);
              if (id != null) setCreatedRequisition(created);
            }
          }}
        />
      )}

      {createdRequisition && (
        <RequisitionDetailDrawer
          requisitionId={requisitionIdOf(createdRequisition)}
          session={session}
          perms={perms}
          titlePrefix="Requisition created"
          onClose={() => setCreatedRequisition(null)}
          onAction={(message) => { setCreatedRequisition(null); reload(message); }}
          onEdit={(req) => { setCreatedRequisition(null); setEditTarget(req); }}
        />
      )}

      {detailId != null && (
        <RequisitionDetailDrawer
          requisitionId={detailId}
          session={session}
          perms={perms}
          onClose={() => setDetailId(null)}
          onAction={(message) => { setDetailId(null); reload(message); }}
          onEdit={(req) => { setDetailId(null); setEditTarget(req); }}
        />
      )}

      {editTarget && (
        <RequisitionForm
          mode="edit"
          session={session}
          perms={perms}
          initial={editTarget}
          clients={clients}
          client={client}
          categories={categories}
          onClose={() => setEditTarget(null)}
          onDone={() => { setEditTarget(null); reload("Requisition updated."); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete requisition"
          message={`Delete ${requisitionNumber(deleteTarget)}? This is a soft delete and preserves history. Requisitions with deployed workers cannot be deleted.`}
          confirmLabel="Delete requisition"
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteError(""); } }}
        >
          {deleteError && <p className="actionError" role="alert">{deleteError}</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}

function RequisitionForm({ mode = "create", session, perms, initial = null, clients = [], client = null, categories = [], onClose, onDone }) {
  const { isClient, isStaff } = perms;
  const [form, setForm] = useState(() => ({
    clientId: initial?.clientId ? String(initial.clientId) : isClient && client ? String(client.id) : "",
    siteId: initial?.siteId ? String(initial.siteId) : "",
    categoryId: initial?.categoryId ? String(initial.categoryId) : "",
    quantityRequired: initial?.quantityRequired != null ? String(initial.quantityRequired) : "",
    skillLevel: initial?.skillLevel || "UNSKILLED",
    shift: initial?.shift || "DAY",
    requiredFrom: initial?.requiredFrom ? String(initial.requiredFrom).substring(0, 10) : todayDateString(),
    requiredTo: initial?.requiredTo ? String(initial.requiredTo).substring(0, 10) : "",
    notes: initial?.notes || "",
  }));
  const [sites, setSites] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveClientId = form.clientId || (isClient && client ? String(client.id) : "");

  useEffect(() => {
    let cancelled = false;
    loadSites(effectiveClientId, isClient).then((data) => {
      if (!cancelled) setSites(data);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveClientId, isClient]);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = {};
    if (isStaff && !effectiveClientId) found.clientId = "Select the client this requirement is for.";
    if (!form.siteId) found.siteId = "Site is required.";
    if (!form.categoryId) found.categoryId = "Manpower category is required.";
    const quantity = Number(form.quantityRequired);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      found.quantityRequired = "Quantity must be a positive whole number.";
    }
    if (!form.requiredFrom) found.requiredFrom = "Required from date is required.";
    if (form.requiredFrom && form.requiredTo && form.requiredTo < form.requiredFrom) {
      found.requiredTo = "Required to cannot be earlier than Required from.";
    }
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        siteId: Number(form.siteId),
        categoryId: Number(form.categoryId),
        quantityRequired: quantity,
        skillLevel: form.skillLevel,
        shift: form.shift,
        requiredFrom: form.requiredFrom,
        requiredTo: form.requiredTo || undefined,
        notes: form.notes && form.notes.trim() ? form.notes.trim() : undefined,
      };
      if (mode === "edit") {
        const updated = await updateRequisition(requisitionIdOf(initial), payload);
        onDone(updated);
      } else {
        const created = await createRequisition(payload, effectiveClientId);
        onDone(created);
      }
    } catch (err) {
      setErrors(payloadErrors(err));
      setFormError(errorMessage(err, mode === "edit" ? "The requisition could not be updated." : "The requisition could not be created."));
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={mode === "edit" ? "Edit requisition" : isClient ? "Raise requirement" : "New requisition"}
      description={
        mode === "edit"
          ? "Update the requisition details. Validation matches the creation form."
          : "New requisitions are created as DRAFT. Submit them for approval once details are confirmed."
      }
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="requisition-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create requisition"}
          </button>
        </>
      )}
    >
      <form id="requisition-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <div className="cmFormGrid">
          {isStaff && (
            <Field label="Client" htmlFor="req-client" required error={errors.clientId} hint="Staff can raise requisitions on behalf of a client.">
              <select id="req-client" value={form.clientId} onChange={(event) => { update("clientId", event.target.value); update("siteId", ""); }}>
                <option value="">Select a client</option>
                {clients.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.legalName || entry.displayName || entry.clientCode}</option>
                ))}
              </select>
            </Field>
          )}
          {isClient && client && (
            <Field label="Client" htmlFor="req-client-readonly">
              <input id="req-client-readonly" type="text" value={client.legalName || client.displayName || client.clientCode || "Your company"} readOnly disabled />
            </Field>
          )}
          <div className="cmFormRow">
            <Field label="Site" htmlFor="req-site" required error={errors.siteId}>
              <select id="req-site" value={form.siteId} onChange={(event) => update("siteId", event.target.value)} disabled={!effectiveClientId}>
                <option value="">{effectiveClientId ? "Select a site" : "Select a client first"}</option>
                {sites.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.siteCode || entry.siteName || entry.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Manpower category" htmlFor="req-category" required error={errors.categoryId}>
              <select id="req-category" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
                <option value="">Select a category</option>
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name || entry.categoryName}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Required quantity" htmlFor="req-quantity" required error={errors.quantityRequired}>
              <input id="req-quantity" type="number" min="1" step="1" value={form.quantityRequired} placeholder="e.g. 12" onChange={(event) => update("quantityRequired", event.target.value)} />
            </Field>
            <Field label="Skill level" htmlFor="req-skill" required error={errors.skillLevel}>
              <select id="req-skill" value={form.skillLevel} onChange={(event) => update("skillLevel", event.target.value)}>
                {SKILL_LEVELS.map((entry) => (<option key={entry.value} value={entry.value}>{entry.label}</option>))}
              </select>
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Shift" htmlFor="req-shift" required error={errors.shift}>
              <select id="req-shift" value={form.shift} onChange={(event) => update("shift", event.target.value)}>
                {SHIFT_OPTIONS.map((entry) => (<option key={entry.value} value={entry.value}>{entry.label}</option>))}
              </select>
            </Field>
            <div />
          </div>
          <div className="cmFormRow">
            <Field label="Required from" htmlFor="req-from" required error={errors.requiredFrom}>
              <input id="req-from" type="date" value={form.requiredFrom} onChange={(event) => update("requiredFrom", event.target.value)} />
            </Field>
            <Field label="Required to" htmlFor="req-to" error={errors.requiredTo} hint="Leave blank if the requirement is ongoing.">
              <input id="req-to" type="date" value={form.requiredTo} onChange={(event) => update("requiredTo", event.target.value)} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="req-notes" error={errors.notes} hint="Optional. Anything the operations team should know.">
            <textarea id="req-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function historyList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.history)) return payload.history;
  if (payload && Array.isArray(payload.content)) return payload.content;
  if (payload && Array.isArray(payload.entries)) return payload.entries;
  return [];
}

function historyFrom(entry) {
  return entry ? entry.fromStatus ?? entry.previousStatus ?? null : null;
}

function historyTo(entry) {
  return entry ? entry.newStatus ?? entry.toStatus ?? entry.status ?? null : null;
}

function historyAt(entry) {
  return entry ? entry.changedAt ?? entry.createdAt ?? entry.timestamp ?? entry.date ?? null : null;
}

function RequisitionDetailDrawer({ requisitionId, session, perms, titlePrefix, onClose, onAction, onEdit }) {
  const [req, setReq] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [dialogRemarks, setDialogRemarks] = useState("");

  const fetchAll = useCallback(async () => {
    const [reqResult, detailResult] = await Promise.allSettled([
      getRequisition(requisitionId),
      getRequisitionDetail(requisitionId),
    ]);
    const detail = detailResult.status === "fulfilled" ? detailResult.value : null;
    const detailRequisition = detail && detail.requisition ? detail.requisition : null;
    if (reqResult.status === "fulfilled" && reqResult.value) {
      setReq(reqResult.value);
      setError("");
    } else if (detailRequisition) {
      setReq(detailRequisition);
      setError("");
    } else {
      setReq(null);
      setError(
        reqResult.status === "rejected"
          ? errorMessage(reqResult.reason, "The requisition could not be loaded.")
          : "The requisition could not be loaded.",
      );
    }
    if (detailResult.status === "fulfilled") {
      setHistory(historyList(detail));
      setHistoryError("");
    } else {
      setHistory([]);
      setHistoryError(errorMessage(detailResult.reason, "The requisition history could not be loaded."));
    }
    setLoading(false);
  }, [requisitionId]);

  useEffect(() => {
    (async () => { await fetchAll(); })();
  }, [fetchAll]);

  function retry() {
    setLoading(true);
    fetchAll();
  }

  const editable = useMemo(() => {
    if (!req || !perms.canEdit) return false;
    if (perms.isClient) return req.status === "DRAFT";
    if (perms.isStaff) return !isTerminal(req);
    return false;
  }, [req, perms]);

  const submitAllowed = perms.canSubmit && req && canTransition(req, "SUBMITTED");
  const cancelAllowed = perms.canCancel && req && canTransition(req, "CANCELLED");
  const approveAllowed = perms.canApprove && req && canTransition(req, "APPROVED");
  const rejectAllowed = perms.canApprove && req && canTransition(req, "REJECTED");
  const closeAllowed = perms.canApprove && req && canTransition(req, "CLOSED");

  async function runAction(target, extraRemarks) {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      const body = {
        status: target,
        remarks: extraRemarks && extraRemarks.trim() ? extraRemarks.trim() : undefined,
      };
      if (target === "APPROVED" || target === "REJECTED" || target === "CLOSED") {
        await updateRequisitionApproval(requisitionId, body);
      } else {
        await updateRequisitionStatus(requisitionId, body);
      }
      const message =
        target === "SUBMITTED" ? "Requisition submitted for approval."
          : target === "CANCELLED" ? "Requisition cancelled."
            : target === "APPROVED" ? "Requisition approved."
              : target === "REJECTED" ? "Requisition rejected."
                : target === "CLOSED" ? "Requisition closed."
                  : "Requisition updated.";
      setDialog(null);
      onAction(message);
    } catch (err) {
      setActionError(errorMessage(err, "The action could not be completed."));
      setActionBusy(false);
    }
  }

  return (
    <Drawer
      size="lg"
      title={req ? `${titlePrefix ? `${titlePrefix} · ` : ""}${requisitionNumber(req)}` : titlePrefix || "Requisition details"}
      description="Requisition details, approval history and permitted actions"
      onClose={onClose}
      footer={
        req ? (
          <div className="cmDrawerActions">
            {editable && (
              <button type="button" className="secondaryButton cmBtn" onClick={() => onEdit(req)} disabled={actionBusy}>
                <Pencil size={15} /> Edit
              </button>
            )}
            {submitAllowed && (
              <button type="button" className="primaryButton cmBtn" onClick={() => { setDialog("SUBMITTED"); setDialogRemarks("Requirement submitted for approval"); }} disabled={actionBusy}>
                <Send size={15} /> Submit for approval
              </button>
            )}
            {cancelAllowed && (
              <button type="button" className="secondaryButton cmBtn" onClick={() => { setDialog("CANCELLED"); setDialogRemarks(""); }} disabled={actionBusy}>
                <XCircle size={15} /> Cancel requisition
              </button>
            )}
            {approveAllowed && (
              <button type="button" className="primaryButton cmBtn" onClick={() => { setDialog("APPROVED"); setDialogRemarks(""); }} disabled={actionBusy}>
                <CheckCircle2 size={15} /> Approve
              </button>
            )}
            {rejectAllowed && (
              <button type="button" className="cmDangerButton cmBtn" onClick={() => { setDialog("REJECTED"); setDialogRemarks(""); }} disabled={actionBusy}>
                Reject
              </button>
            )}
            {closeAllowed && (
              <button type="button" className="secondaryButton cmBtn" onClick={() => { setDialog("CLOSED"); setDialogRemarks(""); }} disabled={actionBusy}>
                Close
              </button>
            )}
          </div>
        ) : null
      }
    >
      {loading ? (
        <LoadingState label="Loading requisition…" />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : req ? (
        <>
          {actionError && <p className="actionError" role="alert">{actionError}</p>}

          <div className="cmStatusRow" style={{ marginBottom: 12 }}>
            <StatusChip status={req.status} />
            {req.urgent && <Chip tone="danger">Urgent</Chip>}
            {req.terminal && <Chip tone="neutral">Terminal</Chip>}
            {req.acceptsDeployments && <Chip tone="info">Accepts deployments</Chip>}
          </div>

          <div className="cmDetailGrid">
            <DetailRow label="Requisition number" value={requisitionNumber(req)} />
            <DetailRow label="Client" value={clientName(req)} />
            <DetailRow label="Site" value={req.siteName || (req.site && (req.site.siteName || req.site.name)) || siteLabel(req)} />
            <DetailRow label="Site code" value={siteLabel(req)} />
            <DetailRow label="Site state code" value={req.siteStateCode || (req.site && req.site.stateCode) || "—"} />
            <DetailRow label="Manpower category" value={categoryName(req)} />
            <DetailRow label="Skill level" value={skillLevelLabel(req.skillLevel)} />
            <DetailRow label="Effective skill level" value={skillLevelLabel(req.effectiveSkillLevel || req.skillLevel)} />
            <DetailRow label="Required quantity" value={req.quantityRequired ?? "—"} />
            <DetailRow label="Deployed quantity" value={req.quantityDeployed ?? "—"} />
            <DetailRow label="Outstanding quantity" value={req.quantityOutstanding ?? "—"} />
            <DetailRow label="Shift" value={shiftLabel(req.shift)} />
            <DetailRow label="Required from" value={req.requiredFrom ? formatDate(req.requiredFrom) : "—"} />
            <DetailRow label="Required to" value={req.requiredTo ? formatDate(req.requiredTo) : "—"} />
            <DetailRow label="Raised by" value={req.raisedByEmail || req.raisedByName || (req.raisedByUserId != null ? `User #${req.raisedByUserId}` : "—")} />
            <DetailRow label="Approved by" value={req.approvedByName || (req.approvedByUserId != null ? `User #${req.approvedByUserId}` : "—")} />
            <DetailRow label="Approval date" value={req.approvedAt ? formatDateTime(req.approvedAt) : "—"} />
            <DetailRow label="Created" value={req.createdAt ? formatDateTime(req.createdAt) : "—"} />
            {req.rejectionReason && <DetailRow label="Rejection reason" value={req.rejectionReason} wide />}
            {req.notes && <DetailRow label="Notes" value={req.notes} wide />}
            {allowedStatusesOf(req).length > 0 && (
              <DetailRow
                label="Allowed next statuses"
                value={allowedStatusesOf(req).map((status) => requisitionStatusLabel(status)).join(", ")}
                wide
              />
            )}
          </div>

          <div className="cmDetailSection">
            <h3>Approval &amp; status history</h3>
            {historyError ? (
              <p className="cmMuted">{historyError}</p>
            ) : history.length === 0 ? (
              <p className="cmMuted">No history recorded yet.</p>
            ) : (
              <ol className="cmTimeline">
                {history.map((entry, index) => {
                  const from = historyFrom(entry);
                  const to = historyTo(entry);
                  return (
                    <li key={index} className="cmTimelineItem">
                      <span className="cmTimelineDot" aria-hidden="true" />
                      <div className="cmTimelineContent">
                        <div className="cmTimelineHead">
                          <strong>
                            {from ? `${requisitionStatusLabel(from)} → ${requisitionStatusLabel(to)}` : index === 0 ? "Requisition created" : requisitionStatusLabel(to)}
                          </strong>
                          <small className="cmMuted">{historyAt(entry) ? formatDateTime(historyAt(entry)) : "—"}</small>
                        </div>
                        {(entry.changedByEmail || entry.changedByUserId != null) && (
                          <div className="cmMuted">
                            By {entry.changedByEmail || `user #${entry.changedByUserId}`}
                          </div>
                        )}
                        {entry.remarks && <div className="cmTimelineRemarks">{entry.remarks}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </>
      ) : null}

      {dialog && (
        <ConfirmDialog
          title={
            dialog === "SUBMITTED" ? "Submit requisition"
              : dialog === "CANCELLED" ? "Cancel requisition"
                : dialog === "APPROVED" ? "Approve requisition"
                  : dialog === "REJECTED" ? "Reject requisition"
                    : "Close requisition"
          }
          message={
            dialog === "SUBMITTED" ? "Submit this requisition for approval?"
              : dialog === "CANCELLED" ? "Cancel this requisition? This cannot be undone."
                : dialog === "APPROVED" ? "Approve this requisition?"
                  : dialog === "REJECTED" ? "Reject this requisition. A reason is required."
                    : "Close this requisition? Only permitted when all demand is fulfilled."
          }
          confirmLabel={
            dialog === "SUBMITTED" ? "Submit"
              : dialog === "CANCELLED" ? "Cancel requisition"
                : dialog === "APPROVED" ? "Approve"
                  : dialog === "REJECTED" ? "Reject"
                    : "Close"
          }
          confirmVariant={dialog === "SUBMITTED" || dialog === "APPROVED" || dialog === "CLOSED" ? "primary" : "danger"}
          busy={actionBusy}
          onConfirm={() => {
            if (dialog === "REJECTED" && !dialogRemarks.trim()) {
              setActionError("Rejection remarks are required.");
              return;
            }
            runAction(dialog, dialogRemarks);
          }}
          onCancel={() => { if (!actionBusy) { setDialog(null); setDialogRemarks(""); setActionError(""); } }}
        >
          {dialog === "REJECTED" ? (
            <Field label="Rejection remarks" htmlFor="req-reject-remarks" required>
              <textarea
                id="req-reject-remarks"
                rows={3}
                maxLength={1000}
                value={dialogRemarks}
                placeholder="Explain why this requisition is rejected"
                onChange={(event) => setDialogRemarks(event.target.value)}
              />
            </Field>
          ) : null}
          {dialog === "CANCELLED" || dialog === "CLOSED" ? (
            <Field label="Remarks" htmlFor="req-cancel-remarks" hint="Optional, recorded in the status history.">
              <textarea
                id="req-cancel-remarks"
                rows={2}
                maxLength={1000}
                value={dialogRemarks}
                onChange={(event) => setDialogRemarks(event.target.value)}
              />
            </Field>
          ) : null}
          {actionError && <p className="actionError" role="alert">{actionError}</p>}
        </ConfirmDialog>
      )}
    </Drawer>
  );
}

function DetailRow({ label, value, wide = false }) {
  return (
    <div className={`cmDetailRow${wide ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

export function UrgentRequisitionsWidget({ session: passedSession, withinDays = 7, onNavigate, embedded = false }) {
  const session = passedSession || getAuthSession();
  const perms = useRequisitionPermissions(session);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [detailId, setDetailId] = useState(null);

  const allowed = perms.isStaff || perms.isHr;

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const data = await listUrgentRequisitions({ withinDays });
      setItems(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Urgent requisitions could not be loaded."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, withinDays]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load, reloadToken]);

  function refresh() {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }

  if (!allowed) return null;

  return (
    <section className={`cmUrgentWidget${embedded ? " cmUrgentWidgetEmbedded" : ""}`} aria-label="Urgent requisitions to fill">
      <div className="cmUrgentHead">
        <div>
          <h2><AlertTriangle size={16} /> Urgent to fill</h2>
          <p>Requisitions starting within {withinDays} day{withinDays === 1 ? "" : "s"} that still need workers.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onNavigate ? (
            <button type="button" className="secondaryButton cmBtn" onClick={() => onNavigate("requisitions")}>
              View all
            </button>
          ) : null}
          <button type="button" className="cmIconButton" title="Refresh urgent requisitions" aria-label="Refresh urgent requisitions" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading urgent requisitions…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing urgent" message="No requisitions are starting soon with outstanding demand." />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Client</th>
                <th>Site</th>
                <th>Category</th>
                <th className="cmColCenter">Required</th>
                <th className="cmColCenter">Deployed</th>
                <th className="cmColCenter">Outstanding</th>
                <th>Required From</th>
                <th className="cmColCenter">Status</th>
                <th className="cmColCenter">Urgent</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((req) => {
                const id = requisitionIdOf(req);
                return (
                  <tr key={id}>
                    <td><span className="cmCode">{requisitionNumber(req)}</span></td>
                    <td className="cmMuted">{clientName(req)}</td>
                    <td className="cmMuted">{siteLabel(req)}</td>
                    <td className="cmMuted">{categoryName(req)}</td>
                    <td className="cmColCenter">{req.quantityRequired ?? "—"}</td>
                    <td className="cmColCenter">{req.quantityDeployed ?? "—"}</td>
                    <td className="cmColCenter">{req.quantityOutstanding ?? "—"}</td>
                    <td className="cmMuted">{req.requiredFrom ? formatDate(req.requiredFrom) : "—"}</td>
                    <td className="cmColCenter"><StatusChip status={req.status} /></td>
                    <td className="cmColCenter">{req.urgent === false ? "—" : <Chip tone="danger">Urgent</Chip>}</td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" title="View details" aria-label={`View ${requisitionNumber(req)}`} onClick={() => setDetailId(id)}>
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailId != null && (
        <RequisitionDetailDrawer
          requisitionId={detailId}
          session={session}
          perms={{ ...perms, canEdit: false }}
          onClose={() => setDetailId(null)}
          onAction={() => { setDetailId(null); refresh(); }}
          onEdit={() => setDetailId(null)}
        />
      )}
    </section>
  );
}
