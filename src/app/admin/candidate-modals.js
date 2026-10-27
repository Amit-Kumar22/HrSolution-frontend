"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  AdminApiError,
  CANDIDATE_SOURCES,
  candidateSourceLabel,
  createCandidate,
  fetchDocumentBlob,
  getCandidate,
  listApplications,
  updateCandidate,
  uploadCandidateResume,
  validateResumeFile,
} from "../../lib/adminApi";
import {
  Chip,
  EmptyState,
  Field,
  Drawer,
  LoadingState,
  Modal,
  Notice,
  Switch,
  formatDate,
  formatDateTime,
} from "./admin-ui";
import { ApplicationInterviewsModal } from "./interview-modals";

const PHONE_PATTERN = /^[6-9][0-9]{9}$/;
const MAX_EXPERIENCE_MONTHS = 720;

const APPLICATION_STATUS_META = {
  APPLIED: { label: "Applied", tone: "info" },
  SCREENING: { label: "Screening", tone: "info" },
  SHORTLISTED: { label: "Shortlisted", tone: "accent" },
  INTERVIEW_SCHEDULED: { label: "Interview scheduled", tone: "accent" },
  SELECTED: { label: "Selected", tone: "success" },
  OFFERED: { label: "Offered", tone: "success" },
  JOINED: { label: "Joined", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  ON_HOLD: { label: "Kept on file", tone: "warn" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

function ApplicationStatusChip({ status }) {
  const meta = APPLICATION_STATUS_META[status] || { label: status || "—", tone: "neutral" };
  return <Chip tone={meta.tone}>{meta.label}</Chip>;
}

function emptyForm(candidate) {
  return {
    fullName: candidate.fullName || "",
    email: candidate.email || "",
    phone: candidate.phone || "",
    city: candidate.city || "",
    state: candidate.state || "",
    totalExperienceMonths:
      candidate.totalExperienceMonths === 0 || candidate.totalExperienceMonths
        ? String(candidate.totalExperienceMonths)
        : "",
    highestQualification: candidate.highestQualification || "",
    preferredCategoryId:
      candidate.preferredCategoryId === null || candidate.preferredCategoryId === undefined
        ? ""
        : String(candidate.preferredCategoryId),
    source: candidate.source || "WALK_IN",
    consentGiven: Boolean(candidate.consentGiven),
    notes: candidate.notes || "",
  };
}

export function CandidateFormModal({ mode, candidateId, categories, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [values, setValues] = useState(() => emptyForm({ source: "WALK_IN" }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!isEdit || !candidateId) return undefined;
    let cancelled = false;
    const current = ++seq.current;
    (async () => {
      try {
        const candidate = await getCandidate(candidateId);
        if (cancelled || seq.current !== current) return;
        setValues(emptyForm(candidate));
      } catch (error) {
        if (!cancelled && seq.current === current) {
          setLoadError(error instanceof Error ? error.message : "The candidate could not be loaded.");
        }
      } finally {
        if (!cancelled && seq.current === current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      seq.current += 1;
    };
  }, [isEdit, candidateId]);

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
    const fullName = values.fullName.trim();
    if (!fullName) next.fullName = "Full name is required.";
    else if (fullName.length > 160) next.fullName = "Full name must be 160 characters or fewer.";

    const email = values.email.trim();
    if (!email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    else if (email.length > 180) next.email = "Email must be 180 characters or fewer.";

    const phone = values.phone.trim();
    if (phone && !PHONE_PATTERN.test(phone)) {
      next.phone = "Enter a 10-digit mobile number starting with 6-9, or leave it blank.";
    }

    if (values.totalExperienceMonths !== "") {
      const months = Number(values.totalExperienceMonths);
      if (!Number.isInteger(months) || months < 0 || months > MAX_EXPERIENCE_MONTHS) {
        next.totalExperienceMonths = `Enter whole months between 0 and ${MAX_EXPERIENCE_MONTHS}.`;
      }
    }

    if (values.notes.length > 2000) next.notes = "Notes must be 2,000 characters or fewer.";

    if (!values.consentGiven) next.consentGiven = "Consent must be confirmed before saving.";

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
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      city: values.city.trim() || undefined,
      state: values.state.trim() || undefined,
      totalExperienceMonths: values.totalExperienceMonths === "" ? 0 : Number(values.totalExperienceMonths),
      highestQualification: values.highestQualification.trim() || undefined,
      preferredCategoryId: values.preferredCategoryId === "" ? undefined : Number(values.preferredCategoryId),
      source: values.source,
      consentGiven: true,
      notes: values.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      const saved = isEdit ? await updateCandidate(candidateId, payload) : await createCandidate(payload);
      onSaved(saved, isEdit);
    } catch (error) {
      if (error instanceof AdminApiError) {
        if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("The candidate could not be saved. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit candidate${values.fullName ? ` — ${values.fullName}` : ""}` : "Add candidate"}
      description={
        isEdit
          ? "Update the candidate's details. The email identifies the candidate and cannot be changed."
          : "Manually add a walk-in, agency or referral candidate. Consent must be confirmed before saving."
      }
      onClose={onClose}
    >
      {loading ? (
        <LoadingState label="Loading candidate…" />
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : (
        <form className="cmForm" onSubmit={submit} noValidate>
          {formError && <Notice tone="error">{formError}</Notice>}

          <div className="cmFormGrid" style={{ marginTop: formError ? 16 : 0 }}>
            <Field label="Full name" htmlFor="cand-full-name" required error={errors.fullName}>
              <input
                id="cand-full-name"
                value={values.fullName}
                maxLength={160}
                placeholder="e.g. Rakesh Shinde"
                onChange={(event) => setField("fullName", event.target.value)}
                disabled={saving}
              />
            </Field>

            <div className="cmFormRow">
              <Field
                label="Email"
                htmlFor="cand-email"
                required
                error={errors.email}
                hint={isEdit ? "Locked — identifies the candidate across applications." : undefined}
              >
                <input
                  id="cand-email"
                  type="email"
                  value={values.email}
                  maxLength={180}
                  placeholder="name@example.com"
                  onChange={(event) => setField("email", event.target.value)}
                  disabled={saving || isEdit}
                  readOnly={isEdit}
                />
              </Field>
              <Field label="Phone number" htmlFor="cand-phone" error={errors.phone}>
                <input
                  id="cand-phone"
                  value={values.phone}
                  maxLength={10}
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  onChange={(event) => setField("phone", event.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="cmFormRow">
              <Field label="City" htmlFor="cand-city" error={errors.city}>
                <input
                  id="cand-city"
                  value={values.city}
                  maxLength={100}
                  placeholder="e.g. Pune"
                  onChange={(event) => setField("city", event.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="State" htmlFor="cand-state" error={errors.state}>
                <input
                  id="cand-state"
                  value={values.state}
                  maxLength={100}
                  placeholder="e.g. Maharashtra"
                  onChange={(event) => setField("state", event.target.value)}
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="cmFormRow">
              <Field label="Total experience (months)" htmlFor="cand-exp" error={errors.totalExperienceMonths}>
                <input
                  id="cand-exp"
                  type="number"
                  min={0}
                  max={MAX_EXPERIENCE_MONTHS}
                  step={1}
                  value={values.totalExperienceMonths}
                  placeholder="0 = fresher"
                  onChange={(event) => setField("totalExperienceMonths", event.target.value)}
                  disabled={saving}
                />
              </Field>
              <Field label="Highest qualification" htmlFor="cand-qual" error={errors.highestQualification}>
                <input
                  id="cand-qual"
                  value={values.highestQualification}
                  maxLength={120}
                  placeholder="e.g. ITI Electrician"
                  onChange={(event) => setField("highestQualification", event.target.value)}
                  disabled={saving}
                />
              </Field>
            </div>

            <div className="cmFormRow">
              <Field label="Preferred job category" htmlFor="cand-category" error={errors.preferredCategoryId}>
                <select
                  id="cand-category"
                  value={values.preferredCategoryId}
                  onChange={(event) => setField("preferredCategoryId", event.target.value)}
                  disabled={saving}
                >
                  <option value="">Not specified</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Candidate source"
                htmlFor="cand-source"
                error={errors.source}
                hint="Defaults to Walk-in when left unset."
              >
                <select
                  id="cand-source"
                  value={values.source}
                  onChange={(event) => setField("source", event.target.value)}
                  disabled={saving}
                >
                  {CANDIDATE_SOURCES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Internal notes" htmlFor="cand-notes" error={errors.notes}>
              <textarea
                id="cand-notes"
                rows={3}
                maxLength={2000}
                value={values.notes}
                placeholder="Visible to staff only. Never shown to the candidate."
                onChange={(event) => setField("notes", event.target.value)}
                disabled={saving}
              />
            </Field>

            <Field error={errors.consentGiven}>
              <span className="cmSwitchRow">
                <Switch
                  id="cand-consent"
                  checked={values.consentGiven}
                  onChange={(next) => setField("consentGiven", next)}
                  disabled={saving}
                  label="The candidate has given consent to hold and process their details (DPDP Act)."
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
                  <Loader2 size={15} className="spin" /> Saving…
                </>
              ) : isEdit ? (
                "Save candidate"
              ) : (
                "Add candidate"
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function DetailRow({ label, children, full = false }) {
  return (
    <div className={`cmDetailRow${full ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{children}</span>
    </div>
  );
}

export function CandidateDetailModal({
  candidateId,
  canManage,
  canDelete,
  canSpam,
  canViewNotes,
  onClose,
  onEdit,
  onRequestDelete,
  onRequestSpam,
  onChanged,
}) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState("");
  const [interviewApp, setInterviewApp] = useState(null);

  const [resumeError, setResumeError] = useState("");
  const [resumeNotice, setResumeNotice] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const fileRef = useRef(null);
  const seq = useRef(0);

  function loadCandidate() {
    const current = ++seq.current;
    setLoading(true);
    setLoadError("");
    return getCandidate(candidateId)
      .then((data) => {
        if (seq.current !== current) return;
        setCandidate(data);
      })
      .catch((error) => {
        if (seq.current === current) {
          setLoadError(error instanceof Error ? error.message : "The candidate could not be loaded.");
        }
      })
      .finally(() => {
        if (seq.current === current) setLoading(false);
      });
  }

  function loadApplications() {
    setAppsLoading(true);
    setAppsError("");
    return listApplications({ candidateId, size: 20 })
      .then((page) => setApplications(Array.isArray(page.content) ? page.content : []))
      .catch((error) => {
        setAppsError(error instanceof Error ? error.message : "Applications could not be loaded.");
      })
      .finally(() => setAppsLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadCandidate();
      if (cancelled) return;
      await loadApplications();
    })();
    return () => {
      cancelled = true;
      seq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  async function handleResumeChange(event) {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setResumeError("");
    setResumeNotice("");
    const validationError = validateResumeFile(file);
    if (validationError) {
      setResumeError(validationError);
      return;
    }
    setResumeBusy(true);
    try {
      const updated = await uploadCandidateResume(candidateId, file);
      setCandidate(updated);
      setResumeNotice(`Resume uploaded: ${updated.resumeFileName || file.name}`);
      onChanged();
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : "The resume could not be uploaded.");
    } finally {
      setResumeBusy(false);
    }
  }

  async function openResume(mode) {
    if (!candidate || !candidate.resumeDocumentId) return;
    setResumeError("");
    const win = mode === "view" ? window.open("", "_blank") : null;
    setResumeBusy(true);
    try {
      const { blob, filename } = await fetchDocumentBlob(candidate.resumeDocumentId);
      const url = URL.createObjectURL(blob);
      if (mode === "view" && win) {
        win.location.href = url;
      } else if (mode === "view") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename || candidate.resumeFileName || `candidate-${candidate.id}-resume.pdf`;
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

  const hasResume = Boolean(candidate && candidate.resumeDocumentId);

  return (
    <Drawer
      size="lg"
      title={candidate ? candidate.fullName || `Candidate #${candidate.id}` : "Candidate"}
      description={candidate ? `Candidate #${candidate.id}` : undefined}
      onClose={onClose}
      footer={
        candidate ? (
          <>
            {canDelete && (
              <button
                type="button"
                className="cmDangerButton cmBtn"
                onClick={() => onRequestDelete(candidate)}
                disabled={resumeBusy}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
            <button type="button" className="secondaryButton cmBtn" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <button type="button" className="secondaryButton cmBtn" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {loading ? (
        <LoadingState label="Loading candidate…" />
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : candidate ? (
        <>
          <div className="cmStatusRow">
            <Chip tone={candidate.source ? "info" : "neutral"}>{candidateSourceLabel(candidate.source)}</Chip>
            <Chip tone={candidate.hasLogin ? "success" : "neutral"}>
              {candidate.hasLogin ? "Registered (has login)" : "Guest candidate"}
            </Chip>
            <Chip tone={candidate.spamSuspected ? "danger" : "success"}>
              {candidate.spamSuspected ? "Spam suspected" : "Not spam"}
            </Chip>
            <Chip tone={hasResume ? "success" : "warn"}>{hasResume ? "Resume on file" : "No resume"}</Chip>
            {candidate.spamSuspected && canSpam && (
              <button
                type="button"
                className="secondaryButton cmBtn cmPageBtn"
                onClick={() => onRequestSpam(candidate, false)}
              >
                <ShieldCheck size={14} /> Clear spam flag
              </button>
            )}
            {!candidate.spamSuspected && canSpam && (
              <button
                type="button"
                className="secondaryButton cmBtn cmPageBtn"
                onClick={() => onRequestSpam(candidate, true)}
              >
                <ShieldAlert size={14} /> Flag as spam
              </button>
            )}
          </div>

          {candidate.spamReason && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="warn">Spam reason: {candidate.spamReason}</Notice>
            </div>
          )}

          <div className="cmDetailGrid" style={{ marginTop: 18 }}>
            <DetailRow label="Full name">{candidate.fullName || "—"}</DetailRow>
            <DetailRow label="Candidate ID">{candidate.id}</DetailRow>
            <DetailRow label="Email">
              {candidate.email ? <a href={`mailto:${candidate.email}`}>{candidate.email}</a> : "—"}
            </DetailRow>
            <DetailRow label="Phone">
              {candidate.phone ? <a href={`tel:${candidate.phone}`}>{candidate.phone}</a> : "—"}
            </DetailRow>
            <DetailRow label="City">{candidate.city || "—"}</DetailRow>
            <DetailRow label="State">{candidate.state || "—"}</DetailRow>
            <DetailRow label="Total experience (months)">
              {candidate.totalExperienceMonths === null || candidate.totalExperienceMonths === undefined
                ? "—"
                : candidate.totalExperienceMonths}
            </DetailRow>
            <DetailRow label="Experience">{candidate.experienceLabel || "—"}</DetailRow>
            <DetailRow label="Highest qualification">{candidate.highestQualification || "—"}</DetailRow>
            <DetailRow label="Preferred category">{candidate.preferredCategoryName || "—"}</DetailRow>
            <DetailRow label="Login status">
              {candidate.hasLogin ? "Can sign in and track applications" : "No login (guest)"}
            </DetailRow>
            <DetailRow label="Associated user ID">{candidate.userId == null ? "—" : candidate.userId}</DetailRow>
            <DetailRow label="Resume document ID">
              {candidate.resumeDocumentId == null ? "—" : candidate.resumeDocumentId}
            </DetailRow>
            <DetailRow label="Resume filename">{candidate.resumeFileName || "—"}</DetailRow>
            <DetailRow label="Source">{candidateSourceLabel(candidate.source)}</DetailRow>
            <DetailRow label="Consent status">
              {candidate.consentGiven ? "Consent given" : "No consent on record"}
            </DetailRow>
            <DetailRow label="Consent date">{candidate.consentGivenAt ? formatDateTime(candidate.consentGivenAt) : "—"}</DetailRow>
            <DetailRow label="Spam status">{candidate.spamSuspected ? "Flagged as spam" : "Not flagged"}</DetailRow>
            <DetailRow label="Application count">{candidate.applicationCount == null ? 0 : candidate.applicationCount}</DetailRow>
            <DetailRow label="Registration date">{formatDateTime(candidate.createdAt)}</DetailRow>
          </div>

          {canViewNotes && (
            <div className="cmDetailSection">
              <h3>Internal notes</h3>
              {candidate.notes ? (
                <p className="cmNotes">{candidate.notes}</p>
              ) : (
                <p className="cmHint">No internal notes recorded for this candidate.</p>
              )}
            </div>
          )}

          <div className="cmDetailSection">
            <h3>Resume</h3>
            {resumeNotice && <Notice tone="info">{resumeNotice}</Notice>}
            {resumeError && (
              <div style={{ marginBottom: 12 }}>
                <Notice tone="error">{resumeError}</Notice>
              </div>
            )}
            <div className="cmStatusRow">
              <span className="cmMuted">
                <FileText size={14} /> {candidate.resumeFileName || "No resume on file"}
              </span>
              {hasResume && (
                <>
                  <button
                    type="button"
                    className="secondaryButton cmBtn cmPageBtn"
                    onClick={() => openResume("view")}
                    disabled={resumeBusy}
                  >
                    <Eye size={14} /> View
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
              )}
              {canManage && (
                <button
                  type="button"
                  className="primaryButton cmBtn cmPageBtn"
                  onClick={() => fileRef.current?.click()}
                  disabled={resumeBusy}
                >
                  {resumeBusy ? <Loader2 size={14} className="spin" /> : hasResume ? <RefreshCw size={14} /> : <UploadCloud size={14} />}
                  {hasResume ? "Replace resume" : "Upload resume"}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
                onChange={handleResumeChange}
                disabled={resumeBusy}
              />
            </div>
            <p className="cmHint" style={{ marginTop: 10 }}>
              PDF only, up to 10 MB. Replacing the current CV does not change resume snapshots already attached to past
              applications.
            </p>
          </div>

          <div className="cmDetailSection">
            <h3>Applications</h3>
            {appsLoading ? (
              <LoadingState label="Loading applications…" />
            ) : appsError ? (
              <Notice tone="error">{appsError}</Notice>
            ) : applications.length === 0 ? (
              <EmptyState title="No applications" message="This candidate has not applied for any vacancy yet." />
            ) : (
              <div className="cmTableWrap">
                <table className="cmTable" style={{ minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Applied</th>
                      <th>Assigned</th>
                      <th>Interviews</th>
                      <th>Resume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td>
                          <span className="cmCode">{application.jobTitle || `Job #${application.jobId}`}</span>
                        </td>
                        <td>
                          <ApplicationStatusChip status={application.status} />
                        </td>
                        <td className="cmMuted">{application.appliedOn ? formatDate(application.appliedOn) : "—"}</td>
                        <td className="cmMuted">{application.assignedToName || "Unassigned"}</td>
                        <td>
                          <button
                            type="button"
                            className="cmLinkButton"
                            onClick={() => setInterviewApp(application)}
                          >
                            {application.interviewCount || 0} · View rounds
                          </button>
                        </td>
                        <td>{application.hasResume ? <Chip tone="success">Snapshot</Chip> : <Chip tone="neutral">None</Chip>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {canManage && (
            <div className="cmDetailSection">
              <h3>Candidate actions</h3>
              <div className="cmStatusRow">
                <button type="button" className="secondaryButton cmBtn" onClick={() => onEdit(candidate)}>
                  <Pencil size={15} /> Edit details
                </button>
                {canDelete && (
                  <button type="button" className="cmDangerButton cmBtn" onClick={() => onRequestDelete(candidate)}>
                    <Trash2 size={15} /> Delete candidate
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}

      {interviewApp && (
        <ApplicationInterviewsModal
          applicationId={interviewApp.id}
          application={interviewApp}
          canManage={canManage}
          onClose={() => setInterviewApp(null)}
          onChanged={() => {
            loadApplications();
            if (onChanged) onChanged();
          }}
        />
      )}
    </Drawer>
  );
}
