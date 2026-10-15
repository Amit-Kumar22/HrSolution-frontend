"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileText,
  MapPin,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import {
  CandidateApiError,
  applyForJob,
  listCandidateCategories,
  listOpenJobs,
} from "@/lib/candidateApi";
import { EmptyState, ErrorState, Modal, Spinner, formatDate, formatExperience } from "./candidate-ui";

const SHIFT_LABELS = { DAY: "Day shift", NIGHT: "Night shift", ROTATIONAL: "Rotational shift" };
const MAX_EXPECTED_SALARY = 9999999.99;

function ApplyModal({ open, job, profile, onClose, onApplied, onManageResume }) {
  const [coverNote, setCoverNote] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const hasResume = Boolean(profile && profile.resumeDocumentId);

  function close() {
    if (submitting) return;
    setCoverNote("");
    setExpectedSalary("");
    setFieldError("");
    setError("");
    setSuccess(null);
    onClose();
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting || !job || job.id === null) return;
    setFieldError("");
    setError("");

    if (!hasResume) {
      setError("Upload a resume before applying. You can add one from the My Resume section.");
      return;
    }
    if (coverNote.length > 2000) {
      setFieldError("Your cover note must be 2,000 characters or fewer.");
      return;
    }
    if (expectedSalary !== "") {
      const numeric = Number(expectedSalary);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > MAX_EXPECTED_SALARY) {
        setFieldError("Enter a valid expected salary (a number between 0 and 9,999,999.99).");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await applyForJob(job.id, { coverNote, expectedSalary });
      setSuccess(result);
      onApplied(result);
    } catch (caught) {
      if (caught instanceof CandidateApiError && caught.status === 409) {
        setError("You have already applied for this job.");
        onApplied(null);
      } else {
        setError(
          caught instanceof Error ? caught.message : "Your application could not be submitted. Please try again.",
        );
      }
      setSubmitting(false);
    }
  }

  if (!open || !job) return null;

  return (
    <Modal
      open={open}
      title={success ? "Application submitted" : `Apply for ${job.title}`}
      description={success ? undefined : "Your current profile resume is attached to this application."}
      onClose={close}
      footer={
        success ? (
          <button type="button" className="authButton" onClick={close}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="authButtonSecondary" onClick={close} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              className="authButton"
              onClick={submit}
              disabled={submitting || !hasResume || job.id === null}
            >
              <Send size={15} /> {submitting ? "Submitting…" : "Submit application"}
            </button>
          </>
        )
      }
    >
      {success ? (
        <div className="cp-applySuccess">
          <div className="authAlert authAlert--success" role="status">
            <CheckCircle2 size={16} />
            {success.message || "Your application has been received."}
          </div>
          <div className="cp-detailGrid">
            <div className="cp-detail"><span>Reference</span><strong>{success.reference || "—"}</strong></div>
            <div className="cp-detail"><span>Job title</span><strong>{success.jobTitle || job.title}</strong></div>
            <div className="cp-detail"><span>Status</span><strong>{success.status || "APPLIED"}</strong></div>
          </div>
        </div>
      ) : (
        <form className="authForm cp-form" onSubmit={submit} noValidate>
          <div className="cp-detailGrid cp-detailGrid--compact">
            <div className="cp-detail"><span>Category</span><strong>{job.categoryName || "—"}</strong></div>
            <div className="cp-detail"><span>Location</span><strong>{job.location || job.city || "—"}</strong></div>
            <div className="cp-detail"><span>Salary</span><strong>{job.salaryRangeLabel || "Not disclosed"}</strong></div>
            <div className="cp-detail"><span>Experience</span><strong>{job.experienceLabel || "Not specified"}</strong></div>
          </div>

          <div className={`cp-resumeStatus${hasResume ? " cp-resumeStatus--ready" : " cp-resumeStatus--missing"}`}>
            <FileText size={16} />
            {hasResume ? (
              <span>
                Resume attached: <strong>{profile.resumeFileName || "Resume.pdf"}</strong>
              </span>
            ) : (
              <span>
                No resume on file. You must upload a PDF resume before applying.
                <button
                  type="button"
                  className="cp-linkButton"
                  onClick={() => {
                    close();
                    onManageResume?.();
                  }}
                >
                  Go to My Resume
                </button>
              </span>
            )}
          </div>

          {error && (
            <div className="authAlert authAlert--error" role="alert">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="authField authField--full">
            <label className="authLabel" htmlFor="cp-cover-note">Cover note (optional)</label>
            <textarea
              id="cp-cover-note"
              className="authInput cp-textarea"
              rows={4}
              maxLength={2000}
              placeholder="Tell the recruiter why you are a good fit for this role."
              value={coverNote}
              onChange={(event) => setCoverNote(event.target.value)}
              disabled={submitting}
            />
            <small className="authPasswordHint cp-hint">{coverNote.length}/2000 characters</small>
          </div>

          <div className="authField authField--full">
            <label className="authLabel" htmlFor="cp-expected-salary">Expected salary (monthly, optional)</label>
            <input
              id="cp-expected-salary"
              className={`authInput${fieldError ? " authInputError" : ""}`}
              type="number"
              min={0}
              max={MAX_EXPECTED_SALARY}
              step="1"
              placeholder="e.g. 20000"
              value={expectedSalary}
              onChange={(event) => setExpectedSalary(event.target.value)}
              disabled={submitting}
            />
            {fieldError && <span className="field-error">{fieldError}</span>}
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function CandidateJobs({ profile, onApplied, onNavigateResume }) {
  const [state, setState] = useState({ status: "loading", jobs: [], error: "", total: 0, source: null });
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [city, setCity] = useState("");
  const [applyJob, setApplyJob] = useState(null);

  function requestJobs(filters) {
    return listOpenJobs(filters)
      .then((result) => setState({ status: "ready", jobs: result.jobs, total: result.total, source: result.source, error: "" }))
      .catch((error) =>
        setState({
          status: "error",
          jobs: [],
          total: 0,
          source: null,
          error: error instanceof Error ? error.message : "Open jobs could not be loaded.",
        }),
      );
  }

  function load() {
    setState((prev) => ({ ...prev, status: "loading", error: "" }));
    requestJobs({ categoryId: categoryId || undefined, city: city.trim() || undefined });
  }

  useEffect(() => {
    let cancelled = false;
    listCandidateCategories()
      .then((list) => {
        if (!cancelled) setCategories(list.filter((c) => c.active !== false));
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listOpenJobs({})
      .then((result) => {
        if (!cancelled) {
          setState({ status: "ready", jobs: result.jobs, total: result.total, source: result.source, error: "" });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            jobs: [],
            total: 0,
            source: null,
            error: error instanceof Error ? error.message : "Open jobs could not be loaded.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategories = useMemo(() => categories, [categories]);

  return (
    <section className="cp-panel">
      <div className="cp-panelHead">
        <div>
          <h2>Browse jobs</h2>
          <p>Open vacancies you can apply for right now.</p>
        </div>
        <button type="button" className="authButtonSecondary cp-inlineButton" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="cp-filters">
        <div className="cp-filterField">
          <label className="authLabel" htmlFor="cp-filter-category">Category</label>
          <select
            id="cp-filter-category"
            className="authSelect"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">All categories</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="cp-filterField">
          <label className="authLabel" htmlFor="cp-filter-city">City</label>
          <input
            id="cp-filter-city"
            className="authInput"
            type="text"
            placeholder="e.g. Pune"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <button type="button" className="authButton cp-filterButton" onClick={load}>
          Search
        </button>
      </div>

      {state.status === "loading" && <Spinner label="Loading open jobs…" />}
      {state.status === "error" && <ErrorState message={state.error} onRetry={load} />}

      {state.status === "ready" && state.jobs.length === 0 && (
        <EmptyState title="No open vacancies right now">
          There are no jobs matching your filters at the moment. Please check back soon or adjust your search.
        </EmptyState>
      )}

      {state.status === "ready" && state.jobs.length > 0 && (
        <div className="cp-jobGrid">
          {state.jobs.map((job) => (
            <article className="cp-jobCard" key={job.slug || job.id}>
              <div className="cp-jobTop">
                <span className="cp-jobCategory">{job.categoryName || "General"}</span>
                {job.expiresOn && <span className="cp-jobExpiry">Apply by {formatDate(job.expiresOn)}</span>}
              </div>
              <h3>{job.title}</h3>
              <ul className="cp-jobMeta">
                <li><MapPin size={13} />{job.location || [job.city, job.state].filter(Boolean).join(", ") || "Location not stated"}</li>
                <li><Wallet size={13} />{job.salaryRangeLabel || "Salary not disclosed"}</li>
                <li><Briefcase size={13} />{job.experienceLabel || formatExperience(0)}</li>
                {job.shift && <li><CalendarClock size={13} />{SHIFT_LABELS[job.shift] || job.shift}</li>}
              </ul>
              {job.summary && <p className="cp-jobSummary">{job.summary}</p>}
              <div className="cp-jobActions">
                <button
                  type="button"
                  className="authButton cp-inlineButton"
                  onClick={() => setApplyJob(job)}
                >
                  <Send size={14} /> Apply now
                </button>
                {job.openings ? <span className="cp-jobOpenings">{job.openings} opening{job.openings > 1 ? "s" : ""}</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <ApplyModal
        open={Boolean(applyJob)}
        job={applyJob}
        profile={profile}
        onClose={() => setApplyJob(null)}
        onApplied={onApplied}
        onManageResume={onNavigateResume}
      />
    </section>
  );
}
