"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  AdminApiError,
  FINAL_INTERVIEW_RESULTS,
  INTERVIEW_MODES,
  cancelInterview,
  getApplication,
  getInterview,
  interviewModeLabel,
  interviewResultLabel,
  listApplicationInterviews,
  listEligibleInterviewers,
  recordInterviewResult,
  scheduleInterview,
  updateInterview,
} from "../../lib/adminApi";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  Notice,
  Switch,
  formatDateTime,
} from "./admin-ui";

const RESULT_TONE = { PENDING: "info", PASS: "success", FAIL: "danger", NO_SHOW: "warn" };

export function ResultChip({ result }) {
  return <Chip tone={RESULT_TONE[result] || "neutral"}>{interviewResultLabel(result)}</Chip>;
}

export function ModeChip({ mode }) {
  return <Chip tone="neutral">{interviewModeLabel(mode)}</Chip>;
}

export function FeedbackChip({ interview }) {
  if (!interview) return <span className="cmMuted">—</span>;
  if (interview.result && interview.result !== "PENDING") return <Chip tone="success">Recorded</Chip>;
  if (interview.awaitingFeedback) return <Chip tone="warn">Awaiting</Chip>;
  if (interview.upcoming) return <Chip tone="info">Scheduled</Chip>;
  return <Chip tone="neutral">Pending</Chip>;
}

export function RatingValue({ rating }) {
  const value = Number(rating);
  if (!Number.isFinite(value) || value <= 0) return <span className="cmMuted">—</span>;
  return <span className="ivRating">{value} <small>/ 5</small></span>;
}

function DetailRow({ label, children, full = false }) {
  return (
    <div className={`cmDetailRow${full ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{children}</span>
    </div>
  );
}

function isHttpLink(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function VenueValue({ value }) {
  if (!value) return <span className="cmMuted">—</span>;
  if (isHttpLink(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="ivVenueLink">
        {value} <ExternalLink size={12} />
      </a>
    );
  }
  return <span>{value}</span>;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function modeVenueLabel(mode) {
  if (mode === "VIDEO") return "Meeting link";
  if (mode === "PHONE") return "Joining details (optional)";
  return "Venue / address";
}

function modeVenuePlaceholder(mode) {
  if (mode === "VIDEO") return "https://meet.example.com/abc-xyz";
  if (mode === "PHONE") return "Optional call details";
  return "e.g. Office 4, MIDC Bhosari, Pune";
}

/* ------------------------------------------------------------------ */
/* Schedule / reschedule form                                          */
/* ------------------------------------------------------------------ */

export function InterviewFormModal({
  mode = "create",
  interview = null,
  applicationId = null,
  applicationLabel = "",
  lockApplication = false,
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => ({
    applicationId: isEdit ? String(interview?.applicationId ?? "") : String(applicationId ?? ""),
    scheduledAt: isEdit ? toLocalInputValue(interview?.scheduledAt) : "",
    durationMinutes: isEdit ? String(interview?.durationMinutes ?? 30) : "30",
    mode: isEdit ? interview?.mode || "IN_PERSON" : "IN_PERSON",
    venueOrLink: isEdit ? interview?.venueOrLink || "" : "",
    interviewerUserId:
      isEdit && interview?.interviewerUserId != null ? String(interview.interviewerUserId) : "",
    roundNumber: isEdit && interview?.roundNumber != null ? String(interview.roundNumber) : "",
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [interviewers, setInterviewers] = useState([]);
  const [interviewersError, setInterviewersError] = useState("");
  const [appCheck, setAppCheck] = useState({ loading: false, data: null, error: "" });
  const appSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listEligibleInterviewers();
        if (!cancelled) setInterviewers(list);
      } catch (error) {
        if (!cancelled) {
          setInterviewersError(
            error instanceof Error ? error.message : "Interviewers could not be loaded.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isEdit) return undefined;
    const id = Number(values.applicationId);
    if (!Number.isInteger(id) || id <= 0) {
      setAppCheck({ loading: false, data: null, error: "" });
      return undefined;
    }
    const current = ++appSeq.current;
    setAppCheck((state) => ({ ...state, loading: true, error: "" }));
    const timer = setTimeout(async () => {
      try {
        const application = await getApplication(id);
        if (appSeq.current !== current) return;
        setAppCheck({ loading: false, data: application, error: "" });
      } catch (error) {
        if (appSeq.current !== current) return;
        setAppCheck({
          loading: false,
          data: null,
          error: error instanceof Error ? error.message : "The application could not be found.",
        });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [isEdit, values.applicationId]);

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function validate() {
    const next = {};
    const id = Number(values.applicationId);
    if (!Number.isInteger(id) || id <= 0) next.applicationId = "Enter a valid application ID.";

    if (!values.scheduledAt) next.scheduledAt = "Scheduled date and time is required.";
    else {
      const when = new Date(values.scheduledAt);
      if (Number.isNaN(when.getTime())) next.scheduledAt = "Enter a valid date and time.";
      else if (when.getTime() < Date.now()) next.scheduledAt = "The interview must be scheduled in the future.";
    }

    const duration = Number(values.durationMinutes);
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
      next.durationMinutes = "Duration must be a whole number between 5 and 480 minutes.";
    }

    if (!["IN_PERSON", "VIDEO", "PHONE"].includes(values.mode)) {
      next.mode = "Choose an interview mode.";
    }

    const venue = values.venueOrLink.trim();
    if ((values.mode === "IN_PERSON" || values.mode === "VIDEO") && !venue) {
      next.venueOrLink =
        values.mode === "IN_PERSON"
          ? "A venue or address is required for in-person interviews."
          : "A meeting link is required for video interviews.";
    } else if (venue.length > 400) {
      next.venueOrLink = "Keep this under 400 characters.";
    }

    if (interviewers.length > 0 && !values.interviewerUserId) {
      next.interviewerUserId = "Choose the interviewer.";
    }

    if (values.roundNumber !== "") {
      const round = Number(values.roundNumber);
      if (!Number.isInteger(round) || round < 1 || round > 20) {
        next.roundNumber = "Round number must be between 1 and 20.";
      }
    }

    return next;
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    const validation = validate();
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }

    const id = Number(values.applicationId);
    const payload = {
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      durationMinutes: Number(values.durationMinutes),
      mode: values.mode,
      interviewerUserId: values.interviewerUserId ? Number(values.interviewerUserId) : undefined,
      roundNumber: values.roundNumber === "" ? undefined : Number(values.roundNumber),
    };
    const venue = values.venueOrLink.trim();
    if (venue) payload.venueOrLink = venue;

    setSaving(true);
    try {
      if (!isEdit) {
        try {
          await getApplication(id);
        } catch (error) {
          setErrors((current) => ({
            ...current,
            applicationId:
              error instanceof Error ? error.message : "The application could not be found.",
          }));
          setSaving(false);
          return;
        }
      }
      const saved = isEdit
        ? await updateInterview(interview.id, payload)
        : await scheduleInterview(id, payload);
      onSaved(saved, isEdit);
    } catch (error) {
      if (error instanceof AdminApiError) {
        if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("The interview could not be saved. Please try again.");
      }
      setSaving(false);
    }
  }

  const showVenue = values.mode !== "PHONE";

  return (
    <Modal
      wide
      title={isEdit ? "Reschedule interview" : "Schedule interview"}
      description={
        isEdit
          ? "Update the slot, panel or round. An interview with a recorded result cannot be rescheduled."
          : "Book a round against an application. The backend moves the application to INTERVIEW_SCHEDULED automatically."
      }
      onClose={onClose}
    >
      <form className="cmForm" onSubmit={submit} noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        {interviewersError && (
          <div style={{ marginTop: formError ? 12 : 0 }}>
            <Notice tone="warn">
              {interviewersError} You can still schedule without selecting an interviewer.
            </Notice>
          </div>
        )}

        <div className="cmFormGrid" style={{ marginTop: formError || interviewersError ? 16 : 0 }}>
          <Field
            label="Application ID"
            htmlFor="iv-application"
            required
            error={errors.applicationId}
            hint={
              isEdit || lockApplication
                ? "The application for this interview round."
                : "The candidate's existing application — a new one is never created."
            }
          >
            <input
              id="iv-application"
              inputMode="numeric"
              value={values.applicationId}
              placeholder="e.g. 1024"
              onChange={(event) => setField("applicationId", event.target.value.replace(/[^\d]/g, ""))}
              disabled={saving || isEdit || lockApplication}
              readOnly={isEdit || lockApplication}
            />
          </Field>

          {!isEdit && appCheck.loading && <LoadingState label="Checking application…" />}
          {!isEdit && !appCheck.loading && appCheck.data && (
            <Notice tone="info">
              {appCheck.data.candidateName || "Candidate"} · {appCheck.data.jobTitle || `Job #${appCheck.data.jobId}`}
              {appCheck.data.status ? ` · ${appCheck.data.status}` : ""}
            </Notice>
          )}

          <div className="cmFormRow">
            <Field label="Scheduled date and time" htmlFor="iv-scheduled" required error={errors.scheduledAt}>
              <input
                id="iv-scheduled"
                type="datetime-local"
                value={values.scheduledAt}
                onChange={(event) => setField("scheduledAt", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Duration (minutes)" htmlFor="iv-duration" required error={errors.durationMinutes}>
              <input
                id="iv-duration"
                type="number"
                min={5}
                max={480}
                step={5}
                value={values.durationMinutes}
                placeholder="30"
                onChange={(event) => setField("durationMinutes", event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <div className="cmFormRow">
            <Field label="Interview mode" htmlFor="iv-mode" required error={errors.mode}>
              <select
                id="iv-mode"
                value={values.mode}
                onChange={(event) => setField("mode", event.target.value)}
                disabled={saving}
              >
                {INTERVIEW_MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={modeVenueLabel(values.mode)}
              htmlFor="iv-venue"
              required={showVenue}
              error={errors.venueOrLink}
              hint={values.mode === "PHONE" ? "Optional for phone interviews." : undefined}
            >
              <input
                id="iv-venue"
                value={values.venueOrLink}
                maxLength={400}
                placeholder={modeVenuePlaceholder(values.mode)}
                onChange={(event) => setField("venueOrLink", event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <div className="cmFormRow">
            <Field
              label="Interviewer"
              htmlFor="iv-interviewer"
              required={interviewers.length > 0}
              error={errors.interviewerUserId}
              hint={lockApplication ? undefined : "Staff who will conduct this round."}
            >
              <select
                id="iv-interviewer"
                value={values.interviewerUserId}
                onChange={(event) => setField("interviewerUserId", event.target.value)}
                disabled={saving}
              >
                <option value="">Not assigned</option>
                {interviewers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName || person.email || `User #${person.id}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Round number"
              htmlFor="iv-round"
              error={errors.roundNumber}
              hint="Leave blank to append the next round automatically."
            >
              <input
                id="iv-round"
                type="number"
                min={1}
                max={20}
                step={1}
                value={values.roundNumber}
                placeholder="Auto"
                onChange={(event) => setField("roundNumber", event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>
        </div>

        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={15} className="spin" /> Saving…
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Schedule interview"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Interview detail                                                    */
/* ------------------------------------------------------------------ */

export function InterviewDetailModal({
  interviewId,
  canManage = false,
  onClose,
  onReschedule,
  onRecord,
  onCancel,
  onNavigateApplication,
}) {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const current = ++seq.current;
    (async () => {
      try {
        const data = await getInterview(interviewId);
        if (!cancelled && seq.current === current) {
          setInterview(data);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled && seq.current === current) {
          setLoadError(error instanceof Error ? error.message : "The interview could not be loaded.");
        }
      } finally {
        if (!cancelled && seq.current === current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const canReschedule = Boolean(interview && interview.result === "PENDING");
  const canRecord = Boolean(interview && interview.result === "PENDING" && !interview.upcoming);

  return (
    <Modal
      wide
      title={interview ? `Interview #${interview.id}` : "Interview"}
      description={interview ? `${interview.candidateName || "Candidate"} · ${interview.jobTitle || `Job #${interview.jobId}`}` : undefined}
      onClose={onClose}
    >
      {loading ? (
        <LoadingState label="Loading interview…" />
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : interview ? (
        <>
          <div className="cmStatusRow">
            <ResultChip result={interview.result} />
            <ModeChip mode={interview.mode} />
            {interview.upcoming ? <Chip tone="info">Upcoming</Chip> : <Chip tone="neutral">Past slot</Chip>}
            {interview.awaitingFeedback ? (
              <Chip tone="warn">Awaiting feedback</Chip>
            ) : interview.result !== "PENDING" ? (
              <Chip tone="success">Feedback recorded</Chip>
            ) : null}
          </div>

          <div className="cmDetailGrid" style={{ marginTop: 18 }}>
            <DetailRow label="Candidate">{interview.candidateName || "—"}</DetailRow>
            <DetailRow label="Application ID">
              {onNavigateApplication ? (
                <button type="button" className="cmLinkButton" onClick={() => onNavigateApplication(interview.applicationId)}>
                  #{interview.applicationId}
                </button>
              ) : (
                `#${interview.applicationId}`
              )}
            </DetailRow>
            <DetailRow label="Job title">{interview.jobTitle || "—"}</DetailRow>
            <DetailRow label="Interview round">
              {interview.roundNumber ? `Round ${interview.roundNumber}` : "—"}
            </DetailRow>
            <DetailRow label="Scheduled date and time">{formatDateTime(interview.scheduledAt)}</DetailRow>
            <DetailRow label="Duration">
              {interview.durationMinutes ? `${interview.durationMinutes} minutes` : "—"}
            </DetailRow>
            <DetailRow label="Interview mode">{interviewModeLabel(interview.mode)}</DetailRow>
            <DetailRow label={interview.mode === "VIDEO" ? "Meeting link" : "Venue"}>
              <VenueValue value={interview.venueOrLink} />
            </DetailRow>
            <DetailRow label="Interviewer ID">
              {interview.interviewerUserId == null ? "—" : `#${interview.interviewerUserId}`}
            </DetailRow>
            <DetailRow label="Interviewer">{interview.interviewerName || "—"}</DetailRow>
            <DetailRow label="Result">{interviewResultLabel(interview.result)}</DetailRow>
            <DetailRow label="Rating"><RatingValue rating={interview.rating} /></DetailRow>
            <DetailRow label="Upcoming status">{interview.upcoming ? "Yes" : "No"}</DetailRow>
            <DetailRow label="Awaiting feedback">{interview.awaitingFeedback ? "Yes" : "No"}</DetailRow>
          </div>

          <div className="cmDetailSection">
            <h3>Panel feedback</h3>
            {interview.feedback ? (
              <p className="cmDetailMessage">{interview.feedback}</p>
            ) : (
              <p className="cmHint">No feedback has been recorded for this interview.</p>
            )}
            <p className="cmHint" style={{ marginTop: 8 }}>
              Feedback is staff-only and is never shown to the candidate.
            </p>
          </div>

          {canManage && (canReschedule || canRecord) && (
            <div className="cmDetailSection">
              <h3>Actions</h3>
              <div className="cmStatusRow">
                {canReschedule && (
                  <button type="button" className="secondaryButton cmBtn" onClick={() => onReschedule(interview)}>
                    <Pencil size={15} /> Reschedule
                  </button>
                )}
                {canRecord && (
                  <button type="button" className="primaryButton cmBtn" onClick={() => onRecord(interview)}>
                    <CheckCircle2 size={15} /> Record result
                  </button>
                )}
                {canReschedule && (
                  <button type="button" className="cmDangerButton cmBtn" onClick={() => onCancel(interview)}>
                    <Trash2 size={15} /> Cancel interview
                  </button>
                )}
              </div>
            </div>
          )}
          {canManage && interview.result !== "PENDING" && (
            <Notice tone="info">
              This interview already has a recorded result. Rescheduling and cancellation are disabled — schedule a new
              round instead.
            </Notice>
          )}
        </>
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Record result                                                       */
/* ------------------------------------------------------------------ */

export function RecordResultModal({ interview, onClose, onSaved }) {
  const [values, setValues] = useState({ result: "PASS", rating: "", feedback: "", advanceApplication: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function setField(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "result" && value !== "PASS") next.advanceApplication = false;
      return next;
    });
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function validate() {
    const next = {};
    if (!FINAL_INTERVIEW_RESULTS.includes(values.result)) {
      next.result = "Choose a final outcome: Passed, Failed or No show.";
    }
    if (values.rating !== "") {
      const rating = Number(values.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        next.rating = "Rating must be between 1 and 5.";
      }
    }
    if (values.feedback.length > 2000) next.feedback = "Feedback must be 2,000 characters or fewer.";
    return next;
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    const validation = validate();
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }

    const payload = {
      result: values.result,
      advanceApplication: Boolean(values.advanceApplication),
    };
    if (values.rating !== "") payload.rating = Number(values.rating);
    if (values.feedback.trim()) payload.feedback = values.feedback.trim();

    setSaving(true);
    try {
      const saved = await recordInterviewResult(interview.id, payload);
      onSaved(saved);
    } catch (error) {
      if (error instanceof AdminApiError) {
        if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("The result could not be recorded. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Record interview result"
      description={`${interview.candidateName || "Candidate"} · ${interview.jobTitle || `Job #${interview.jobId}`} · Round ${interview.roundNumber || "—"}`}
      onClose={onClose}
    >
      <form className="cmForm" onSubmit={submit} noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Notice tone="warn">
          A recorded outcome is final and cannot be changed. A FAIL or No show does not reject the application on its own.
        </Notice>

        <div className="cmFormGrid" style={{ marginTop: 16 }}>
          <div className="cmFormRow">
            <Field label="Final outcome" htmlFor="rr-result" required error={errors.result}>
              <select
                id="rr-result"
                value={values.result}
                onChange={(event) => setField("result", event.target.value)}
                disabled={saving}
              >
                <option value="PASS">Passed</option>
                <option value="FAIL">Failed</option>
                <option value="NO_SHOW">No show</option>
              </select>
            </Field>
            <Field label="Rating" htmlFor="rr-rating" error={errors.rating} hint="Optional, 1 is poor and 5 is excellent.">
              <select
                id="rr-rating"
                value={values.rating}
                onChange={(event) => setField("rating", event.target.value)}
                disabled={saving}
              >
                <option value="">Not rated</option>
                <option value="1">1 — Poor</option>
                <option value="2">2 — Below average</option>
                <option value="3">3 — Average</option>
                <option value="4">4 — Good</option>
                <option value="5">5 — Excellent</option>
              </select>
            </Field>
          </div>

          <Field label="Feedback" htmlFor="rr-feedback" error={errors.feedback}>
            <textarea
              id="rr-feedback"
              rows={4}
              maxLength={2000}
              value={values.feedback}
              placeholder="The panel's write-up. Staff only — never shown to the candidate."
              onChange={(event) => setField("feedback", event.target.value)}
              disabled={saving}
            />
          </Field>

          <Field error={errors.advanceApplication}>
            <span className="cmSwitchRow">
              <Switch
                id="rr-advance"
                checked={values.advanceApplication && values.result === "PASS"}
                onChange={(next) => setField("advanceApplication", next)}
                disabled={saving || values.result !== "PASS"}
                label="Advance this application to SELECTED (only applies to a PASS result)."
              />
            </span>
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
              "Record result"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Cancel confirmation                                                 */
/* ------------------------------------------------------------------ */

export function CancelInterviewDialog({ interview, busy = false, onConfirm, onCancel }) {
  return (
    <ConfirmDialog
      title="Cancel interview"
      message="This cancels the scheduled slot. Interviews with a recorded result cannot be cancelled."
      confirmLabel="Cancel interview"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="cmDetailGrid">
        <DetailRow label="Candidate">{interview.candidateName || `Application #${interview.applicationId}`}</DetailRow>
        <DetailRow label="Round">{interview.roundNumber ? `Round ${interview.roundNumber}` : "—"}</DetailRow>
        <DetailRow label="Scheduled" full>{formatDateTime(interview.scheduledAt)}</DetailRow>
      </div>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Application interview history                                       */
/* ------------------------------------------------------------------ */

export function ApplicationInterviewsModal({ applicationId, application = null, canManage = false, onClose, onChanged }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, setFlash] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [recordTarget, setRecordTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const seq = useRef(0);

  function load() {
    const current = ++seq.current;
    setLoading(true);
    setLoadError("");
    return listApplicationInterviews(applicationId)
      .then((list) => {
        if (seq.current !== current) return;
        const sorted = [...list].sort((a, b) => {
          const roundDelta = (a.roundNumber || 0) - (b.roundNumber || 0);
          if (roundDelta !== 0) return roundDelta;
          return Date.parse(a.scheduledAt || 0) - Date.parse(b.scheduledAt || 0);
        });
        setInterviews(sorted);
      })
      .catch((error) => {
        if (seq.current === current) {
          setLoadError(error instanceof Error ? error.message : "Interview history could not be loaded.");
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

  function refresh(message) {
    if (message) setFlash({ tone: "success", message });
    load();
    if (onChanged) onChanged();
  }

  async function runCancel() {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true);
    try {
      await cancelInterview(cancelTarget.id);
      setCancelTarget(null);
      refresh("Interview cancelled.");
    } catch (error) {
      setFlash({ tone: "error", message: error instanceof Error ? error.message : "The interview could not be cancelled." });
      setCancelTarget(null);
    } finally {
      setCancelBusy(false);
    }
  }

  const title = application
    ? `${application.candidateName || "Application"} · ${application.jobTitle || `Job #${application.jobId}`}`
    : `Application #${applicationId}`;

  return (
    <Modal wide title="Interview history" description={title} onClose={onClose}>
      {flash && (
        <p className={flash.tone === "error" ? "actionError" : "actionSuccess"} role="status">
          {flash.message}
        </p>
      )}

      <div className="cmToolbar" style={{ marginTop: flash ? 14 : 0 }}>
        <span className="cmCount">
          Application #{applicationId} · {interviews.length} round{interviews.length === 1 ? "" : "s"}
        </span>
        <div className="cmToolbarControls">
          <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => load()} disabled={loading}>
            Refresh
          </button>
          {canManage && (
            <button type="button" className="primaryButton cmBtn" onClick={() => setScheduleOpen(true)}>
              <Plus size={16} /> Schedule round
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading interview rounds…" />
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : interviews.length === 0 ? (
        <EmptyState
          title="No interviews scheduled"
          message="This application has no interview rounds yet. Schedule the first round to get started."
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Round</th>
                <th>Scheduled</th>
                <th>Interviewer</th>
                <th>Mode</th>
                <th>Result</th>
                <th>Rating</th>
                <th>Feedback</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((item) => (
                <tr key={item.id}>
                  <td><span className="cmCode">Round {item.roundNumber || "—"}</span></td>
                  <td className="cmMuted">{formatDateTime(item.scheduledAt)}</td>
                  <td>{item.interviewerName || "—"}</td>
                  <td><ModeChip mode={item.mode} /></td>
                  <td><ResultChip result={item.result} /></td>
                  <td><RatingValue rating={item.rating} /></td>
                  <td className="cmMuted cmCellWrap">{item.feedback || "—"}</td>
                  <td className="cmColActions">
                    <div className="cmRowActions">
                      <button
                        type="button"
                        className="cmLinkButton"
                        onClick={() => setDetailId(item.id)}
                      >
                        View
                      </button>
                      {canManage && item.result === "PENDING" && (
                        <>
                          <button type="button" className="cmLinkButton" onClick={() => setEditTarget(item)}>
                            Reschedule
                          </button>
                          {!item.upcoming && (
                            <button type="button" className="cmLinkButton" onClick={() => setRecordTarget(item)}>
                              Record
                            </button>
                          )}
                          <button
                            type="button"
                            className="cmLinkButton"
                            onClick={() => setCancelTarget(item)}
                          >
                            Cancel
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
      )}

      <div className="cmModalFooter">
        <button type="button" className="secondaryButton cmBtn" onClick={onClose}>
          Close
        </button>
      </div>

      {scheduleOpen && (
        <InterviewFormModal
          mode="create"
          applicationId={applicationId}
          lockApplication
          onClose={() => setScheduleOpen(false)}
          onSaved={() => {
            setScheduleOpen(false);
            refresh("Interview round scheduled.");
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
            refresh("Interview rescheduled.");
          }}
        />
      )}

      {detailId && (
        <InterviewDetailModal
          interviewId={detailId}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onReschedule={(item) => { setDetailId(null); setEditTarget(item); }}
          onRecord={(item) => { setDetailId(null); setRecordTarget(item); }}
          onCancel={(item) => { setDetailId(null); setCancelTarget(item); }}
        />
      )}

      {recordTarget && (
        <RecordResultModal
          interview={recordTarget}
          onClose={() => setRecordTarget(null)}
          onSaved={() => {
            setRecordTarget(null);
            refresh("Interview result recorded.");
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
    </Modal>
  );
}
