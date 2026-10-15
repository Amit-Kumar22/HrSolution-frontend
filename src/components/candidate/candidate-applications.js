"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Briefcase, CalendarClock, Eye, MapPin, RefreshCw } from "lucide-react";
import {
  CandidateApiError,
  getApplication,
  listApplications,
  withdrawApplication,
} from "@/lib/candidateApi";
import {
  EmptyState,
  ErrorState,
  Modal,
  Spinner,
  StatusBadge,
  formatDate,
  formatDateTime,
  formatSalary,
  statusLabel,
} from "./candidate-ui";

function DetailRow({ label, value }) {
  return (
    <div className="cp-detail">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function ApplicationDetailModal({ open, applicationId, onClose }) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

  function load() {
    if (!applicationId) return;
    setState({ status: "loading", data: null, error: "" });
    getApplication(applicationId)
      .then((data) => setState({ status: "ready", data, error: "" }))
      .catch((error) => {
        const message =
          error instanceof CandidateApiError && error.status === 404
            ? "That application could not be found, or does not belong to you."
            : error instanceof Error
              ? error.message
              : "The application details could not be loaded.";
        setState({ status: "error", data: null, error: message });
      });
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      title="Application details"
      description="The latest information recorded for this application."
      onClose={onClose}
      size="lg"
    >
      {state.status === "loading" && <Spinner label="Loading application…" />}
      {state.status === "error" && <ErrorState message={state.error} onRetry={load} />}
      {state.status === "ready" && state.data && (
        <div className="cp-detailGrid">
          <DetailRow label="Reference" value={state.data.reference} />
          <DetailRow label="Job title" value={state.data.jobTitle} />
          <DetailRow label="Category" value={state.data.categoryName} />
          <DetailRow label="Location" value={state.data.location} />
          <DetailRow label="Applied on" value={formatDate(state.data.appliedOn)} />
          <DetailRow label="Status" value={statusLabel(state.data)} />
          <DetailRow label="Expected salary" value={formatSalary(state.data.expectedSalary)} />
          <DetailRow label="Next interview" value={state.data.nextInterviewAt ? formatDateTime(state.data.nextInterviewAt) : "Not scheduled"} />
          <DetailRow label="Resume document" value={state.data.resumeDocumentId ? `#${state.data.resumeDocumentId}` : "Not attached"} />
          <DetailRow label="Withdrawable" value={state.data.withdrawable ? "Yes" : "No"} />
        </div>
      )}
    </Modal>
  );
}

function WithdrawModal({ open, application, onClose, onWithdrawn }) {
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (processing) return;
    setReason("");
    setError("");
    onClose();
  }

  async function confirm() {
    if (processing || !application) return;
    setProcessing(true);
    setError("");
    try {
      const updated = await withdrawApplication(application.id, reason);
      setProcessing(false);
      setReason("");
      onWithdrawn(updated);
    } catch (caught) {
      const message =
        caught instanceof CandidateApiError && caught.status === 404
          ? "That application could not be found, or does not belong to you."
          : caught instanceof Error
            ? caught.message
            : "The application could not be withdrawn. Please try again.";
      setError(message);
      setProcessing(false);
    }
  }

  if (!open || !application) return null;

  return (
    <Modal
      open={open}
      title="Withdraw application"
      description={application.jobTitle ? `Withdraw your application for ${application.jobTitle}.` : undefined}
      onClose={close}
      footer={
        <>
          <button type="button" className="authButtonSecondary" onClick={close} disabled={processing}>
            Keep application
          </button>
          <button type="button" className="cp-dangerButton" onClick={confirm} disabled={processing}>
            {processing ? "Withdrawing…" : "Withdraw application"}
          </button>
        </>
      }
    >
      <div className="authAlert authAlert--error" role="alert">
        <AlertTriangle size={16} />
        Withdrawal is permanent for this vacancy. You will not be able to apply again for the same role.
      </div>
      {error && (
        <div className="authAlert authAlert--error" role="alert">
          {error}
        </div>
      )}
      <div className="authField">
        <label className="authLabel" htmlFor="cp-withdraw-reason">Reason (optional)</label>
        <textarea
          id="cp-withdraw-reason"
          className="authInput cp-textarea"
          rows={3}
          maxLength={1000}
          placeholder="e.g. Accepted another offer"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={processing}
        />
      </div>
    </Modal>
  );
}

export default function CandidateApplications({ applications, loading, error, onRefresh, onBrowseJobs }) {
  const [detailId, setDetailId] = useState(null);
  const [withdrawTarget, setWithdrawTarget] = useState(null);

  if (loading) return <Spinner label="Loading your applications…" />;
  if (error) return <ErrorState message={error} onRetry={onRefresh} />;

  const items = Array.isArray(applications) ? applications : [];

  return (
    <section className="cp-panel">
      <div className="cp-panelHead">
        <div>
          <h2>My applications</h2>
          <p>{items.length ? `${items.length} application${items.length > 1 ? "s" : ""} submitted.` : "Track every job you have applied for."}</p>
        </div>
        <button type="button" className="authButtonSecondary cp-inlineButton" onClick={onRefresh}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No applications yet"
          action={
            <button type="button" className="authButton cp-inlineButton" onClick={onBrowseJobs}>
              <Briefcase size={15} /> Browse jobs
            </button>
          }
        >
          You have not applied for any vacancies yet. Browse the available jobs to get started.
        </EmptyState>
      ) : (
        <div className="cp-tableWrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Category</th>
                <th>Location</th>
                <th>Reference</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Expected salary</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((application) => (
                <tr key={application.id}>
                  <td data-label="Job">
                    <strong>{application.jobTitle || "Untitled role"}</strong>
                    {application.nextInterviewAt && (
                      <span className="cp-cellNote">
                        <CalendarClock size={12} /> Interview {formatDateTime(application.nextInterviewAt)}
                      </span>
                    )}
                  </td>
                  <td data-label="Category">{application.categoryName || "—"}</td>
                  <td data-label="Location">
                    <span className="cp-cellInline">
                      <MapPin size={12} /> {application.location || "—"}
                    </span>
                  </td>
                  <td data-label="Reference">{application.reference || "—"}</td>
                  <td data-label="Applied">{formatDate(application.appliedOn)}</td>
                  <td data-label="Status">
                    <StatusBadge status={application.status} label={statusLabel(application)} />
                  </td>
                  <td data-label="Expected salary">{formatSalary(application.expectedSalary)}</td>
                  <td data-label="Actions">
                    <div className="cp-rowActions">
                      <button type="button" className="cp-linkButton" onClick={() => setDetailId(application.id)}>
                        <Eye size={13} /> View details
                      </button>
                      {application.withdrawable && (
                        <button type="button" className="cp-linkButton cp-linkButton--danger" onClick={() => setWithdrawTarget(application)}>
                          <Ban size={13} /> Withdraw
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

      {detailId !== null && (
        <ApplicationDetailModal open applicationId={detailId} onClose={() => setDetailId(null)} />
      )}

      <WithdrawModal
        open={Boolean(withdrawTarget)}
        application={withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
        onWithdrawn={(updated) => {
          setWithdrawTarget(null);
          onRefresh();
        }}
      />
    </section>
  );
}

export { ApplicationDetailModal, WithdrawModal };
