"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Filter,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
  MapPin,
} from "lucide-react";
import {
  deleteClient,
  getClient,
  listClients,
  listPendingClientRegistrations,
  rejectClientRegistration,
} from "@/lib/adminApi";
import { getAuthSession, isInternalRole } from "@/lib/auth";
import { CLIENT_STATUS_OPTIONS, statusLabel } from "@/lib/client-forms";
import { GST_STATES } from "@/lib/gst-states";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  SectionHead,
  formatDate,
  useFlash,
} from "./admin-ui";
import { ApproveRegistrationDialog, ClientFormDialog, ClientStatusDialog, StatusChip } from "./client-modals";
import ClientDetail from "./client-detail";

const PAGE_SIZES = [10, 20, 50];

function toStateOptions() {
  return GST_STATES.map((state) => ({ value: state.code, label: `${state.code} · ${state.name}` })).sort((a, b) => a.value.localeCompare(b.value));
}

function messageOf(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ClientsPanel() {
  const [pageData, setPageData] = useState({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateCodeFilter, setStateCodeFilter] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const [reloadToken, setReloadToken] = useState(0);
  const [pendingPage, setPendingPage] = useState({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");

  const [detailClient, setDetailClient] = useState(null);
  const [detailActiveTab, setDetailActiveTab] = useState("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const stateOptions = toStateOptions();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listClients({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          stateCode: stateCodeFilter || undefined,
          page,
          size,
          sort: ["legalName,ASC"],
        });
        if (cancelled) return;
        setPageData(data);
        setLoadError("");
      } catch (error) {
        if (!cancelled) setLoadError(messageOf(error, "Clients could not be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, stateCodeFilter, page, size, reloadToken]);

  async function loadPending(cancelledRef = { current: false }) {
    setPendingLoading(true);
    try {
      const data = await listPendingClientRegistrations({ page: 0, size: 10, sort: ["createdAt,DESC"] });
      if (cancelledRef.current) return;
      setPendingPage(data);
      setPendingError("");
    } catch (error) {
      if (cancelledRef.current) return;
      setPendingError(messageOf(error, "Pending registrations could not be loaded."));
    } finally {
      if (cancelledRef.current) return;
      setPendingLoading(false);
    }
  }

  useEffect(() => {
    const cancelledRef = { current: false };
    (async () => {
      await loadPending(cancelledRef);
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  function reload() {
    setLoading(true);
    setReloadToken((token) => token + 1);
    loadPending();
  }

  async function handleReject() {
    if (!rejectTarget || deleting) return;
    setDeleting(true);
    try {
      await rejectClientRegistration(rejectTarget.id, rejectReason);
      showFlash("success", "Client registration rejected.");
      setRejectTarget(null);
      setRejectReason("");
      reload();
    } catch (error) {
      showFlash("error", messageOf(error, "The registration could not be rejected."));
    } finally {
      setDeleting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      showFlash("success", "Client deleted (soft delete).");
      setDeleteTarget(null);
      reload();
      if (detailClient && detailClient.id === deleteTarget.id) setDetailClient(null);
    } catch (error) {
      showFlash("error", messageOf(error, "The client could not be deleted."));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function openEdit(client) {
    if (!client) return;
    try {
      const full = await getClient(client.id);
      setEditTarget(full || client);
    } catch (error) {
      showFlash("error", messageOf(error, "The client could not be loaded for editing."));
    }
  }

  const hasInternal = isInternalRole(getAuthSession());

  const totalPages = pageData.totalPages || 0;
  const current = Math.min(page + 1, Math.max(totalPages, 1));

  return (
    <div>
      <SectionHead
        title="Client management"
        description="Manage clients, sites, users, approvals, statuses and the full client overview."
      />

      <FlashBanner flash={flash} />

      {pendingPage.content.length > 0 && (
        <div className="cmDetailSection" style={{ marginTop: 0, marginBottom: 24 }}>
          <h3>Pending client registrations</h3>
          {pendingError && <p className="actionError" role="alert">{pendingError}</p>}
          {pendingLoading ? (
            <LoadingState label="Loading pending registrations…" />
          ) : (
            <div className="cmTableWrap">
              <table className="cmTable">
                <thead>
                  <tr>
                    <th>Registrant</th>
                    <th>Company</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Registered</th>
                    <th className="cmColActions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPage.content.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName || user.email}</td>
                      <td>{user.pendingCompanyName || "—"}</td>
                      <td className="cmMuted">{user.email}</td>
                      <td className="cmMuted">{user.phone || "—"}</td>
                      <td className="cmMuted">{user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}</td>
                      <td className="cmColActions">
                        <div className="cmRowActions">
                          <button type="button" className="cmIconButton" title="Approve" onClick={() => setApproveTarget(user)}>
                            <ShieldCheck size={15} />
                          </button>
                          <button type="button" className="cmIconButton cmIconDanger" title="Reject" onClick={() => setRejectTarget(user)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="cmToolbar">
        <label className="cmSearchBox">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder="Search legal name, trade name, GSTIN, city"
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">{pageData.totalElements} client{pageData.totalElements === 1 ? "" : "s"}</span>
          <label className="cmSelect">
            <ListFilter size={14} />
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
              <option value="">All statuses</option>
            {CLIENT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <Filter size={14} />
            <select value={stateCodeFilter} onChange={(event) => { setStateCodeFilter(event.target.value); setPage(0); }}>
              <option value="">All states</option>
              {stateOptions.map((state) => (
                <option key={state.value} value={state.value}>{state.label}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <span>Per page</span>
            <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
          {hasInternal && (
            <button type="button" className="primaryButton cmBtn" onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> Add client
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading clients…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : pageData.content.length === 0 ? (
        <EmptyState icon={Building2} title="No clients found" message="Adjust your search or filters to see clients." />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Code</th>
                  <th>GSTIN</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Onboarded</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><Building2 size={16} /></span>
                        <span>
                          <strong>{client.legalName || client.displayName}</strong>
                          <small className="cmMuted cmBlock">{client.gstTreatment || ""}</small>
                        </span>
                      </div>
                    </td>
                    <td><span className="cmCode">{client.clientCode || "—"}</span></td>
                    <td className="cmMuted">{client.gstin || "—"}</td>
                    <td className="cmMuted">
                      <span className="cmBlock">{[client.billingCity, client.billingState].filter(Boolean).join(", ") || "—"}</span>
                    </td>
                    <td><StatusChip status={client.status} /></td>
                    <td className="cmMuted">{formatDate(client.onboardedOn)}</td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" title="View details" onClick={() => { setDetailClient(client); setDetailActiveTab("overview"); }}>
                          <MoreHorizontal size={15} />
                        </button>
                        {hasInternal && (
                          <>
                            <button type="button" className="cmIconButton" title="Edit" onClick={() => openEdit(client)}>
                              <Pencil size={15} />
                            </button>
                            <button type="button" className="cmIconButton" title="Manage sites" onClick={() => { setDetailClient(client); setDetailActiveTab("sites"); }}>
                              <MapPin size={15} />
                            </button>
                            <button type="button" className="cmIconButton" title="Manage users" onClick={() => { setDetailClient(client); setDetailActiveTab("users"); }}>
                              <UsersRound size={15} />
                            </button>
                            <button type="button" className="cmIconButton" title="Change status" onClick={() => setStatusTarget(client)}>
                              <ShieldCheck size={15} />
                            </button>
                            <button type="button" className="cmIconButton cmIconDanger" title="Delete" onClick={() => setDeleteTarget(client)}>
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cmPagination">
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page <= 0}
            >
              Previous
            </button>
            <span className="cmPageInfo">Page {current} of {Math.max(totalPages, 1)}</span>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => (value + 1 < totalPages ? value + 1 : value))}
              disabled={page + 1 >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}

      {detailClient && (
        <ClientDetail
          client={detailClient}
          initialTab={detailActiveTab}
          onClose={() => setDetailClient(null)}
          onEdit={() => { setDetailClient(null); openEdit(detailClient); }}
          onStatusChange={() => { setStatusTarget(detailClient); }}
          onChanged={(message) => { if (message) showFlash("success", message); reload(); }}
        />
      )}

      {createOpen && (
        <ClientFormDialog
          client={null}
          onClose={() => setCreateOpen(false)}
          onDone={(message) => {
            setCreateOpen(false);
            showFlash("success", message || "Client created.");
            reload();
          }}
        />
      )}

      {editTarget && (
        <ClientFormDialog
          client={editTarget}
          onClose={() => setEditTarget(null)}
          onDone={(message) => {
            setEditTarget(null);
            showFlash("success", message || "Client updated.");
            reload();
          }}
        />
      )}

      {statusTarget && (
        <ClientStatusDialog
          client={statusTarget}
          onClose={() => setStatusTarget(null)}
          onDone={(message) => {
            setStatusTarget(null);
            showFlash("success", message || "Client status updated.");
            reload();
          }}
        />
      )}

      {approveTarget && (
        <ApproveRegistrationDialog
          registration={approveTarget}
          onClose={() => setApproveTarget(null)}
          onDone={(message) => {
            setApproveTarget(null);
            showFlash("success", message || "Client registration approved.");
            reload();
          }}
        />
      )}

      {rejectTarget && (
        <ConfirmDialog
          title="Reject client registration"
          message={`Reject the registration from “${rejectTarget.fullName || rejectTarget.email}”? Add a reason if helpful.`}
          confirmLabel="Reject"
          busy={deleting}
          onConfirm={handleReject}
          onCancel={() => { if (!deleting) setRejectTarget(null); }}
        >
          <div className="cmForm" style={{ marginTop: 12 }}>
            <Field label="Reason" htmlFor="reject-reason">
              <textarea id="reject-reason" rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
            </Field>
          </div>
        </ConfirmDialog>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete client"
          message={`Delete “${deleteTarget.legalName}” (${deleteTarget.clientCode || "no code"})? This is a soft-delete. A client cannot be deleted while an active contract exists — the backend will refuse if active contracts are present.`}
          confirmLabel="Delete client"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
