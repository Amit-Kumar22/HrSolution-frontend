"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Inbox, Search, Trash2 } from "lucide-react";
import {
  assignEnquiry,
  deleteEnquiry,
  getEnquiry,
  listEnquiries,
  listManpowerCategories,
  listUsers,
  updateEnquiryStatus,
} from "@/lib/adminApi";
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
  Switch,
  formatDateTime,
  useFlash,
} from "./admin-ui";

const STATUS_META = {
  NEW: { label: "New", tone: "info" },
  CONTACTED: { label: "Contacted", tone: "warn" },
  QUALIFIED: { label: "Qualified", tone: "accent" },
  CONVERTED: { label: "Converted", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  SPAM: { label: "Spam", tone: "danger" },
};

const STATUS_OPTIONS = Object.keys(STATUS_META).map((value) => ({ value, label: STATUS_META[value].label }));

const SORT_OPTIONS = [
  { value: "createdAt,DESC", label: "Newest first" },
  { value: "createdAt,ASC", label: "Oldest first" },
];

const PAGE_SIZES = [10, 20, 50, 100];

function StatusChip({ status }) {
  const meta = STATUS_META[status] || { label: status || "—", tone: "neutral" };
  return <Chip tone={meta.tone}>{meta.label}</Chip>;
}

function staffLabel(user) {
  return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || `User #${user.id}`;
}

export default function EnquiriesPanel() {
  const [pageData, setPageData] = useState({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeSpam, setIncludeSpam] = useState(false);
  const [sortValue, setSortValue] = useState("createdAt,DESC");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const [categories, setCategories] = useState([]);
  const [staff, setStaff] = useState([]);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailSeq = useRef(0);

  const [assignValue, setAssignValue] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [statusValue, setStatusValue] = useState("NEW");
  const [statusNote, setStatusNote] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const effectiveIncludeSpam = includeSpam || statusFilter === "SPAM";

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
        const [categoryList, usersPage] = await Promise.all([
          listManpowerCategories(),
          listUsers({ page: 0, size: 100 }),
        ]);
        if (cancelled) return;
        setCategories(categoryList);
        setStaff(usersPage.content);
      } catch {
        // Lookups are optional; the list still works without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listEnquiries({
          search,
          status: statusFilter || undefined,
          categoryId: categoryFilter || undefined,
          assignedToUserId: assignedFilter || undefined,
          from: from || undefined,
          to: to || undefined,
          includeSpam: effectiveIncludeSpam,
          page,
          size,
          sort: [sortValue],
        });
        if (cancelled) return;
        setPageData(data);
        setLoadError("");
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Enquiries could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, categoryFilter, assignedFilter, from, to, effectiveIncludeSpam, page, size, sortValue, reloadToken]);

  function reload() {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }

  function syncDetailFields(enquiry) {
    setAssignValue(enquiry.assignedToUserId == null ? "" : String(enquiry.assignedToUserId));
    setStatusValue(enquiry.status || "NEW");
  }

  async function fetchDetail(id) {
    const seq = ++detailSeq.current;
    setDetailLoading(true);
    setDetailError("");
    try {
      const full = await getEnquiry(id);
      if (detailSeq.current !== seq) return;
      setDetail(full);
      syncDetailFields(full);
    } catch (error) {
      if (detailSeq.current === seq) {
        setDetailError(error instanceof Error ? error.message : "The enquiry details could not be loaded.");
      }
    } finally {
      if (detailSeq.current === seq) setDetailLoading(false);
    }
  }

  function openDetail(item) {
    setDetail(item);
    setDetailError("");
    setAssignNote("");
    setStatusNote("");
    syncDetailFields(item);
    fetchDetail(item.id);
  }

  function closeDetail() {
    detailSeq.current += 1;
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    setAssignNote("");
    setStatusNote("");
  }

  async function refreshAfterDetailAction(id) {
    reload();
    await fetchDetail(id);
  }

  async function handleAssign(event) {
    event.preventDefault();
    if (!detail || assignSaving) return;
    setAssignSaving(true);
    try {
      await assignEnquiry(detail.id, assignValue === "" ? null : Number(assignValue), assignNote);
      setAssignNote("");
      showFlash("success", assignValue === "" ? "Enquiry unassigned." : "Enquiry assigned.");
      await refreshAfterDetailAction(detail.id);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The enquiry could not be assigned.");
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleStatus(event) {
    event.preventDefault();
    if (!detail || statusSaving) return;
    setStatusSaving(true);
    try {
      await updateEnquiryStatus(detail.id, statusValue, statusNote);
      setStatusNote("");
      showFlash("success", `Status changed to ${STATUS_META[statusValue]?.label || statusValue}.`);
      await refreshAfterDetailAction(detail.id);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The status could not be updated.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteEnquiry(deleteTarget.id);
      showFlash("success", "Enquiry deleted.");
      if (detail && detail.id === deleteTarget.id) closeDetail();
      setDeleteTarget(null);
      if (pageData.content.length === 1 && page > 0) {
        setPage((current) => current - 1);
      } else {
        reload();
      }
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The enquiry could not be deleted.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setStatusFilter("");
    setCategoryFilter("");
    setAssignedFilter("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setPage(0);
  }

  const totalPages = pageData.totalPages || 0;
  const current = Math.min(page + 1, Math.max(totalPages, 1));
  const hasFilters = Boolean(statusFilter || categoryFilter || assignedFilter || from || to || searchInput);

  return (
    <div>
      <SectionHead
        title="Enquiries"
        description="Manpower enquiries submitted from the website. Assign them to staff and move them along the pipeline."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar">
        <label className="cmSearchBox">
          <Search size={16} />
          <input
            type="search"
            value={searchInput}
            placeholder="Search company, contact, phone, email or city"
            aria-label="Search enquiries"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">
            {pageData.totalElements} enquir{pageData.totalElements === 1 ? "y" : "ies"}
          </span>
          <label className="cmSelect">
            <span>Sort</span>
            <select value={sortValue} onChange={(event) => { setSortValue(event.target.value); setPage(0); }}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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
          <Switch
            id="enquiry-include-spam"
            checked={effectiveIncludeSpam}
            onChange={(next) => { setIncludeSpam(next); if (statusFilter === "SPAM" && !next) setStatusFilter(""); setPage(0); }}
            label="Include spam"
          />
        </div>
      </div>

      <div className="cmToolbar cmToolbarStart">
        <label className="cmSelect">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="cmSelect">
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(0); }}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="cmSelect">
          <span>Assigned to</span>
          <select value={assignedFilter} onChange={(event) => { setAssignedFilter(event.target.value); setPage(0); }}>
            <option value="">Anyone</option>
            {staff.map((user) => (
              <option key={user.id} value={user.id}>{staffLabel(user)}</option>
            ))}
          </select>
        </label>
        <label className="cmSelect">
          <span>From</span>
          <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} />
        </label>
        <label className="cmSelect">
          <span>To</span>
          <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} />
        </label>
        {hasFilters && (
          <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading enquiries…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : pageData.content.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No enquiries"
          message={hasFilters ? "No enquiries match the current filters." : "New website enquiries will appear here."}
        />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Company / contact</th>
                  <th>Contact details</th>
                  <th>Category</th>
                  <th>Assigned</th>
                  <th className="cmColCenter">Status</th>
                  <th>Received</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((item) => (
                  <tr key={item.id}>
                    <td><span className="cmCode">{item.reference || `#${item.id}`}</span></td>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><Inbox size={16} /></span>
                        <span>
                          <strong>{item.companyName || "—"}</strong>
                          {item.contactPerson && <small className="cmMuted cmBlock">{item.contactPerson}</small>}
                        </span>
                      </div>
                    </td>
                    <td className="cmMuted">
                      <span className="cmBlock">{item.phone || "—"}</span>
                      {item.email && <span className="cmBlock">{item.email}</span>}
                      {item.city && <span className="cmBlock">{item.city}</span>}
                    </td>
                    <td className="cmMuted">{item.categoryLabel || "—"}</td>
                    <td className="cmMuted">{item.assignedToName || "Unassigned"}</td>
                    <td className="cmColCenter"><StatusChip status={item.status} /></td>
                    <td className="cmMuted">{formatDateTime(item.createdAt)}</td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" aria-label={`View ${item.reference || "enquiry"}`} title="View" onClick={() => openDetail(item)}>
                          <Eye size={15} />
                        </button>
                        <button type="button" className="cmIconButton cmIconDanger" aria-label="Delete enquiry" title="Delete" onClick={() => setDeleteTarget(item)}>
                          <Trash2 size={15} />
                        </button>
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
              disabled={page <= 0 || loading}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="cmPageInfo">Page {current} of {Math.max(totalPages, 1)}</span>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => (value + 1 < totalPages ? value + 1 : value))}
              disabled={page + 1 >= totalPages || loading}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}

      {detail && (
        <Modal
          wide
          title={detail.reference ? `Enquiry ${detail.reference}` : "Enquiry"}
          description={detail.companyName || undefined}
          onClose={closeDetail}
          footer={(
            <>
              <button
                type="button"
                className="cmDangerButton cmBtn"
                onClick={() => setDeleteTarget(detail)}
                disabled={deleting}
              >
                <Trash2 size={15} /> Delete
              </button>
              <button type="button" className="secondaryButton cmBtn" onClick={closeDetail}>Close</button>
            </>
          )}
        >
          {detailError && <p className="actionError" role="alert">{detailError}</p>}
          {detailLoading && <Notice tone="info">Loading the latest details…</Notice>}

          <div className="cmStatusRow">
            <StatusChip status={detail.status} />
            {detail.categoryLabel && <Chip tone="info">{detail.categoryLabel}</Chip>}
            <Chip tone={detail.assignedToUserId == null ? "neutral" : "success"}>
              {detail.assignedToName || "Unassigned"}
            </Chip>
          </div>

          <div className="cmDetailGrid" style={{ marginTop: 16 }}>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Company</span>
              <span className="cmDetailValue">{detail.companyName || "—"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Contact person</span>
              <span className="cmDetailValue">{detail.contactPerson || "—"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Phone</span>
              <span className="cmDetailValue">
                {detail.phone ? <a href={`tel:${detail.phone}`}>{detail.phone}</a> : "—"}
              </span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Email</span>
              <span className="cmDetailValue">
                {detail.email ? <a href={`mailto:${detail.email}`}>{detail.email}</a> : "—"}
              </span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">City / state</span>
              <span className="cmDetailValue">{[detail.city, detail.state].filter(Boolean).join(", ") || "—"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Category</span>
              <span className="cmDetailValue">{detail.categoryLabel || "—"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Received</span>
              <span className="cmDetailValue">{formatDateTime(detail.createdAt)}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Last updated</span>
              <span className="cmDetailValue">{formatDateTime(detail.updatedAt)}</span>
            </div>
            {detail.numberOfWorkers != null && (
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Workers needed</span>
                <span className="cmDetailValue">{detail.numberOfWorkers}</span>
              </div>
            )}
            {detail.durationMonths != null && (
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Duration (months)</span>
                <span className="cmDetailValue">{detail.durationMonths}</span>
              </div>
            )}
            {detail.requiredFrom && (
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Required from</span>
                <span className="cmDetailValue">{detail.requiredFrom}</span>
              </div>
            )}
            <div className="cmDetailRow cmDetailFull">
              <span className="cmDetailLabel">Message</span>
              <p className="cmDetailMessage">{detail.message || "—"}</p>
            </div>
          </div>

          <div className="cmDetailSection">
            <h3>Internal notes</h3>
            {detail.internalNotes ? (
              <p className="cmNotes">{detail.internalNotes}</p>
            ) : (
              <p className="cmHint">No internal notes yet. Notes you add when assigning or changing the status are recorded here.</p>
            )}
          </div>

          <div className="cmDetailSection">
            <h3>Assign to staff</h3>
            <form className="cmForm" onSubmit={handleAssign}>
              <div className="cmFormRow">
                <Field label="Assignee" htmlFor="enquiry-assignee">
                  <select id="enquiry-assignee" value={assignValue} onChange={(event) => setAssignValue(event.target.value)}>
                    <option value="">Unassigned</option>
                    {staff.map((user) => (
                      <option key={user.id} value={user.id}>{staffLabel(user)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Note (optional)" htmlFor="enquiry-assign-note">
                  <input
                    id="enquiry-assign-note"
                    value={assignNote}
                    maxLength={1000}
                    placeholder="e.g. Called the client, sending quote"
                    onChange={(event) => setAssignNote(event.target.value)}
                  />
                </Field>
              </div>
              <div className="cmDetailActions" style={{ marginTop: 14 }}>
                <button type="submit" className="primaryButton cmBtn" disabled={assignSaving}>
                  {assignSaving ? "Saving…" : "Save assignment"}
                </button>
              </div>
            </form>
          </div>

          <div className="cmDetailSection">
            <h3>Pipeline status</h3>
            <form className="cmForm" onSubmit={handleStatus}>
              <div className="cmFormRow">
                <Field label="Status" htmlFor="enquiry-status">
                  <select id="enquiry-status" value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Note (optional)" htmlFor="enquiry-status-note">
                  <input
                    id="enquiry-status-note"
                    value={statusNote}
                    maxLength={1000}
                    placeholder="Reason for the change"
                    onChange={(event) => setStatusNote(event.target.value)}
                  />
                </Field>
              </div>
              <div className="cmDetailActions" style={{ marginTop: 14 }}>
                <button type="submit" className="primaryButton cmBtn" disabled={statusSaving}>
                  {statusSaving ? "Updating…" : "Update status"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete enquiry"
          message={`Delete enquiry ${deleteTarget.reference || `#${deleteTarget.id}`}? This cannot be undone.`}
          confirmLabel="Delete enquiry"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
