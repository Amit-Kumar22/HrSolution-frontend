"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cancelInterview, listInterviews } from "../../lib/adminApi";
import { rolesOf } from "../../lib/auth";
import {
  Chip,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  SectionHead,
  formatDateTime,
  useFlash,
} from "./admin-ui";
import {
  ApplicationInterviewsModal,
  CancelInterviewDialog,
  FeedbackChip,
  InterviewDetailModal,
  InterviewFormModal,
  ModeChip,
  RatingValue,
  RecordResultModal,
  ResultChip,
} from "./interview-modals";

const TABS = [
  { value: "all", label: "All interviews" },
  { value: "upcoming", label: "Upcoming" },
  { value: "pending", label: "Pending feedback" },
  { value: "completed", label: "Completed" },
  { value: "mine", label: "My interviews" },
];

const SORT_OPTIONS = [
  { value: "scheduledAt,ASC", label: "Scheduled date: oldest first" },
  { value: "scheduledAt,DESC", label: "Scheduled date: newest first" },
  { value: "roundNumber,ASC", label: "Round: low to high" },
  { value: "roundNumber,DESC", label: "Round: high to low" },
];

const PAGE_SIZES = [10, 20, 50, 100];

const ALL_RESULT_OPTIONS = [
  { value: "", label: "All results" },
  { value: "PENDING", label: "Pending" },
  { value: "PASS", label: "Passed" },
  { value: "FAIL", label: "Failed" },
  { value: "NO_SHOW", label: "No show" },
];

const COMPLETED_RESULT_OPTIONS = [
  { value: "", label: "All completed" },
  { value: "PASS", label: "Passed" },
  { value: "FAIL", label: "Failed" },
  { value: "NO_SHOW", label: "No show" },
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

export function interviewCapabilities(session) {
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
    canSchedule: manage,
    canReschedule: manage,
    canCancel: manage,
    canRecordResult: manage,
    canManage: manage,
  };
}

function compareInterviews(a, b, sortValue) {
  const [property, direction] = String(sortValue || "scheduledAt,ASC").split(",");
  const multiplier = String(direction).toLowerCase() === "desc" ? -1 : 1;
  if (property === "roundNumber") {
    return ((a.roundNumber || 0) - (b.roundNumber || 0)) * multiplier;
  }
  return (Date.parse(a.scheduledAt || 0) - Date.parse(b.scheduledAt || 0)) * multiplier;
}

async function loadCompletedPage({ page, size, sortValue, interviewerUserId, completedResult }) {
  const sort = [sortValue];
  if (completedResult) {
    return listInterviews({ result: completedResult, interviewerUserId, page, size, sort });
  }
  const over = (page + 1) * size;
  const pages = await Promise.all(
    ["PASS", "FAIL", "NO_SHOW"].map((result) =>
      listInterviews({ result, interviewerUserId, page: 0, size: over, sort }),
    ),
  );
  const merged = pages.flatMap((item) => item.content).sort((a, b) => compareInterviews(a, b, sortValue));
  const totalElements = pages.reduce((sum, item) => sum + (item.totalElements || 0), 0);
  const totalPages = totalElements ? Math.ceil(totalElements / size) : 0;
  const content = merged.slice(page * size, page * size + size);
  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    first: page === 0,
    last: (page + 1) * size >= totalElements,
    empty: totalElements === 0,
  };
}

async function countQuery(params) {
  try {
    const page = await listInterviews({ ...params, page: 0, size: 1 });
    return page.totalElements || 0;
  } catch {
    return null;
  }
}

function StatCard({ label, value, tone, loading }) {
  return (
    <article className={`ivStat${tone ? ` ivStat-${tone}` : ""}`}>
      <span className="ivStatLabel">{label}</span>
      <strong className="ivStatValue">{loading ? "…" : value == null ? "—" : value}</strong>
    </article>
  );
}

export default function InterviewManagementPanel({ session, capabilities }) {
  const caps = useMemo(() => capabilities || interviewCapabilities(session), [capabilities, session]);
  const myId = session && session.user && Number.isFinite(Number(session.user.id)) ? Number(session.user.id) : null;

  const [activeTab, setActiveTab] = useState("all");
  const [pageData, setPageData] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [interviewerFilter, setInterviewerFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [completedResult, setCompletedResult] = useState("");
  const [sortValue, setSortValue] = useState("scheduledAt,ASC");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [recordTarget, setRecordTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [appHistoryId, setAppHistoryId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const nowIso = new Date().toISOString();
    (async () => {
      const [total, upcoming, pendingFeedback, passed, failed, noShow] = await Promise.all([
        countQuery({}),
        countQuery({ from: nowIso }),
        countQuery({ awaitingFeedback: true }),
        countQuery({ result: "PASS" }),
        countQuery({ result: "FAIL" }),
        countQuery({ result: "NO_SHOW" }),
      ]);
      if (cancelled) return;
      const completed =
        passed == null && failed == null && noShow == null
          ? null
          : (passed || 0) + (failed || 0) + (noShow || 0);
      setStats({ total, upcoming, completed, pendingFeedback, passed, failed, noShow });
      setStatsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const common = { page, size, sort: [sortValue] };
        let data;
        if (activeTab === "upcoming") {
          data = await listInterviews({
            ...common,
            from: new Date().toISOString(),
            interviewerUserId: interviewerFilter || undefined,
          });
        } else if (activeTab === "pending") {
          data = await listInterviews({
            ...common,
            awaitingFeedback: true,
            interviewerUserId: interviewerFilter || undefined,
          });
        } else if (activeTab === "mine") {
          data =
            myId == null
              ? { ...EMPTY_PAGE, page, size }
              : await listInterviews({ ...common, interviewerUserId: myId });
        } else if (activeTab === "completed") {
          data = await loadCompletedPage({
            page,
            size,
            sortValue,
            interviewerUserId: interviewerFilter || undefined,
            completedResult,
          });
        } else {
          data = await listInterviews({
            ...common,
            interviewerUserId: interviewerFilter || undefined,
            result: resultFilter || undefined,
          });
        }
        if (!cancelled) {
          setPageData(data);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setPageData(EMPTY_PAGE);
          setLoadError(error instanceof Error ? error.message : "Interviews could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, page, size, sortValue, interviewerFilter, resultFilter, completedResult, myId, reloadToken]);

  function reload(message) {
    if (message) showFlash("success", message);
    setLoading(true);
    setStatsLoading(true);
    setReloadToken((token) => token + 1);
  }

  function changeTab(next) {
    setActiveTab(next);
    setPage(0);
  }

  function refreshAfterChange() {
    reload();
  }

  async function runCancel() {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true);
    try {
      await cancelInterview(cancelTarget.id);
      setCancelTarget(null);
      showFlash("success", "Interview cancelled.");
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The interview could not be cancelled.");
      setCancelTarget(null);
    } finally {
      setCancelBusy(false);
    }
  }

  const showResultFilter = activeTab === "all";
  const showCompletedFilter = activeTab === "completed";
  const totalPages = pageData.totalPages || 0;
  const current = Math.min(page + 1, Math.max(totalPages, 1));

  return (
    <div>
      <SectionHead
        title="Interview management"
        description="Schedule, track and close out every interview round. Outcomes are write-once; a pass only advances an application when you ask it to."
        action={
          caps.canSchedule ? (
            <button type="button" className="primaryButton cmBtn" onClick={() => setScheduleOpen(true)}>
              <CalendarPlus size={16} /> Schedule interview
            </button>
          ) : null
        }
      />

      <FlashBanner flash={flash} />

      <section className="ivStats" aria-label="Interview statistics">
        <StatCard label="Total interviews" value={stats?.total} loading={statsLoading} tone="navy" />
        <StatCard label="Upcoming" value={stats?.upcoming} loading={statsLoading} tone="blue" />
        <StatCard label="Completed" value={stats?.completed} loading={statsLoading} tone="green" />
        <StatCard label="Pending feedback" value={stats?.pendingFeedback} loading={statsLoading} tone="amber" />
        <StatCard label="Passed" value={stats?.passed} loading={statsLoading} tone="green" />
        <StatCard label="Failed" value={stats?.failed} loading={statsLoading} tone="red" />
        <StatCard label="No show" value={stats?.noShow} loading={statsLoading} tone="warn" />
      </section>

      <div className="ivTabBar" role="tablist" aria-label="Interview views">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            className={`ivTab${activeTab === tab.value ? " ivTabActive" : ""}`}
            onClick={() => changeTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="cmToolbar">
        <div className="cmToolbarControls">
          <label className="cmSelect">
            <span>Interviewer</span>
            <input
              type="text"
              inputMode="numeric"
              value={interviewerFilter}
              placeholder="User ID"
              aria-label="Filter by interviewer user ID"
              onChange={(event) => {
                setInterviewerFilter(event.target.value.replace(/[^\d]/g, ""));
                setPage(0);
              }}
            />
          </label>
          {showResultFilter && (
            <label className="cmSelect">
              <span>Result</span>
              <select
                value={resultFilter}
                onChange={(event) => {
                  setResultFilter(event.target.value);
                  setPage(0);
                }}
              >
                {ALL_RESULT_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {showCompletedFilter && (
            <label className="cmSelect">
              <span>Outcome</span>
              <select
                value={completedResult}
                onChange={(event) => {
                  setCompletedResult(event.target.value);
                  setPage(0);
                }}
              >
                {COMPLETED_RESULT_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
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
        </div>
        <div className="cmToolbarControls">
          <span className="cmCount">
            {pageData.totalElements} interview{pageData.totalElements === 1 ? "" : "s"}
          </span>
          <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => reload()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {activeTab === "mine" && myId == null && (
        <div style={{ marginBottom: 15 }}>
          <Chip tone="warn">Your user ID is unavailable, so My interviews cannot be filtered.</Chip>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading interviews…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => reload()} />
      ) : pageData.content.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No interviews"
          message={
            activeTab === "pending"
              ? "No interviews are waiting on feedback."
              : activeTab === "upcoming"
                ? "There are no interviews scheduled ahead."
                : "No interviews match the current filters."
          }
        />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable" style={{ minWidth: 1420 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Candidate</th>
                  <th>Job title</th>
                  <th>App ID</th>
                  <th>Round</th>
                  <th>Scheduled</th>
                  <th>Duration</th>
                  <th>Mode</th>
                  <th>Venue / link</th>
                  <th>Interviewer</th>
                  <th>Result</th>
                  <th>Rating</th>
                  <th>Feedback</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((interview) => (
                  <tr key={interview.id}>
                    <td><span className="cmCode">#{interview.id}</span></td>
                    <td>
                      <span className="ivStrong">{interview.candidateName || "—"}</span>
                    </td>
                    <td className="cmMuted">{interview.jobTitle || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="cmLinkButton"
                        onClick={() => setAppHistoryId(interview.applicationId)}
                      >
                        #{interview.applicationId}
                      </button>
                    </td>
                    <td><span className="cmCode">Round {interview.roundNumber || "—"}</span></td>
                    <td className="cmMuted">{formatDateTime(interview.scheduledAt)}</td>
                    <td className="cmMuted">
                      {interview.durationMinutes ? `${interview.durationMinutes} min` : "—"}
                    </td>
                    <td><ModeChip mode={interview.mode} /></td>
                    <td className="cmMuted cmCellWrap ivVenueCell">{interview.venueOrLink || "—"}</td>
                    <td>{interview.interviewerName || "—"}</td>
                    <td><ResultChip result={interview.result} /></td>
                    <td><RatingValue rating={interview.rating} /></td>
                    <td><FeedbackChip interview={interview} /></td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button
                          type="button"
                          className="cmIconButton"
                          aria-label={`View interview ${interview.id}`}
                          title="View details"
                          onClick={() => setDetailId(interview.id)}
                        >
                          <Eye size={15} />
                        </button>
                        {caps.canReschedule && interview.result === "PENDING" && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={`Reschedule interview ${interview.id}`}
                            title="Reschedule"
                            onClick={() => setEditTarget(interview)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {caps.canRecordResult && interview.result === "PENDING" && !interview.upcoming && (
                          <button
                            type="button"
                            className="cmIconButton"
                            aria-label={`Record result for interview ${interview.id}`}
                            title="Record result"
                            onClick={() => setRecordTarget(interview)}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        {caps.canCancel && interview.result === "PENDING" && (
                          <button
                            type="button"
                            className="cmIconButton cmIconDanger"
                            aria-label={`Cancel interview ${interview.id}`}
                            title="Cancel interview"
                            onClick={() => setCancelTarget(interview)}
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

      {scheduleOpen && (
        <InterviewFormModal
          mode="create"
          onClose={() => setScheduleOpen(false)}
          onSaved={() => {
            setScheduleOpen(false);
            showFlash("success", "Interview scheduled. The application is now interview-scheduled.");
            refreshAfterChange();
          }}
        />
      )}

      {editTarget && (
        <InterviewFormModal
          mode="edit"
          interview={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            showFlash("success", "Interview rescheduled.");
            refreshAfterChange();
          }}
        />
      )}

      {detailId && (
        <InterviewDetailModal
          interviewId={detailId}
          canManage={caps.canManage}
          onClose={() => setDetailId(null)}
          onReschedule={(interview) => {
            setDetailId(null);
            setEditTarget(interview);
          }}
          onRecord={(interview) => {
            setDetailId(null);
            setRecordTarget(interview);
          }}
          onCancel={(interview) => {
            setDetailId(null);
            setCancelTarget(interview);
          }}
          onNavigateApplication={(applicationId) => {
            setDetailId(null);
            setAppHistoryId(applicationId);
          }}
        />
      )}

      {recordTarget && (
        <RecordResultModal
          interview={recordTarget}
          onClose={() => setRecordTarget(null)}
          onSaved={() => {
            setRecordTarget(null);
            showFlash("success", "Interview result recorded.");
            refreshAfterChange();
          }}
        />
      )}

      {cancelTarget && (
        <CancelInterviewDialog
          interview={cancelTarget}
          busy={cancelBusy}
          onConfirm={runCancel}
          onCancel={() => {
            if (!cancelBusy) setCancelTarget(null);
          }}
        />
      )}

      {appHistoryId && (
        <ApplicationInterviewsModal
          applicationId={appHistoryId}
          canManage={caps.canManage}
          onClose={() => setAppHistoryId(null)}
          onChanged={refreshAfterChange}
        />
      )}
    </div>
  );
}
