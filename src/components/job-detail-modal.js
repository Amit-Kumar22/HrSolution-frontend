"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import Link from "next/link";
import { getPublicJobBySlug } from "@/lib/publicApi";
import { locationOf } from "@/lib/job-format";

const SHIFT_LABELS = { DAY: "Day shift", NIGHT: "Night shift", ROTATIONAL: "Rotational shift" };

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div className="job-detail-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function JobDetailContent({ slug, onClose }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getPublicJobBySlug(slug)
      .then((data) => {
        if (!active) return;
        if (!data || typeof data !== "object") {
          setError("Job details could not be loaded.");
          return;
        }
        setJob(data);
      })
      .catch((err) => {
        if (!active) return;
        setError((err && typeof err.message === "string" && err.message) || "Job details could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const title = job?.title || "Job opening";
  const summary = typeof job?.summary === "string" ? job.summary.trim() : "";
  const description = typeof job?.description === "string" ? job.description.trim() : "";
  const cityState = [job?.city, job?.state].filter(Boolean).join(", ");
  const expiry = formatDate(job?.expiresOn);
  const applyHref = `/careers/${encodeURIComponent(slug)}/apply`;

  return (
    <>
      <div className="job-detail-modal-body">
        <span className="job-category">
          <i />
          {job?.categoryName || "General"}
        </span>
        <h3>{title}</h3>
        {summary && <p className="modal-sub">{summary}</p>}
        {loading && (
          <p className="job-detail-loading">
            <Loader2 size={14} className="spin" /> Loading details…
          </p>
        )}
        {error && !loading && <p className="form-error">{error}</p>}
        {job && !loading && !error && (
          <>
            <dl className="job-detail-facts">
              <Fact label="Location" value={locationOf(job)} />
              <Fact label="City / State" value={cityState} />
              <Fact label="Category" value={job.categoryName} />
              <Fact label="Skill level" value={job.skillLevelLabel} />
              <Fact label="Salary" value={job.salaryRangeLabel} />
              <Fact label="Experience" value={job.experienceLabel} />
              <Fact label="Openings" value={job.openings ? String(job.openings) : null} />
              <Fact label="Shift" value={job.shift ? SHIFT_LABELS[job.shift] || job.shift : null} />
              <Fact label="Apply by" value={expiry} />
            </dl>
            {description && (
              <div className="job-detail-description">
                <h2>Job description</h2>
                <p className="service-detail-text job-detail-text">{description}</p>
              </div>
            )}
          </>
        )}
      </div>
      {job && !loading && !error && (
        <div className="job-detail-actions">
          <Link className="button button-primary" href={applyHref} onClick={onClose}>
            Apply now <ArrowRight size={16} />
          </Link>
          <button className="button button-outline" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </>
  );
}

export default function JobDetailModal({ open, slug, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !slug) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Job details"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="job-detail-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close job details">
          <X size={17} />
        </button>
        <JobDetailContent key={slug} slug={slug} onClose={onClose} />
      </div>
    </div>
  );
}
