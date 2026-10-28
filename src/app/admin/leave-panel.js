"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  useFlash,
} from "./admin-ui";
import { getAuthSession } from "@/lib/auth";
import {
  approveLeaveRequest,
  getLeaveDates,
  getLeaveReason,
  getLeaveRequestId,
  getLeaveWorker,
  leaveStatusLabel,
  leaveStatusTone,
  listLeaveRequests,
  rejectLeaveRequest,
} from "@/lib/leaveApi";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

function formatDateValue(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateRange(item) {
  const { fromDate, toDate } = getLeaveDates(item);
  if (!fromDate && !toDate) return "—";
  const start = formatDateValue(fromDate);
  const end = formatDateValue(toDate);
  return start === end ? start : `${start} to ${end}`;
}

function formatCreated(item) {
  const value = item && (item.createdAt || item.submittedAt || item.requestedAt || item.updatedAt);
  return formatDateValue(value);
}

export default function LeaveManagementPanel({ session: passedSession } = {}) {
  const session = passedSession || getAuthSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(0);
  const [pageMeta, setPageMeta] = useState({ totalPages: 0, totalElements: 0, empty: true });
  const [reloadToken, setReloadToken] = useState(0);
  const [busyActionId, setBusyActionId] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [flash, showFlash] = useFlash();

  useEffect(() => {
    if (!session || !session.accessToken) return undefined;
    let cancelled = false;

    const refresh = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await listLeaveRequests({
          status: statusFilter || undefined,
          page,
          size: PAGE_SIZE,
          sort: ["createdAt,DESC"],
        });
        if (cancelled) return;
        setItems(Array.isArray(data?.content) ? data.content : []);
        setPageMeta({
          totalPages: Number.isFinite(data?.totalPages) ? data.totalPages : 0,
          totalElements: Number.isFinite(data?.totalElements) ? data.totalElements : 0,
          empty: Boolean(data?.empty),
        });
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : "Leave requests could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken, session, statusFilter]);

  const summary = useMemo(() => {
    const approved = items.filter((item) => String(item.status || item.state || "").toUpperCase() === "APPROVED").length;
    const pending = items.filter((item) => String(item.status || item.state || "").toUpperCase() === "PENDING").length;
    return { approved, pending };
  }, [items]);

  async function handleApprove(item) {
    setApproveTarget(item);
  }

  async function confirmApprove() {
    if (!approveTarget) return;
    setBusyActionId(getLeaveRequestId(approveTarget));
    try {
      await approveLeaveRequest(getLeaveRequestId(approveTarget), { remarks: "", rejectionReason: "" });
      showFlash("success", "Leave request approved.");
      setApproveTarget(null);
      setReloadToken((value) => value + 1);
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "The leave request could not be approved.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleReject(item) {
    setRejectTarget(item);
    setRejectReason("");
    setRejectError("");
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setRejectError("A rejection reason is required.");
      return;
    }

    setBusyActionId(getLeaveRequestId(rejectTarget));
    try {
      await rejectLeaveRequest(getLeaveRequestId(rejectTarget), {
        remarks: "",
        rejectionReason: trimmed,
      });
      showFlash("success", "Leave request rejected.");
      setRejectTarget(null);
      setRejectReason("");
      setRejectError("");
      setReloadToken((value) => value + 1);
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "The leave request could not be rejected.");
    } finally {
      setBusyActionId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>Leave Management</h1>
          <p style={{ margin: "4px 0 0", color: "#586d84", fontSize: 12 }}>Review and manage leave requests across the workforce.</p>
        </div>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => setReloadToken((value) => value + 1)}
          disabled={loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, padding: "8px 12px" }}
        >
          <RefreshCw size={14} style={{ transform: loading ? "rotate(180deg)" : "none" }} />
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <div style={{ ...cardStyle, borderLeft: "4px solid #f59e0b" }}>
          <div style={{ color: "#6b7280", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>Pending</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{summary.pending}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: "4px solid #22c55e" }}>
          <div style={{ color: "#6b7280", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>Approved</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{summary.approved}</div>
        </div>
      </div>

      <div style={{ ...cardStyle, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <strong>Filters</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setStatusFilter(option);
                  setPage(0);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: statusFilter === option ? "1px solid #0f4c81" : "1px solid #dbe3ee",
                  background: statusFilter === option ? "#eaf5ff" : "#fff",
                  color: statusFilter === option ? "#0f4c81" : "#495d75",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {flash && <FlashBanner flash={flash} />}

      {loading ? (
        <LoadingState label="Loading leave requests…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No leave requests"
          message="There are no leave records for the selected status."
        />
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #dfe7f0", borderRadius: 12, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead style={{ background: "#f7f9fc" }}>
              <tr>
                <th style={thStyle}>Worker</th>
                <th style={thStyle}>Dates</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const id = getLeaveRequestId(item);
                const status = String(item.status || item.state || "PENDING").toUpperCase();
                const isPending = status === "PENDING";
                const canAct = isPending;

                return (
                  <tr key={id ?? `${status}-${Math.random()}`} style={{ borderTop: "1px solid #edf2f7" }}>
                    <td style={tdStyle}>{getLeaveWorker(item)}</td>
                    <td style={tdStyle}>{formatDateRange(item)}</td>
                    <td style={tdStyle}>{item.leaveType || item.type || "—"}</td>
                    <td style={{ ...tdStyle, maxWidth: 200, whiteSpace: "normal", lineHeight: 1.4 }}>{getLeaveReason(item)}</td>
                    <td style={tdStyle}>
                      <span className={`cmChip cmChip-${leaveStatusTone(status)}`}>{leaveStatusLabel(status)}</span>
                    </td>
                    <td style={tdStyle}>{formatCreated(item)}</td>
                    <td style={tdStyle}>
                      {canAct ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="primaryButton"
                            onClick={() => handleApprove(item)}
                            disabled={busyActionId === id}
                            style={{ fontSize: 11, padding: "7px 9px", gap: 6 }}
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            className="secondaryButton"
                            onClick={() => handleReject(item)}
                            disabled={busyActionId === id}
                            style={{ fontSize: 11, padding: "7px 9px", gap: 6 }}
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#6b7280" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "#586d84", fontSize: 13 }}>
            Showing {items.length} of {pageMeta.totalElements || items.length} records
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="secondaryButton"
              disabled={page <= 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondaryButton"
              disabled={page >= (pageMeta.totalPages || 1) - 1}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {approveTarget && (
        <ConfirmDialog
          title="Approve leave request"
          message={`Approve this leave request for ${getLeaveWorker(approveTarget)}?`}
          confirmLabel={busyActionId ? "Approving…" : "Approve"}
          confirmVariant="primary"
          busy={busyActionId === getLeaveRequestId(approveTarget)}
          onConfirm={confirmApprove}
          onCancel={() => setApproveTarget(null)}
        />
      )}

      {rejectTarget && (
        <ConfirmDialog
          title="Reject leave request"
          message="This action requires a rejection reason."
          confirmLabel={busyActionId ? "Rejecting…" : "Reject"}
          confirmVariant="danger"
          busy={busyActionId === getLeaveRequestId(rejectTarget)}
          onConfirm={confirmReject}
          onCancel={() => {
            setRejectTarget(null);
            setRejectError("");
            setRejectReason("");
          }}
        >
          <div style={{ display: "grid", gap: 10, minWidth: 300 }}>
            <Field label="Rejection reason" required error={rejectError || undefined}>
              <textarea
                value={rejectReason}
                onChange={(event) => {
                  setRejectReason(event.target.value);
                  if (rejectError) setRejectError("");
                }}
                rows={4}
                placeholder="Enter the reason for rejection"
                style={{ width: "100%", resize: "vertical", borderRadius: 10, border: "1px solid #cfe0ee", padding: 10, font: "inherit" }}
              />
            </Field>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #e5edf6",
  borderRadius: 12,
  padding: 12,
}

const thStyle = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#586d84",
  background: "#f7f9fc",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#1f2d3d",
  verticalAlign: "top",
  lineHeight: 1.4,
};
