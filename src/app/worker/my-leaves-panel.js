"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Plus, Trash2 } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  useFlash,
} from "@/app/admin/admin-ui";
import { getAuthSession } from "@/lib/auth";
import {
  applyForLeave,
  cancelLeaveRequest,
  coerceLeaveStatus,
  getLeaveDates,
  getLeaveReason,
  getLeaveRequestId,
  leaveStatusLabel,
  leaveStatusTone,
  listLeaveRequests,
  LEAVE_TYPES,
} from "@/lib/leaveApi";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateRange(item) {
  const { fromDate, toDate } = getLeaveDates(item);
  if (!fromDate && !toDate) return "—";
  return `${formatDate(fromDate)}${fromDate && toDate && fromDate !== toDate ? ` to ${formatDate(toDate)}` : ""}`;
}

export default function MyLeavesPanel({ session: passedSession } = {}) {
  const session = passedSession || getAuthSession();
  const workerId = session?.user?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(workerId));
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [busyActionId, setBusyActionId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flash, showFlash] = useFlash();
  const [form, setForm] = useState({ fromDate: "", toDate: "", leaveType: "CASUAL", reason: "" });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (!workerId) return undefined;

    let cancelled = false;
    const refresh = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await listLeaveRequests({
          workerId,
          page: 0,
          size: PAGE_SIZE,
          sort: ["createdAt,DESC"],
        });
        if (!cancelled) setItems(Array.isArray(data?.content) ? data.content : []);
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(err instanceof Error ? err.message : "Your leave history could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void refresh();
    return () => { cancelled = true; };
  }, [reloadToken, workerId]);

  const summary = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const entry of items) {
      const status = coerceLeaveStatus(entry.status || entry.state || "PENDING");
      if (status === "PENDING") counts.pending += 1;
      if (status === "APPROVED") counts.approved += 1;
      if (status === "REJECTED") counts.rejected += 1;
      if (status === "CANCELLED") counts.cancelled += 1;
    }
    return counts;
  }, [items]);

  function validateForm() {
    const nextErrors = {};
    if (!form.fromDate) nextErrors.fromDate = "Please select a start date.";
    if (!form.toDate) nextErrors.toDate = "Please select an end date.";
    if (!form.leaveType) nextErrors.leaveType = "Please select a leave type.";
    if (!form.reason || !form.reason.trim()) nextErrors.reason = "Please describe the reason for leave.";
    if (form.fromDate && form.toDate) {
      const start = new Date(form.fromDate);
      const end = new Date(form.toDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
        nextErrors.toDate = "To date cannot be earlier than from date.";
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await applyForLeave({
        fromDate: form.fromDate,
        toDate: form.toDate,
        leaveType: form.leaveType,
        reason: form.reason.trim(),
      });
      showFlash("success", "Leave request submitted successfully.");
      setShowForm(false);
      setForm({ fromDate: "", toDate: "", leaveType: "CASUAL", reason: "" });
      setFormErrors({});
      setReloadToken((value) => value + 1);
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "Your leave request could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel(item) {
    const id = getLeaveRequestId(item);
    if (!id) return;
    const confirmed = window.confirm("Cancel this leave request?");
    if (!confirmed) return;
    setBusyActionId(id);
    try {
      await cancelLeaveRequest(id);
      showFlash("success", "Leave request cancelled.");
      setReloadToken((value) => value + 1);
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "The leave request could not be cancelled.");
    } finally {
      setBusyActionId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>My Leaves</h1>
          <p style={{ margin: "4px 0 0", color: "#586d84", fontSize: 12 }}>Track your own leave requests and submit new applications.</p>
        </div>
        <button type="button" className="primaryButton" onClick={() => setShowForm((value) => !value)} style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, padding: "8px 12px" }}>
          <Plus size={14} /> {showForm ? "Close form" : "Apply for Leave"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <div style={cardStyle}><div style={miniLabel}>Pending</div><div style={miniValue}>{summary.pending}</div></div>
        <div style={cardStyle}><div style={miniLabel}>Approved</div><div style={miniValue}>{summary.approved}</div></div>
        <div style={cardStyle}><div style={miniLabel}>Rejected</div><div style={miniValue}>{summary.rejected}</div></div>
        <div style={cardStyle}><div style={miniLabel}>Cancelled</div><div style={miniValue}>{summary.cancelled}</div></div>
      </div>

      {flash && <FlashBanner flash={flash} />}

      {showForm && (
        <div style={{ ...cardStyle, display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Apply for Leave</h2>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <Field label="From date" required error={formErrors.fromDate}>
                <input
                  type="date"
                  value={form.fromDate}
                  onChange={(event) => setForm((current) => ({ ...current, fromDate: event.target.value }))}
                  style={inputStyle}
                />
              </Field>
              <Field label="To date" required error={formErrors.toDate}>
                <input
                  type="date"
                  value={form.toDate}
                  onChange={(event) => setForm((current) => ({ ...current, toDate: event.target.value }))}
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Leave type" required error={formErrors.leaveType}>
              <select
                value={form.leaveType}
                onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value }))}
                style={inputStyle}
              >
                {LEAVE_TYPES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>

            <Field label="Reason" required error={formErrors.reason}>
              <textarea
                rows={4}
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Explain the reason for this leave request"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="secondaryButton" onClick={() => setShowForm(false)} disabled={isSubmitting} style={{ fontSize: 12, padding: "8px 12px" }}>Cancel</button>
              <button type="submit" className="primaryButton" disabled={isSubmitting} style={{ fontSize: 12, padding: "8px 12px" }}>
                {isSubmitting ? "Submitting…" : "Submit leave request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading your leave history…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No leave history yet" message="You have not submitted any leave requests." />
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #dfe7f0", borderRadius: 12, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead style={{ background: "#f7f9fc" }}>
              <tr>
                <th style={thStyle}>Dates</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Submitted</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = coerceLeaveStatus(item.status || item.state || "PENDING");
                const id = getLeaveRequestId(item);
                const canCancel = status === "PENDING";
                return (
                  <tr key={id ?? `${status}-${Math.random()}`} style={{ borderTop: "1px solid #edf2f7" }}>
                    <td style={tdStyle}>{formatDateRange(item)}</td>
                    <td style={tdStyle}>{item.leaveType || item.type || "—"}</td>
                    <td style={{ ...tdStyle, maxWidth: 220, whiteSpace: "normal", lineHeight: 1.4 }}>{getLeaveReason(item)}</td>
                    <td style={tdStyle}><span className={`cmChip cmChip-${leaveStatusTone(status)}`}>{leaveStatusLabel(status)}</span></td>
                    <td style={tdStyle}>{formatDate(item.createdAt || item.submittedAt || item.requestedAt)}</td>
                    <td style={tdStyle}>
                      {canCancel ? (
                        <button
                          type="button"
                          className="secondaryButton"
                          onClick={() => handleCancel(item)}
                          disabled={busyActionId === id}
                          style={{ fontSize: 11, padding: "7px 9px", gap: 6 }}
                        >
                          <Trash2 size={13} /> {busyActionId === id ? "Cancelling…" : "Cancel"}
                        </button>
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
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #e5edf6",
  borderRadius: 12,
  padding: 12,
};

const miniLabel = { color: "#6b7280", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" };
const miniValue = { marginTop: 6, fontSize: 22, fontWeight: 800 };
const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cfe0ee",
  background: "#fff",
  font: "inherit",
  color: "#1f2d3d",
  fontSize: 12,
};
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
