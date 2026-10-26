"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Table2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  applicationStatusTone,
  getJobPipeline,
  listApplications,
  listEligibleStaff,
  listJobs,
} from "../../lib/adminApi";
import { hasPermission, rolesOf } from "../../lib/auth";
import {
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  Notice,
  SectionHead,
  formatDate,
  useFlash,
} from "./admin-ui";
import {
  ApplicationDetailDrawer,
  ApplicationStatusChip,
  AssignRecruiterModal,
  ChangeApplicationStatusModal,
  RecordApplicationModal,
} from "./application-modals";

const PAGE_SIZES = [10, 20, 50, 100];

const SORT_OPTIONS = [
  { value: "appliedOn,DESC", label: "Newest first" },
  { value: "appliedOn,ASC", label: "Oldest first" },
  { value: "candidateName,ASC", label: "Candidate A–Z" },
  { value: "jobTitle,ASC", label: "Job A–Z" },
  { value: "status,ASC", label: "Status A–Z" },
];

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

/**
 * Permission names the backend may expose for this module. When the session
 * carries a permission list that mentions applications, that list is
 * authoritative — the UI never widens what the backend allows. Sessions
 * without any permission list fall back to the internal role model, exactly
 * like the Jobs, Candidates and Interviews panels.
 */
const APPLICATION_PERMISSIONS = Object.freeze({
  read: ["APPLICATION_READ", "APPLICATION_VIEW"],
  manage: ["APPLICATION_MANAGE", "APPLICATION_UPDATE", "APPLICATION_WRITE"],
});

function safeRoles(session) {
  try {
    return rolesOf(session) || [];
  } catch {
    return [];
  }
}

function permissionListOf(session) {
  const permissions = session && session.user ? session.user.permissions : null;
  return Array.isArray(permissions) ? permissions.filter((item) => typeof item === "string") : [];
}

function hasAny(session, names) {
  return names.some((name) => hasPermission(session, name));
}

export function applicationCapabilities(session) {
  const roles = new Set(safeRoles(session));
  const isSuper = roles.has("SUPER_ADMIN");
  const isAdmin = roles.has("ADMIN") || roles.has("MANAGER");
  const isHr = ["HR", "HR_MANAGER", "HR_RECRUITER", "RECRUITER"].some((role) => roles.has(role));
  const roleManage = isSuper || isAdmin || isHr;

  const permissions = permissionListOf(session);
  const mentionsApplications = permissions.some((permission) => permission.includes("APPLICATION"));

  if (mentionsApplications) {
    const canView = hasAny(session, APPLICATION_PERMISSIONS.read) || hasAny(session, APPLICATION_PERMISSIONS.manage);
    const canManage = hasAny(session, APPLICATION_PERMISSIONS.manage);
    return { canView, canManage, canRecordApplication: canManage, enforcedBy: "permissions" };
  }

  return {
    canView: true,
    canManage: roleManage,
    canRecordApplication: roleManage,
    enforcedBy: "roles",
  };
}

function applicantName(application) {
  return application.candidateName || application.candidate?.fullName || `Candidate #${application.candidateId}`;
}

function jobTitleOf(application) {
  return application.jobTitle || application.job?.title || `Job #${application.jobId}`;
}

function recruiterName(application) {
  if (application.assignedToName) return application.assignedToName;
  if (application.assignedToUserId != null) return `User #${application.assignedToUserId}`;
  return "Unassigned";
}

function sourceLabel(application) {
  const source = application.source || application.applicationSource;
  if (!source) return "—";
  return String(source).replace(/_/g, " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

async function loadJobOptions() {
  const all = [];
  let page = 0;
  while (page < 5) {
    const data = await listJobs({ page, size: 100, sort: ["createdAt,DESC"] });
    const content = data.content || [];
    all.push(...content);
    if (data.last || content.length === 0) break;
    page += 1;
  }
  return all;
}

export default function ApplicationsPanel({ session, capabilities }) {
  const caps = useMemo(
    () => capabilities || applicationCapabilities(session),
    [capabilities, session],
  );

  const [pageData, setPageData] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortValue, setSortValue] = useState("appliedOn,DESC");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);
  const [view, setView] = useState("board");

  const [jobs, setJobs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pipeline, setPipeline] = useState(null);

  const [detailId, setDetailId] = useState(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);

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
      const [jobResult, staffResult] = await Promise.allSettled([loadJobOptions(), listEligibleStaff()]);
      if (cancelled) return;
      if (jobResult.status === "fulfilled") setJobs(jobResult.value);
      if (staffResult.status === "fulfilled") setStaff(Array.isArray(staffResult.value) ? staffResult.value : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!jobFilter) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await getJobPipeline(jobFilter);
        if (cancelled) return;
        setPipeline({ jobId: jobFilter, data, error: "" });
      } catch (error) {
        if (cancelled) return;
        setPipeline({
          jobId: jobFilter,
          data: null,
          error: error instanceof Error ? error.message : "The pipeline could not be loaded.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobFilter, reloadToken]);

  useEffect(() => {
    if (!caps.canView) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await listApplications({
          search: search || undefined,
          jobId: jobFilter || undefined,
          status: statusFilter || undefined,
          assignedToUserId: unassignedOnly ? undefined : recruiterFilter || undefined,
          unassigned: unassignedOnly ? true : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          page,
          size,
          sort: [sortValue],
        });
        if (cancelled) return;
        setPageData(data);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setPageData(EMPTY_PAGE);
        setLoadError(error instanceof Error ? error.message : "Applications could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    caps.canView,
    search,
    jobFilter,
    statusFilter,
    recruiterFilter,
    unassignedOnly,
    fromDate,
    toDate,
    sortValue,
    page,
    size,
    reloadToken,
  ]);

  const reload = useCallback(
    (message) => {
      if (message) showFlash("success", message);
      setLoading(true);
      if (jobFilter) setPipeline((current) => (current ? { ...current, data: null, error: "" } : current));
      setReloadToken((token) => token + 1);
    },
    [jobFilter, showFlash],
  );

  const rows = useMemo(() => pageData.content || [], [pageData.content]);
  const totalElements = pageData.totalElements || 0;
  const totalPages = pageData.totalPages || 0;
  const currentPage = Math.min(page + 1, Math.max(totalPages, 1));

  const boardColumns = useMemo(() => {
    const present = new Set(rows.map((row) => row.status));
    const known = APPLICATION_STATUSES.map((entry) => ({ ...entry }));
    const extra = Array.from(present)
      .filter((status) => !known.some((entry) => entry.value === status))
      .map((status) => ({ value: status, label: applicationStatusLabel(status), tone: applicationStatusTone(status) }));
    return [...known, ...extra].map((entry) => {
      const columnRows = rows.filter((row) => row.status === entry.value);
      return { ...entry, rows: columnRows, count: columnRows.length };
    });
  }, [rows]);

  const pipelineData = pipeline && pipeline.jobId === jobFilter ? pipeline : null;
  const pipelineLoading = Boolean(jobFilter) && (!pipelineData || (!pipelineData.data && !pipelineData.error));

  const pipelineCounts = useMemo(() => {
    if (!pipelineData || !pipelineData.data) return null;
    const counts = pipelineData.data.countsByStatus;
    return counts && typeof counts === "object" ? counts : null;
  }, [pipelineData]);

  function columnCount(status, fallback) {
    if (pipelineCounts) {
      const value = pipelineCounts[status];
      return Number.isFinite(Number(value)) ? Number(value) : 0;
    }
    return fallback;
  }

  if (!caps.canView) {
    return (
      <div className="cmApplicationsPanel">
        <SectionHead
          title="Applications"
          description="Track every application from submission to joining."
        />
        <Notice tone="warn">
          Your account does not have permission to view applications. Ask an administrator to grant the applications
          read permission.
        </Notice>
      </div>
    );
  }

  return (
    <div className="cmApplicationsPanel">
      <SectionHead
        title="Applications"
        description="Track every application from submission to joining — filter the pipeline, move applications through the stages and keep recruiters assigned."
        action={
          caps.canRecordApplication ? (
            <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={() => setRecordOpen(true)}>
              <Plus size={14} /> Record application
            </button>
          ) : null
        }
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar cmToolbarNowrap">
        <label className="cmSearchBox">
          <Search size={16} />
          <input
            type="search"
            value={searchInput}
            placeholder="Candidate, job or reference…"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">
            {totalElements} application{totalElements === 1 ? "" : "s"}
          </span>
          <label className="cmSelect">
            <span>Job</span>
            <select
              value={jobFilter}
              onChange={(event) => {
                setJobFilter(event.target.value);
                setPipeline(null);
                setPage(0);
              }}
            >
              <option value="">All jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title || `Job #${job.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All statuses</option>
              {APPLICATION_STATUSES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <span>Recruiter</span>
            <select
              value={unassignedOnly ? "" : recruiterFilter}
              disabled={unassignedOnly}
              onChange={(event) => {
                setRecruiterFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All recruiters</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName || person.email || `User #${person.id}`}
                </option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="cmSelect">
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(0);
              }}
            />
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
          <label className="cmSwitch" style={{ marginLeft: 4 }}>
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(event) => {
                setUnassignedOnly(event.target.checked);
                if (event.target.checked) setRecruiterFilter("");
                setPage(0);
              }}
            />
            <span className="cmSwitchTrack" aria-hidden="true"><i /></span>
            <span className="cmSwitchLabel">Unassigned only</span>
          </label>
          <div className="cmSegmented" role="group" aria-label="Application view">
            <button
              type="button"
              className={`cmSegmentedBtn${view === "board" ? " cmSegmentedActive" : ""}`}
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
            >
              <LayoutGrid size={14} /> Board
            </button>
            <button
              type="button"
              className={`cmSegmentedBtn${view === "table" ? " cmSegmentedActive" : ""}`}
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <Table2 size={14} /> Table
            </button>
          </div>
          <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => reload()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {jobFilter ? (
        <div className="cmAppStats" aria-live="polite">
          {pipelineLoading ? (
            <LoadingState label="Loading pipeline statistics…" />
          ) : pipelineData && pipelineData.error ? (
            <Notice tone="warn">{pipelineData.error}</Notice>
          ) : pipelineData && pipelineData.data ? (
            <>
              <div className="cmAppStat">
                <span>Total applications</span>
                <strong>{pipelineData.data.totalApplications ?? 0}</strong>
              </div>
              <div className="cmAppStat">
                <span>Openings</span>
                <strong>{pipelineData.data.openings ?? 0}</strong>
              </div>
              <div className="cmAppStat">
                <span>Committed</span>
                <strong>{pipelineData.data.openingsCommitted ?? 0}</strong>
              </div>
              <div className="cmAppStat">
                <span>Remaining</span>
                <strong>{pipelineData.data.openingsRemaining ?? 0}</strong>
              </div>
            </>
          ) : (
            <Notice tone="info">No pipeline statistics are available for this job yet.</Notice>
          )}
        </div>
      ) : (
        <div className="cmAppStats">
          <Notice tone="info">
            Select a job to load its pipeline statistics and per-stage totals.
          </Notice>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading applications…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => reload()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No applications"
          message="No applications match the current filters. Adjust the filters or record a new application."
        />
      ) : view === "board" ? (
        <div className="cmAppBoard">
          {boardColumns.map((column) => (
            <section className="cmAppColumn" key={column.value}>
              <header className="cmAppColumnHead">
                <span className={`cmAppColumnDot cmAppColumnDot-${column.tone}`} aria-hidden="true" />
                <h3>{column.label}</h3>
                <span className="cmAppColumnCount">{columnCount(column.value, column.count)}</span>
              </header>
              <div className="cmAppColumnBody">
                {column.rows.length === 0 ? (
                  <p className="cmAppColumnEmpty">Nothing here.</p>
                ) : (
                  column.rows.map((row) => (
                    <button
                      type="button"
                      className="cmAppCard"
                      key={row.id}
                      onClick={() => setDetailId(row.id)}
                    >
                      <span className="cmAppCardTop">
                        <strong>{applicantName(row)}</strong>
                        <span className="cmCode">#{row.id}</span>
                      </span>
                      <span className="cmAppCardJob">{jobTitleOf(row)}</span>
                      <span className="cmAppCardMeta">
                        <span>{row.appliedOn ? formatDate(row.appliedOn) : "—"}</span>
                        <span>·</span>
                        <span>{recruiterName(row)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Candidate</th>
                <th>Job</th>
                <th>Status</th>
                <th>Recruiter</th>
                <th>Source</th>
                <th>Applied on</th>
                <th>In pipeline</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><span className="cmCode">#{row.id}</span></td>
                  <td>
                    <button type="button" className="cmLinkButton" onClick={() => setDetailId(row.id)}>
                      {applicantName(row)}
                    </button>
                    {row.candidateEmail && <small className="cmMuted cmBlock">{row.candidateEmail}</small>}
                  </td>
                  <td className="cmMuted">
                    {jobTitleOf(row)}
                    {row.categoryName && <small className="cmMuted cmBlock">{row.categoryName}</small>}
                  </td>
                  <td><ApplicationStatusChip status={row.status} /></td>
                  <td className="cmMuted">{recruiterName(row)}</td>
                  <td className="cmMuted">{sourceLabel(row)}</td>
                  <td className="cmMuted">{row.appliedOn ? formatDate(row.appliedOn) : "—"}</td>
                  <td className="cmMuted">
                    {typeof row.daysInPipeline === "number" ? `${row.daysInPipeline} day(s)` : "—"}
                  </td>
                  <td className="cmColActions">
                    <div className="cmRowActions">
                      <button
                        type="button"
                        className="cmIconButton"
                        aria-label={`View application ${row.id}`}
                        title="View details"
                        onClick={() => setDetailId(row.id)}
                      >
                        <Users size={15} />
                      </button>
                      {caps.canManage && (
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={`Change status for application ${row.id}`}
                          title="Change status"
                          onClick={() => setStatusTarget(row)}
                        >
                          <TrendingUp size={15} />
                        </button>
                      )}
                      {caps.canManage && (
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={`Assign recruiter for application ${row.id}`}
                          title="Assign recruiter"
                          onClick={() => setAssignTarget(row)}
                        >
                          <UserCheck size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && rows.length > 0 && (
        <div className="cmPagination">
          <button
            type="button"
            className="secondaryButton cmBtn cmPageBtn"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={page <= 0 || loading}
          >
            <ChevronLeft size={13} /> Previous
          </button>
          <span className="cmPageInfo">Page {currentPage} of {Math.max(totalPages, 1)}</span>
          <button
            type="button"
            className="secondaryButton cmBtn cmPageBtn"
            onClick={() => setPage((value) => (value + 1 < totalPages ? value + 1 : value))}
            disabled={page + 1 >= totalPages || loading}
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}

      {detailId && (
        <ApplicationDetailDrawer
          applicationId={detailId}
          session={session}
          canManage={caps.canManage}
          onClose={() => setDetailId(null)}
          onChanged={(message) => {
            if (message) showFlash("success", message);
            reload();
          }}
        />
      )}

      {recordOpen && (
        <RecordApplicationModal
          initialJobId={jobFilter}
          onClose={() => setRecordOpen(false)}
          onSaved={() => {
            setRecordOpen(false);
            showFlash("success", "Application recorded.");
            reload();
          }}
        />
      )}

      {statusTarget && (
        <ChangeApplicationStatusModal
          application={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={(updated, status) => {
            setStatusTarget(null);
            showFlash("success", `Application status changed to ${applicationStatusLabel(status)}.`);
            reload();
          }}
        />
      )}

      {assignTarget && (
        <AssignRecruiterModal
          application={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={(updated, userId) => {
            setAssignTarget(null);
            showFlash("success", userId == null ? "Recruiter unassigned." : "Recruiter assigned.");
            reload();
          }}
        />
      )}
    </div>
  );
}
