"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, FileText, Loader2 } from "lucide-react";
import FieldError from "./field-error";
import { applyForPublicJob } from "@/lib/publicApi";
import { pickApiFieldErrors } from "@/lib/lead-form";
import {
  APPLICATION_KNOWN_FIELDS,
  buildApplicationPayload,
  readApplicationValues,
  resolveApplicationError,
  validateApplication,
  validateResume,
} from "@/lib/job-application";

const STATUS_LABELS = {
  APPLIED: "Applied",
  SCREENING: "In screening",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  SELECTED: "Selected",
  OFFERED: "Offer made",
  JOINED: "Joined",
  REJECTED: "Not moving forward",
  ON_HOLD: "On hold",
  WITHDRAWN: "Withdrawn",
};

function statusLabel(status) {
  if (typeof status !== "string" || !status) return "Received";
  return STATUS_LABELS[status] || status;
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PublicJobApplicationForm({ slug, jobTitle }) {
  const renderedAtRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [resumeMeta, setResumeMeta] = useState(null);
  const [result, setResult] = useState(null);
  const [blocked, setBlocked] = useState("");

  useEffect(() => {
    renderedAtRef.current = Date.now();
  }, []);

  function clearFieldError(name) {
    setFieldErrors((previous) => {
      if (!previous[name]) return previous;
      const next = { ...previous };
      delete next[name];
      return next;
    });
  }

  function onResumeChange(event) {
    const file = event.target.files && event.target.files[0];
    setResumeMeta(file ? { name: file.name, size: file.size } : null);
    clearFieldError("resume");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const errors = validateApplication(readApplicationValues(formData));

    const resumeEntry = formData.get("resume");
    const resumeFile =
      resumeEntry && typeof resumeEntry === "object" && resumeEntry.size > 0 ? resumeEntry : null;
    const resumeError = validateResume(resumeFile);
    if (resumeError) errors.resume = resumeError;

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatus({ state: "error", message: "Please fix the highlighted fields and try again." });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setStatus({ state: "submitting", message: "" });

    try {
      const payload = buildApplicationPayload(formData, renderedAtRef.current);
      const response = await applyForPublicJob(slug, payload, resumeFile);
      setResult(response && typeof response === "object" ? response : {});
    } catch (error) {
      const resolved = resolveApplicationError(error);
      const apiErrors = pickApiFieldErrors(error, APPLICATION_KNOWN_FIELDS);
      if (resolved.resumeError) apiErrors.resume = resolved.resumeError;
      setFieldErrors(apiErrors);
      if (resolved.blocked) setBlocked(resolved.message);
      setStatus({ state: "error", message: resolved.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="application-success" role="status">
        <span className="application-success-icon">
          <CheckCircle2 size={26} />
        </span>
        <h2>Application received</h2>
        <p>
          {result.message ||
            "Thank you. Your application has been received and our team will be in touch."}
        </p>
        <dl className="application-success-facts">
          {result.reference && (
            <div>
              <dt>Reference</dt>
              <dd>{result.reference}</dd>
            </div>
          )}
          <div>
            <dt>Role</dt>
            <dd>{result.jobTitle || jobTitle}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel(result.status)}</dd>
          </div>
        </dl>
        <p className="application-success-note">
          Keep your reference handy — quote it if you call us about this application.
        </p>
        <div className="job-detail-actions">
          <Link className="button button-outline" href="/#careers">
            Back to job openings
          </Link>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="application-unavailable" role="alert">
        <span className="application-unavailable-icon">
          <AlertCircle size={22} />
        </span>
        <h2>This vacancy is no longer open</h2>
        <p>{blocked}</p>
        <div className="job-detail-actions">
          <Link className="button button-primary" href="/#careers">
            Back to job openings <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="application-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label htmlFor="apply-fullName">
          Full name *
          <input
            id="apply-fullName"
            name="fullName"
            placeholder="Your name"
            autoComplete="name"
            aria-required="true"
            aria-invalid={fieldErrors.fullName ? "true" : undefined}
            onChange={() => clearFieldError("fullName")}
          />
          <FieldError message={fieldErrors.fullName} />
        </label>

        <label htmlFor="apply-phone">
          Mobile number *
          <input
            id="apply-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            autoComplete="tel"
            aria-required="true"
            aria-invalid={fieldErrors.phone ? "true" : undefined}
            onChange={() => clearFieldError("phone")}
          />
          <FieldError message={fieldErrors.phone} />
        </label>

        <label htmlFor="apply-email">
          Email *
          <input
            id="apply-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            aria-required="true"
            aria-invalid={fieldErrors.email ? "true" : undefined}
            onChange={() => clearFieldError("email")}
          />
          <FieldError message={fieldErrors.email} />
        </label>

        <label htmlFor="apply-city">
          City
          <input
            id="apply-city"
            name="city"
            placeholder="e.g. Pune"
            autoComplete="address-level2"
            aria-invalid={fieldErrors.city ? "true" : undefined}
            onChange={() => clearFieldError("city")}
          />
          <FieldError message={fieldErrors.city} />
        </label>

        <label htmlFor="apply-state">
          State
          <input
            id="apply-state"
            name="state"
            placeholder="e.g. Maharashtra"
            autoComplete="address-level1"
            aria-invalid={fieldErrors.state ? "true" : undefined}
            onChange={() => clearFieldError("state")}
          />
          <FieldError message={fieldErrors.state} />
        </label>

        <label htmlFor="apply-totalExperienceMonths">
          Total experience (months)
          <input
            id="apply-totalExperienceMonths"
            name="totalExperienceMonths"
            type="number"
            min="0"
            max="720"
            step="1"
            inputMode="numeric"
            placeholder="0 if you are a fresher"
            aria-invalid={fieldErrors.totalExperienceMonths ? "true" : undefined}
            onChange={() => clearFieldError("totalExperienceMonths")}
          />
          <FieldError message={fieldErrors.totalExperienceMonths} />
        </label>

        <label htmlFor="apply-highestQualification">
          Highest qualification
          <input
            id="apply-highestQualification"
            name="highestQualification"
            placeholder="e.g. ITI Electrician, 10th pass"
            aria-invalid={fieldErrors.highestQualification ? "true" : undefined}
            onChange={() => clearFieldError("highestQualification")}
          />
          <FieldError message={fieldErrors.highestQualification} />
        </label>

        <label htmlFor="apply-expectedSalary">
          Expected salary (₹ per month)
          <input
            id="apply-expectedSalary"
            name="expectedSalary"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Optional"
            aria-invalid={fieldErrors.expectedSalary ? "true" : undefined}
            onChange={() => clearFieldError("expectedSalary")}
          />
          <FieldError message={fieldErrors.expectedSalary} />
        </label>

        <label className="form-message" htmlFor="apply-coverNote">
          Message to the recruiter
          <textarea
            id="apply-coverNote"
            name="coverNote"
            rows="4"
            placeholder="Anything you would like us to know — availability, current location, references."
            aria-invalid={fieldErrors.coverNote ? "true" : undefined}
            onChange={() => clearFieldError("coverNote")}
          />
          <FieldError message={fieldErrors.coverNote} />
        </label>

        <label className="form-message resume-field" htmlFor="apply-resume">
          Resume (PDF, up to 10 MB)
          <input
            id="apply-resume"
            name="resume"
            type="file"
            accept="application/pdf,.pdf"
            aria-invalid={fieldErrors.resume ? "true" : undefined}
            onChange={onResumeChange}
          />
          {resumeMeta && (
            <span className="resume-meta">
              <FileText size={13} /> {resumeMeta.name} · {formatSize(resumeMeta.size)}
            </span>
          )}
          <FieldError message={fieldErrors.resume} />
        </label>
      </div>

      <label className="consent-field" htmlFor="apply-consentGiven">
        <input
          id="apply-consentGiven"
          name="consentGiven"
          type="checkbox"
          aria-invalid={fieldErrors.consentGiven ? "true" : undefined}
          onChange={() => clearFieldError("consentGiven")}
        />
        <span>
          I consent to my details and resume being stored and processed for this job application. *
        </span>
      </label>
      <FieldError message={fieldErrors.consentGiven} />

      <input
        type="text"
        name="website"
        defaultValue=""
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hp-field"
      />

      <button className="button button-primary form-submit" type="submit" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 size={16} className="spin" /> Submitting…
          </>
        ) : (
          <>
            Submit application <ArrowRight size={16} />
          </>
        )}
      </button>

      {status.state === "error" && (
        <p className="form-error" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}
