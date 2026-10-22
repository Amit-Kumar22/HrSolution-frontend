"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Download,
  Eye,
  FileText,
  Loader2,
  TrendingUp,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  AdminApiError,
  APPLICATION_STATUSES,
  CANDIDATE_SOURCES,
  MANUAL_STATUS_BLOCKED,
  applicationStatusHint,
  applicationStatusLabel,
  applicationStatusTone,
  assignApplication,
  candidateSourceLabel,
  fetchDocumentBlob,
  getApplication,
  getApplicationDetail,
  isTerminalApplicationStatus,
  listCandidates,
  listEligibleStaff,
  listJobs,
  recordJobApplication,
  updateApplicationStatus,
} from "../../lib/adminApi";
import {
  Chip,
  Drawer,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  Notice,
  formatDate,
  formatDateTime,
} from "./admin-ui";
import { FeedbackChip, ModeChip, RatingValue, ResultChip } from "./interview-modals";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

export function ApplicationStatusChip({ status }) {
  if (!status) return <span className="cmMuted">—</span>;
  return <Chip tone={applicationStatusTone(status)}>{applicationStatusLabel(status)}</Chip>;
}

function DetailRow({ label, children, full = false }) {
  return (
    <div className={`cmDetailRow${full ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{children}</span>
    </div>
  );
}

function ResumeAvailability({ application }) {
  if (!application) return <span className="cmMuted">—</span>;
  const hasResume = Boolean(application.hasResume) || application.resumeDocumentId != null;
  if (hasResume) return <Chip tone="success">Available</Chip>;
  return <Chip tone="neutral">No Resume</Chip>;
}

/**
 * The allowed transitions come from the backend (`allowedNextStatuses`).
 * INTERVIEW_SCHEDULED is never offered — the interview workflow sets it.
 */
export function allowedTransitions(record) {
  if (!record) return [];
  const source =
    record.allowedNextStatuses ?? record.allowedStatuses ?? record.nextStatuses ?? null;
  const raw = Array.isArray(source) ? source : [];
  return raw.filter((status) => typeof status === "string" && status && !MANUAL_STATUS_BLOCKED.includes(status));
}

function statusMeta(status) {
  return APPLICATION_STATUSES.find((entry) => entry.value === status) || { value: status, label: status, tone: "neutral" };
}

/* ------------------------------------------------------------------ */
/* Candidate picker (existing candidates only)                         */
/* ------------------------------------------------------------------ */

export function CandidatePicker({ value, onChange, disabled = false, id = "app-candidate-search" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return undefined;
    const current = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const page = await listCandidates({ search: term, size: 10, includeSpam: false });
        if (seq.current !== current) return;
        setResults(page.content || []);
      } catch {
        if (seq.current === current) setResults([]);
      } finally {
        if (seq.current === current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(candidate) {
    setQuery(candidate.fullName || `Candidate #${candidate.id}`);
    setResults([]);
    setLoading(false);
    onChange(candidate);
  }

  function clearSelection() {
    setQuery("");
    setResults([]);
    setLoading(false);
    onChange(null);
  }

  return (
    <>
      <Field
        label="Existing candidate"
        htmlFor={id}
        required
        error={value ? undefined : "Select an existing candidate. Register them first if they are new."}
        hint="Search by name, email or phone. The candidate must already exist in the system."
      >
        <input
          id={id}
          value={query}
          placeholder="Search by name, email or phone…"
          onChange={(event) => {
            const term = event.target.value;
            setQuery(term);
            setResults([]);
            setLoading(term.trim().length >= 2);
            onChange(null);
          }}
          disabled={disabled}
        />
      </Field>

      {loading && <LoadingState label="Searching candidates…" />}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <Notice tone="warn">No candidates matched. Try a different search, or register the candidate first.</Notice>
      )}

      {results.length > 0 && !value && (
        <div className="jobCandidateList">
          {results.map((candidate) => (
            <button type="button" key={candidate.id} className="jobCandidateItem" onClick={() => pick(candidate)}>
              <strong>{candidate.fullName || `Candidate #${candidate.id}`}</strong>
              <small>{[candidate.email, candidate.phone, candidate.city].filter(Boolean).join(" · ")}</small>
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="jobSelectedCandidate">
          <Chip tone="success">Selected</Chip>
          <strong>{value.fullName || `Candidate #${value.id}`}</strong>
          <small>{[value.email, value.phone].filter(Boolean).join(" · ")}</small>
          <button type="button" className="cmLinkButton" onClick={clearSelection}>
            Change
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Change status                                                       */
/* ------------------------------------------------------------------ */

export function ChangeApplicationStatusModal({ application, onClose, onSaved }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const current = ++seq.current;
    (async () => {
      try {
        const data = await getApplication(application.id);
        if (cancelled || seq.current !== current) return;
        setRecord(data);
        setLoadError("");
        const isTerminal = Boolean(data.terminal || isTerminalApplicationStatus(data.status));
        const options = allowedTransitions(data);
        if (!isTerminal && options.length === 1) setStatus(options[0]);
      } catch (error) {
        if (cancelled || seq.current !== current) return;
        setLoadError(error instanceof Error ? error.message : "The application could not be loaded.");
      } finally {
        if (!cancelled && seq.current === current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      seq.current += 1;
    };
  }, [application.id]);

  const terminal = Boolean(record && (record.terminal || isTerminalApplicationStatus(record.status)));
  const options = useMemo(() => (terminal ? [] : allowedTransitions(record)), [record, terminal]);
  const blocked = useMemo(() => {
    if (!record) return [];
    const source =
      record.allowedNextStatuses ?? record.allowedStatuses ?? record.nextStatuses ?? null;
    if (!Array.isArray(source)) return [];
    return source.filter((value) => MANUAL_STATUS_BLOCKED.includes(value));
  }, [record]);

  const noteRequired = status === "REJECTED";

  function setStatusValue(next) {
    setStatus(next);
    setErrors((current) => {
      if (!current.status && !current.note) return current;
      const updated = { ...current };
      delete updated.status;
      delete updated.note;
      return updated;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");

    if (!status) {
      setErrors({ status: "Choose the status to move this application to." });
      return;
    }
    if (options.length === 0) {
      setFormError("This application has no status transition available. It may already be in a final status.");
      return;
    }
    if (noteRequired && !note.trim()) {
      setErrors({ note: "A rejection reason is required before an application can be rejected." });
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const updated = await updateApplicationStatus(application.id, status, note);
      onSaved(updated, status);
    } catch (error) {
      if (error instanceof AdminApiError) {
        if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
        if (error.status === 422) {
          setFormError(
            error.message ||
              "The backend refused this status change. Pick one of the allowed next statuses and try again.",
          );
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("The status could not be changed. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Change application status"
      description={`${application.candidateName || "Candidate"} · ${application.jobTitle || `Job #${application.jobId}`} · Application #${application.id}`}
      onClose={onClose}
    >
      {loading ? (
        <LoadingState label="Loading allowed transitions…" />
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : (
        <form className="cmForm" onSubmit={submit} noValidate>
          {formError && <Notice tone="error">{formError}</Notice>}

          <div className="cmFormGrid">
            <Field label="Current status" htmlFor="app-current-status">
              <input id="app-current-status" value={applicationStatusLabel(record?.status)} disabled readOnly />
            </Field>

            <Field
              label="New status"
              htmlFor="app-new-status"
              required
              error={errors.status}
              hint="Only the transitions the backend allows for this application are listed."
            >
              <select
                id="app-new-status"
                value={status}
                onChange={(event) => setStatusValue(event.target.value)}
                disabled={saving || options.length === 0}
              >
                <option value="">{options.length === 0 ? "No further transitions" : "Select a status…"}</option>
                {options.map((value) => (
                  <option key={value} value={value}>
                    {applicationStatusLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {terminal && (
            <Notice tone="warn">
              This application is in a terminal status. Its history is retained and no further status changes are
              available.
            </Notice>
          )}

          {!terminal && options.length === 0 && (
            <Notice tone="info">
              The backend did not return any allowed next status for this application, so it cannot be moved manually.
            </Notice>
          )}

          {blocked.length > 0 && (
            <Notice tone="info">
              Interview scheduled is set automatically when an interview round is scheduled, so it cannot be selected
              here.
            </Notice>
          )}

          {status === "ON_HOLD" && (
            <Notice tone="info">
              On hold means the application is kept on file for a future opening. It is not a rejection.
            </Notice>
          )}

          {noteRequired && (
            <Notice tone="warn">A rejection reason is required. The note is stored in the application history.</Notice>
          )}

          <div style={{ marginTop: 16 }}>
            <Field
              label={noteRequired ? "Rejection reason" : "Note (optional)"}
              htmlFor="app-status-note"
              required={noteRequired}
              error={errors.note}
              hint="Recorded in the application history against your name."
            >
              <textarea
                id="app-status-note"
                rows={3}
                maxLength={1000}
                value={note}
                placeholder={noteRequired ? "e.g. Did not meet the experience requirement" : "Add context for this change"}
                onChange={(event) => setNote(event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <div className="cmModalFooter">
            <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primaryButton cmBtn" disabled={saving || options.length === 0}>
              {saving ? (
                <>
                  <Loader2 size={15} className="spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Assign / unassign a recruiter                                        */
/* ------------------------------------------------------------------ */

export function AssignRecruiterModal({ application, onClose, onSaved }) {
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(
    application && application.assignedToUserId != null ? String(application.assignedToUserId) : "",
  );
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listEligibleStaff();
        if (cancelled) return;
        setRecruiters(Array.isArray(list) ? list : []);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "The recruiter list could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setSaving(true);
    try {
      // An empty selection unassigns the recruiter: the API sends a real null.
      const updated = await assignApplication(application.id, selected === "" ? null : Number(selected), note);
      onSaved(updated, selected === "" ? null : Number(selected));
    } catch (error) {
      if (error instanceof AdminApiError) setFormError(error.message);
      else setFormError("The recruiter could not be assigned. Please try again.");
      setSaving(false);
    }
  }

  const currentName = application?.assignedToName || (application?.assignedToUserId != null ? `User #${application.assignedToUserId}` : "");

  return (
    <Modal
      title="Assign recruiter"
      description={`${application.candidateName || "Candidate"} · ${application.jobTitle || `Job #${application.jobId}`} · Application #${application.id}`}
      onClose={onClose}
    >
      <form className="cmForm" onSubmit={submit} noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        {loadError && <Notice tone="warn">{loadError}</Notice>}

        <div className="cmFormGrid" style={{ marginTop: formError || loadError ? 14 : 0 }}>
          <Field label="Currently assigned" htmlFor="app-current-recruiter">
            <input
              id="app-current-recruiter"
              value={currentName || "Unassigned"}
              disabled
              readOnly
            />
          </Field>

          <Field
            label="Recruiter"
            htmlFor="app-recruiter"
            required
            hint="Pick an active staff member. Leaving it unassigned returns the application to the unassigned queue."
          >
            <select
              id="app-recruiter"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={saving || loading}
            >
              <option value="">Unassigned</option>
              {recruiters.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName || person.email || `User #${person.id}`}
                  {person.email && person.fullName ? ` — ${person.email}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Note (optional)" htmlFor="app-assign-note" hint="Recorded in the application history.">
            <textarea
              id="app-assign-note"
              rows={2}
              maxLength={1000}
              value={note}
              placeholder="e.g. Assigned for candidate screening."
              onChange={(event) => setNote(event.target.value)}
              disabled={saving}
            />
          </Field>
        </div>

        {loading && <LoadingState label="Loading recruiters…" />}

        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 size={15} className="spin" /> Saving…
              </>
            ) : selected === "" ? (
              "Unassign recruiter"
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Record an application on behalf of a candidate                       */
/* ------------------------------------------------------------------ */

export function RecordApplicationModal({ onClose, onSaved, initialJobId = "" }) {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [jobId, setJobId] = useState(initialJobId ? String(initialJobId) : "");
  const [candidate, setCandidate] = useState(null);
  const [source, setSource] = useState("WALK_IN");
  const [coverNote, setCoverNote] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [note, setNote] = useState("");
  const [recruiters, setRecruiters] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await listJobs({ size: 200, sort: ["createdAt,DESC"] });
        if (cancelled) return;
        setJobs(page.content || []);
        setJobsError("");
      } catch (error) {
        if (cancelled) return;
        setJobsError(error instanceof Error ? error.message : "The job list could not be loaded.");
      } finally {
        if (!cancelled) setJobsLoading(false);
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
        const list = await listEligibleStaff();
        if (!cancelled) setRecruiters(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setRecruiters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const next = {};
    if (!jobId) next.jobId = "Choose the vacancy this application belongs to.";
    if (!candidate) next.candidateId = "Select an existing candidate. Register them first if they are new.";
    if (expectedSalary !== "") {
      const value = Number(expectedSalary);
      if (!Number.isFinite(value) || value < 0) next.expectedSalary = "Enter a valid expected salary.";
    }
    if (coverNote.length > 2000) next.coverNote = "Cover note must be 2,000 characters or fewer.";
    if (note.length > 1000) next.note = "Internal note must be 1,000 characters or fewer.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError("");
    setSaving(true);

    const payload = {
      candidateId: Number(candidate.id),
      source,
    };
    if (coverNote.trim()) payload.coverNote = coverNote.trim();
    if (expectedSalary !== "") payload.expectedSalary = Number(expectedSalary);
    if (assignedToUserId) payload.assignedToUserId = Number(assignedToUserId);
    if (note.trim()) payload.note = note.trim();

    try {
      const application = await recordJobApplication(Number(jobId), payload);
      onSaved(application);
    } catch (error) {
      if (error instanceof AdminApiError) {
        if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
        if (error.status === 409) {
          setFormError(
            error.message || "This candidate already has an application for this vacancy. No duplicate was created.",
          );
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("The application could not be recorded. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title="Record an application"
      description="For walk-ins, phone enquiries and agency submissions. The candidate must already exist."
      onClose={onClose}
    >
      <form className="cmForm" onSubmit={submit} noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Notice tone="info">
          This creates an application for an existing candidate against a vacancy. New candidates must be registered
          first from the Candidates module.
        </Notice>

        <div className="cmFormGrid" style={{ marginTop: 16 }}>
          <Field label="Job / vacancy" htmlFor="app-job" required error={errors.jobId}>
            <select id="app-job" value={jobId} onChange={(event) => setJobId(event.target.value)} disabled={saving}>
              <option value="">{jobsLoading ? "Loading jobs…" : "Select a vacancy…"}</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title || `Job #${job.id}`}
                  {job.status ? ` — ${job.status.replace(/_/g, " ").toLowerCase()}` : ""}
                </option>
              ))}
            </select>
          </Field>

          {jobsError && <Notice tone="warn">{jobsError}</Notice>}

          <CandidatePicker value={candidate} onChange={setCandidate} disabled={saving} id="app-record-candidate" />

          <div className="cmFormRow">
            <Field label="Application source" htmlFor="app-record-source" required>
              <select id="app-record-source" value={source} onChange={(event) => setSource(event.target.value)} disabled={saving}>
                {CANDIDATE_SOURCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expected salary (₹ / month)" htmlFor="app-record-salary" error={errors.expectedSalary}>
              <input
                id="app-record-salary"
                type="number"
                min={0}
                step={100}
                value={expectedSalary}
                placeholder="20000"
                onChange={(event) => setExpectedSalary(event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <Field
            label="Assigned recruiter"
            htmlFor="app-record-assignee"
            error={errors.assignedToUserId}
            hint="Optional. The recruiter who will own this application."
          >
            <select
              id="app-record-assignee"
              value={assignedToUserId}
              onChange={(event) => setAssignedToUserId(event.target.value)}
              disabled={saving}
            >
              <option value="">Unassigned</option>
              {recruiters.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName || person.email || `User #${person.id}`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cover note" htmlFor="app-record-cover" error={errors.coverNote}>
            <textarea
              id="app-record-cover"
              rows={3}
              maxLength={2000}
              value={coverNote}
              placeholder="Candidate applied during an office visit."
              onChange={(event) => setCoverNote(event.target.value)}
              disabled={saving}
            />
          </Field>

          <Field label="Internal note" htmlFor="app-record-note" error={errors.note} hint="Recorded against the submission in the audit trail.">
            <textarea
              id="app-record-note"
              rows={2}
              maxLength={1000}
              value={note}
              placeholder="Follow up with the candidate."
              onChange={(event) => setNote(event.target.value)}
              disabled={saving}
            />
          </Field>
        </div>

        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={15} className="spin" /> Recording…
              </>
            ) : (
              "Record application"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Application detail drawer                                           */
/* ------------------------------------------------------------------ */

function historyFrom(entry) {
  if (!entry) return null;
  const from =
    entry.fromStatus ?? entry.previousStatus ?? entry.oldStatus ?? entry.from_status ?? null;
  const to = entry.toStatus ?? entry.newStatus ?? entry.status ?? entry.to_status ?? null;
  const changedAt =
    entry.changedAt ?? entry.changeDate ?? entry.createdAt ?? entry.occurredAt ?? null;
  const changedBy =
    entry.changedByEmail ?? entry.changedBy ?? entry.actorEmail ?? entry.madeByEmail ?? null;
  const notes = entry.notes ?? entry.note ?? entry.comment ?? null;
  const madeByStaff =
    entry.madeByStaff ?? entry.byStaff ?? entry.staffAction ?? entry.isStaff ?? null;
  return { from, to, changedAt, changedBy, notes, madeByStaff, raw: entry };
}

function sortHistory(history) {
  const list = Array.isArray(history) ? history : [];
  return list
    .map(historyFrom)
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = Date.parse(a.changedAt || 0);
      const bTime = Date.parse(b.changedAt || 0);
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
      return 0;
    });
}

export function ApplicationDetailDrawer({ applicationId, canManage = false, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("overview");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [statusTarget, setStatusTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const seq = useRef(0);

  function load() {
    const current = ++seq.current;
    setLoading(true);
    setLoadError("");
    return getApplicationDetail(applicationId)
      .then((payload) => {
        if (seq.current !== current) return;
        setData(payload);
      })
      .catch((error) => {
        if (seq.current === current) {
          setLoadError(error instanceof Error ? error.message : "The application could not be loaded.");
        }
      })
      .finally(() => {
        if (seq.current === current) setLoading(false);
      });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
      seq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const application = useMemo(() => {
    if (!data || typeof data !== "object") return null;
    if (data.application && typeof data.application === "object") return data.application;
    if (data.id != null) return data;
    return null;
  }, [data]);

  const history = useMemo(() => {
    const source =
      (data && (data.history ?? data.statusHistory ?? data.statusChanges ?? data.timeline)) || null;
    return sortHistory(source);
  }, [data]);

  const interviews = useMemo(() => {
    const source =
      (data && (data.interviews ?? data.applicationInterviews ?? data.scheduledInterviews)) || null;
    if (!Array.isArray(source)) return [];
    return [...source].sort((a, b) => {
      const roundDelta = (a.roundNumber || 0) - (b.roundNumber || 0);
      if (roundDelta !== 0) return roundDelta;
      return Date.parse(a.scheduledAt || 0) - Date.parse(b.scheduledAt || 0);
    });
  }, [data]);

  async function openResume(mode) {
    if (!application || !application.resumeDocumentId) return;
    setResumeError("");
    const win = mode === "view" ? window.open("", "_blank") : null;
    setResumeBusy(true);
    try {
      const { blob, filename } = await fetchDocumentBlob(application.resumeDocumentId);
      const url = URL.createObjectURL(blob);
      if (mode === "view" && win) {
        win.location.href = url;
      } else if (mode === "view") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename || application.resumeFileName || `application-${application.id}-resume.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (win) win.close();
      setResumeError(error instanceof Error ? error.message : "The resume could not be opened.");
    } finally {
      setResumeBusy(false);
    }
  }

  function refresh() {
    load();
  }

  const title = application
    ? `${application.candidateName || "Candidate"} · ${application.jobTitle || `Job #${application.jobId}`}`
    : `Application #${applicationId}`;

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "history", label: `History${history.length ? ` (${history.length})` : ""}` },
    { value: "interviews", label: `Interviews${interviews.length ? ` (${interviews.length})` : ""}` },
  ];

  return (
    <>
      <Drawer
        title="Application details"
        description={title}
        onClose={onClose}
        size="lg"
        footer={
          <div className="cmStatusRow" style={{ justifyContent: "space-between" }}>
            <span className="cmPageInfo">Application #{applicationId}</span>
            <div className="cmStatusRow">
              {canManage && application && (
                <>
                  <button
                    type="button"
                    className="secondaryButton cmBtn cmPageBtn"
                    onClick={() => setStatusTarget(application)}
                  >
                    <TrendingUp size={14} /> Change status
                  </button>
                  <button
                    type="button"
                    className="secondaryButton cmBtn cmPageBtn"
                    onClick={() => setAssignTarget(application)}
                  >
                    <UserCheck size={14} /> Assign recruiter
                  </button>
                </>
              )}
              <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        }
      >
        {loading ? (
          <LoadingState label="Loading application…" />
        ) : loadError ? (
          <>
            <Notice tone="error">{loadError}</Notice>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="secondaryButton cmBtn" onClick={load}>
                Retry
              </button>
            </div>
          </>
        ) : !application ? (
          <EmptyState title="No application data" message="The backend returned no application record for this id." />
        ) : (
          <>
            <div className="cmStatusRow">
              <ApplicationStatusChip status={application.status} />
              <ResumeAvailability application={application} />
              {application.interviewCount != null && <Chip tone="info">{application.interviewCount} interview rounds</Chip>}
              {application.assignedToName ? (
                <Chip tone="accent">{application.assignedToName}</Chip>
              ) : (
                <Chip tone="warn">Unassigned</Chip>
              )}
            </div>

            {applicationStatusHint(application.status) && (
              <p className="cmHint" style={{ marginTop: 10 }}>
                {applicationStatusHint(application.status)}
              </p>
            )}

            <div className="ivTabBar" role="tablist" aria-label="Application sections" style={{ marginTop: 16 }}>
              {tabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  className={`ivTab${tab === item.value ? " ivTabActive" : ""}`}
                  onClick={() => setTab(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="cmDetailGrid" style={{ marginTop: 16 }}>
                <DetailRow label="Application ID"><span className="cmCode">#{application.id}</span></DetailRow>
                <DetailRow label="Current status"><ApplicationStatusChip status={application.status} /></DetailRow>
                <DetailRow label="Job title">{application.jobTitle || "—"}</DetailRow>
                <DetailRow label="Job slug">
                  {application.jobSlug ? <code className="cmCode">{application.jobSlug}</code> : "—"}
                </DetailRow>
                <DetailRow label="Category name">{application.categoryName || "—"}</DetailRow>
                <DetailRow label="Candidate name">{application.candidateName || "—"}</DetailRow>
                <DetailRow label="Candidate email">
                  {application.candidateEmail ? <a href={`mailto:${application.candidateEmail}`}>{application.candidateEmail}</a> : "—"}
                </DetailRow>
                <DetailRow label="Candidate phone">
                  {application.candidatePhone ? <a href={`tel:${application.candidatePhone}`}>{application.candidatePhone}</a> : "—"}
                </DetailRow>
                <DetailRow label="Applied on">{application.appliedOn ? formatDate(application.appliedOn) : "—"}</DetailRow>
                <DetailRow label="Days in pipeline">
                  {typeof application.daysInPipeline === "number" ? `${application.daysInPipeline} day(s)` : "—"}
                </DetailRow>
                <DetailRow label="Application source">
                  {application.source ? candidateSourceLabel(application.source) : "—"}
                </DetailRow>
                <DetailRow label="Assigned recruiter">{application.assignedToName || "Unassigned"}</DetailRow>
                <DetailRow label="Interview count">
                  {typeof application.interviewCount === "number" ? application.interviewCount : "—"}
                </DetailRow>
                <DetailRow label="Upcoming interview">{application.upcomingInterview ? "Yes" : "No"}</DetailRow>
                <DetailRow label="Created on">{application.createdAt ? formatDateTime(application.createdAt) : "—"}</DetailRow>
                <DetailRow label="Expected salary">
                  {application.expectedSalary == null ? "—" : `₹ ${Number(application.expectedSalary).toLocaleString("en-IN")}`}
                </DetailRow>
                <DetailRow label="Resume document ID">
                  {application.resumeDocumentId == null ? "—" : application.resumeDocumentId}
                </DetailRow>
                <DetailRow label="Resume file name">{application.resumeFileName || "—"}</DetailRow>
                <DetailRow label="Rejection reason" full>{application.rejectionReason || "—"}</DetailRow>
                <DetailRow label="Cover note" full>{application.coverNote || "No cover note."}</DetailRow>

                <div className="cmDetailFull">
                  <div className="cmStatusRow" style={{ marginTop: 4 }}>
                    {application.resumeDocumentId ? (
                      <>
                        <span className="cmMuted">
                          <FileText size={14} /> {application.resumeFileName || "Resume on file"}
                        </span>
                        <button
                          type="button"
                          className="secondaryButton cmBtn cmPageBtn"
                          onClick={() => openResume("view")}
                          disabled={resumeBusy}
                        >
                          <Eye size={14} /> View resume
                        </button>
                        <button
                          type="button"
                          className="secondaryButton cmBtn cmPageBtn"
                          onClick={() => openResume("download")}
                          disabled={resumeBusy}
                        >
                          <Download size={14} /> Download
                        </button>
                      </>
                    ) : (
                      <span className="cmMuted">
                        <FileText size={14} /> No resume on file
                      </span>
                    )}
                  </div>
                  {resumeError && (
                    <div style={{ marginTop: 10 }}>
                      <Notice tone="error">{resumeError}</Notice>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "history" && (
              <div style={{ marginTop: 16 }}>
                {history.length === 0 ? (
                  <EmptyState
                    title="No history yet"
                    message="No status changes have been recorded against this application."
                  />
                ) : (
                  <ol className="apHistory">
                    {history.map((entry, index) => {
                      const isSubmission = !entry.from;
                      return (
                        <li className="apHistoryItem" key={`${entry.changedAt || "entry"}-${index}`}>
                          <span className={`apHistoryDot${isSubmission ? " apHistoryDotStart" : ""}`} aria-hidden="true" />
                          <div className="apHistoryBody">
                            <div className="apHistoryTitle">
                              {isSubmission ? (
                                <strong>Application Submitted</strong>
                              ) : (
                                <span className="apHistoryTransition">
                                  <ApplicationStatusChip status={entry.from} />
                                  <span className="apHistoryArrow" aria-hidden="true">→</span>
                                  <ApplicationStatusChip status={entry.to} />
                                </span>
                              )}
                            </div>
                            <div className="apHistoryMeta">
                              <span>{formatDateTime(entry.changedAt)}</span>
                              {entry.changedBy && <span>· {entry.changedBy}</span>}
                              {entry.madeByStaff === true && <Chip tone="info">Staff action</Chip>}
                              {entry.madeByStaff === false && <Chip tone="neutral">Candidate action</Chip>}
                            </div>
                            {entry.notes && <p className="apHistoryNote">{entry.notes}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}

            {tab === "interviews" && (
              <div style={{ marginTop: 16 }}>
                {interviews.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="No interviews"
                    message="No interview rounds have been scheduled for this application."
                  />
                ) : (
                  <div className="cmTableWrap">
                    <table className="cmTable" style={{ minWidth: 820 }}>
                      <thead>
                        <tr>
                          <th>Round</th>
                          <th>Scheduled</th>
                          <th>Duration</th>
                          <th>Mode</th>
                          <th>Venue / link</th>
                          <th>Interviewer</th>
                          <th>Result</th>
                          <th>Rating</th>
                          <th>Feedback</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {interviews.map((item) => (
                          <tr key={item.id}>
                            <td><span className="cmCode">Round {item.roundNumber || "—"}</span></td>
                            <td className="cmMuted">{formatDateTime(item.scheduledAt)}</td>
                            <td className="cmMuted">
                              {item.durationMinutes ? `${item.durationMinutes} min` : "—"}
                            </td>
                            <td><ModeChip mode={item.mode} /></td>
                            <td className="cmMuted cmCellWrap">{item.venueOrLink || "—"}</td>
                            <td>{item.interviewerName || "—"}</td>
                            <td><ResultChip result={item.result} /></td>
                            <td><RatingValue rating={item.rating} /></td>
                            <td className="cmMuted cmCellWrap">{item.feedback || "—"}</td>
                            <td>
                              {item.upcoming ? <Chip tone="info">Upcoming</Chip> : <FeedbackChip interview={item} />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="cmHint" style={{ marginTop: 10 }}>
                  Interview rounds are scheduled from the Interview management module — this panel is read-only.
                </p>
              </div>
            )}
          </>
        )}
      </Drawer>

      {statusTarget && (
        <ChangeApplicationStatusModal
          application={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={(updated, status) => {
            setStatusTarget(null);
            refresh();
            if (onChanged) onChanged(`Application status changed to ${applicationStatusLabel(status)}.`);
          }}
        />
      )}

      {assignTarget && (
        <AssignRecruiterModal
          application={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={(updated, userId) => {
            setAssignTarget(null);
            refresh();
            if (onChanged) {
              onChanged(userId == null ? "Recruiter unassigned." : "Recruiter assigned.");
            }
          }}
        />
      )}
    </>
  );
}

export { statusMeta, UserPlus };
