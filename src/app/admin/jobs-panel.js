"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  JOB_STATUSES,
  deleteJob,
  listClients,
  listJobs,
  listManpowerCategories,
} from "../../lib/adminApi";
import { rolesOf } from "../../lib/auth";
import {
  Chip,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  SectionHead,
  formatDate,
  useFlash,
} from "./admin-ui";
import {
  AddJobApplicationModal,
  ChangeJobStatusModal,
  DeleteJobDialog,
  ExpiredChip,
  JobDetailModal,
  JobFormModal,
  JobPipelineModal,
  JobStatusChip,
  VisibilityChip,
} from "./job-modals";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...JOB_STATUSES.map((entry) => ({ value: entry.value, label: entry.label })),
  { value: "EXPIRED", label: "Expired only" },
];

const SORT_OPTIONS = [
  { value: "createdAt,DESC", label: "Newest first" },
  { value: "createdAt,ASC", label: "Oldest first" },
  { value: "title,ASC", label: "Title A–Z" },
  { value: "title,DESC", label: "Title Z–A" },
  { value: "openings,DESC", label: "Most openings" },
  { value: "expiresOn,ASC", label: "Expiring soonest" },
];

const PAGE_SIZES = [10, 20, 50, 100];

const SCAN_PAGE_SIZE = 100;
const MAX_SCAN_PAGES = 20;

const EMPTY_PAGE = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
  empty: true,
};

export function jobCapabilities(session) {
  let roles = [];
  try {
    roles = rolesOf(session);
  } catch {
    roles = [];
  }
  const set = new Set(roles);
  const isSuper = set.has("SUPER_ADMIN");
  const isAdmin = set.has("ADMIN") || set.has("MANAGER");
  const isHr = ["HR", "HR_MANAGER", "HR_RECRUITER", "RECRUITER"].some((role) => set.has(role));
  const manage = isSuper || isAdmin || isHr;
  return {
    canView: true,
    canCreate: manage,
    canEdit: manage,
    canChangeStatus: manage,
    canDelete: manage,
    canRecordApplication: manage,
  };
}

async function scanAllJobs() {
  const all = [];
  let page = 0;
  while (page < MAX_SCAN_PAGES) {
    const data = await listJobs({ page, size: SCAN_PAGE_SIZE, sort: ["createdAt,DESC"] });
    const content = data.content || [];
    all.push(...content);
    if (data.last || content.length === 0) break;
    page += 1;
  }
  return all;
}

function clientNameOf(job) {
  return job.clientName || job.client?.name || job.client?.displayName || "—";
}

export default function JobsPanel({ session, capabilities }) {
  const caps = useMemo(() => capabilities || jobCapabilities(session), [capabilities, session]);

  const [pageData, setPageData] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [allJobs, setAllJobs] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [sortValue, setSortValue] = useState("createdAt,DESC");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);

  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);

  const [formState, setFormState] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [appTarget, setAppTarget] = useState(null);
  const [pipelineTarget, setPipelineTarget] = useState(null);

  const isExpiredMode = statusFilter === "EXPIRED";

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
      const results = await Promise.allSettled([
        listManpowerCategories(),
        listClients({ size: 200 }),
      ]);
      if (cancelled) return;
      const [categoryResult, clientResult] = results;
      if (categoryResult.status === "fulfilled") {
        setCategories(Array.isArray(categoryResult.value) ? categoryResult.value : []);
      }
      if (clientResult.status === "fulfilled") {
        setClients(clientResult.value?.content || []);
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
        const jobs = await scanAllJobs();
        if (cancelled) return;
        setAllJobs(jobs);
      } catch {
        if (!cancelled) setAllJobs([]);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    if (isExpiredMode) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await listJobs({
          search: search || undefined,
          status: statusFilter || undefined,
          categoryId: categoryFilter || undefined,
          clientId: clientFilter || undefined,
          page,
          size,
          sort: [sortValue],
        });
        if (!cancelled) {
          setPageData(data);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setPageData(EMPTY_PAGE);
          setLoadError(error instanceof Error ? error.message : "Jobs could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isExpiredMode, search, statusFilter, categoryFilter, clientFilter, sortValue, page, size, reloadToken]);

  const expiredRows = useMemo(() => {
    if (!isExpiredMode) return [];
    const query = search.trim().toLowerCase();
    let rows = allJobs.filter((job) => job.expired);
    if (query) {
      rows = rows.filter((job) =>
        [job.title, job.slug, job.city, job.categoryName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }
    return [...rows].sort((a, b) => Date.parse(a.expiresOn || 0) - Date.parse(b.expiresOn || 0));
  }, [isExpiredMode, allJobs, search]);

  const expiredTotal = expiredRows.length;
  const expiredTotalPages = expiredTotal ? Math.ceil(expiredTotal / size) : 0;
  const expiredPage = Math.min(page, Math.max(expiredTotalPages - 1, 0));
  const expiredSlice = expiredRows.slice(expiredPage * size, expiredPage * size + size);

  const rows = isExpiredMode ? expiredSlice : pageData.content;
  const totalElements = isExpiredMode ? expiredTotal : pageData.totalElements;
  const totalPages = isExpiredMode ? expiredTotalPages : pageData.totalPages || 0;
  const currentPage = Math.min(page + 1, Math.max(totalPages, 1));
  const showLoading = isExpiredMode ? statsLoading : loading;
  const showError = isExpiredMode ? "" : loadError;

  function reload(message) {
    if (message) showFlash("success", message);
    setLoading(true);
    setStatsLoading(true);
    setReloadToken((token) => token + 1);
  }

  function openEdit(job) {
    setDetailId(null);
    setFormState({ mode: "edit", job });
  }

  function openStatus(job) {
    setDetailId(null);
    setStatusTarget(job);
  }

  function openDelete(job) {
    setDetailId(null);
    setDeleteTarget(job);
  }

  function openApplication(job) {
    setDetailId(null);
    setAppTarget(job);
  }

  function openPipeline(job) {
    setDetailId(null);
    setPipelineTarget(job);
  }

  return (
    <div className="cmJobsPanel">
      <SectionHead
        title="Job management"
        description="Create adverts, publish them to the public website, and track the application pipeline for every vacancy."
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <label className="cmSearchBox">
          <Search size={16} />
          <input
            type="search"
            value={searchInput}
            placeholder="Title, slug or city…"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">
            {totalElements} job{totalElements === 1 ? "" : "s"}
          </span>
          <label className="cmSelect">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {!isExpiredMode && (
            <>
              <label className="cmSelect">
                <span>Category</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name || category.code || `Category #${category.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cmSelect">
                <span>Client</span>
                <select
                  value={clientFilter}
                  onChange={(event) => {
                    setClientFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.displayName || client.legalName || client.clientCode || `Client #${client.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cmSelect">
                <span>Sort</span>
                <select
                  value={sortValue}
                  onChange={(event) => {
                    setSortValue(event.target.value);
                    setPage(0);
                  }}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="cmSelect">
            <span>Per page</span>
            <select
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => reload()} disabled={showLoading}>
            <RefreshCw size={14} /> Refresh
          </button>
          {caps.canCreate && (
            <button
              type="button"
              className="primaryButton cmBtn cmPageBtn"
              onClick={() => setFormState({ mode: "create", job: null })}
            >
              <Plus size={14} /> Create job
            </button>
          )}
        </div>
      </div>

      {isExpiredMode && (
        <div style={{ marginBottom: 15 }}>
          <Chip tone="warn">Expired view lists every expired advert. Category, client and sort filters do not apply here.</Chip>
        </div>
      )}

      {showLoading ? (
        <LoadingState label="Loading jobs…" />
      ) : showError ? (
        <ErrorState message={showError} onRetry={() => reload()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={isExpiredMode ? "No expired jobs" : "No jobs"}
          message={
            isExpiredMode
              ? "No job adverts have passed their expiry date."
              : "No job adverts match the current filters. Create one to get started."
          }
        />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable" style={{ minWidth: 1580 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Category</th>
                  <th>Client</th>
                  <th>City</th>
                  <th>Openings</th>
                  <th>Applications</th>
                  <th>Status</th>
                  <th>Expiry date</th>
                  <th>Expired</th>
                  <th>Visibility</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => (
                  <tr key={job.id}>
                    <td><span className="cmCode">#{job.id}</span></td>
                    <td>
                      <button
                        type="button"
                        className="cmLinkButton jobTitleLink"
                        onClick={() => setDetailId(job.id)}
                      >
                        {job.title || "—"}
                      </button>
                    </td>
                    <td className="cmMuted"><code className="cmCode">{job.slug || "—"}</code></td>
                    <td className="cmMuted">{job.categoryName || "—"}</td>
                    <td className="cmMuted">{clientNameOf(job)}</td>
                    <td className="cmMuted">{job.city || "—"}</td>
                    <td>{job.openings ?? "—"}</td>
                    <td>
                      <span className="jobAppCount">{job.applicationCount ?? 0}</span>
                    </td>
                    <td><JobStatusChip status={job.status} /></td>
                    <td className="cmMuted">{job.expiresOn ? formatDate(job.expiresOn) : "No expiry"}</td>
                    <td><ExpiredChip job={job} /></td>
                    <td><VisibilityChip job={job} /></td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={`View job ${job.id}`}
                          title="View details"
                          onClick={() => setDetailId(job.id)}
                        >
                          <Eye size={15} />
                        </button>
                        {caps.canEdit && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={`Edit job ${job.id}`}
                            title="Edit"
                            onClick={() => openEdit(job)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {caps.canChangeStatus && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={`Change status for job ${job.id}`}
                            title="Change status"
                            onClick={() => openStatus(job)}
                          >
                            <TrendingUp size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={`View pipeline for job ${job.id}`}
                          title="View pipeline"
                          onClick={() => openPipeline(job)}
                        >
                          <Users size={15} />
                        </button>
                        {caps.canRecordApplication && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={`Record application for job ${job.id}`}
                            title="Record application"
                            onClick={() => openApplication(job)}
                          >
                            <Plus size={15} />
                          </button>
                        )}
                        {caps.canDelete && (
                          <button
                            type="button"
                            className="cmIconButton cmIconDanger"
                            aria-label={`Delete job ${job.id}`}
                            title="Delete"
                            onClick={() => openDelete(job)}
                          >
                            <Trash2 size={15} />
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
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page <= 0 || showLoading}
            >
              <ChevronLeft size={13} /> Previous
            </button>
            <span className="cmPageInfo">Page {currentPage} of {Math.max(totalPages, 1)}</span>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => (value + 1 < totalPages ? value + 1 : value))}
              disabled={page + 1 >= totalPages || showLoading}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}

      {formState && (
        <JobFormModal
          mode={formState.mode}
          job={formState.job}
          onClose={() => setFormState(null)}
          onSaved={(saved, isEdit) => {
            setFormState(null);
            showFlash("success", isEdit ? "Job advert updated." : "Job created as a draft.");
            reload();
          }}
        />
      )}

      {detailId && (
        <JobDetailModal
          jobId={detailId}
          canManage={caps.canEdit}
          onClose={() => setDetailId(null)}
          onEdit={openEdit}
          onChangeStatus={openStatus}
          onDelete={openDelete}
          onAddApplication={openApplication}
          onViewPipeline={openPipeline}
        />
      )}

      {statusTarget && (
        <ChangeJobStatusModal
          job={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={(updated, status) => {
            setStatusTarget(null);
            showFlash("success", `Status changed to ${status}.`);
            reload();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteJobDialog
          job={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            showFlash("success", "Job deleted.");
            reload();
          }}
        />
      )}

      {appTarget && (
        <AddJobApplicationModal
          job={appTarget}
          onClose={() => setAppTarget(null)}
          onSaved={() => {
            setAppTarget(null);
            showFlash("success", "Application recorded.");
            reload();
          }}
        />
      )}

      {pipelineTarget && (
        <JobPipelineModal
          jobId={pipelineTarget.id}
          jobTitle={pipelineTarget.title}
          onClose={() => setPipelineTarget(null)}
        />
      )}
    </div>
  );
}
