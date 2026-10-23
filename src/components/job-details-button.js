"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, X } from "lucide-react";
import { getPublicJobBySlug } from "@/lib/publicApi";

const SHIFT_LABELS = { DAY: "Day shift", NIGHT: "Night shift", ROTATIONAL: "Rotational shift" };

function locationOf(job) {
  return (
    job?.location ||
    [job?.city, job?.state].filter(Boolean).join(", ") ||
    "Location not stated"
  );
}

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

function JobDetailsModal({ job, onClose }) {
  const slug = job.slug;
  const [detail, setDetail] = useState(job);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState("");

  useEffect(() => {
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
  }, [onClose]);

  useEffect(() => {
    if (!slug) return undefined;
    let active = true;
    getPublicJobBySlug(slug)
      .then((data) => {
        if (!active) return;
        if (data && typeof data === "object") setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          (err && typeof err.message === "string" && err.message) ||
            "This job opening could not be loaded right now.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const data = detail || job;
  const title = data.title || "Job opening";
  const summary = typeof data.summary === "string" ? data.summary.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const cityState = [data.city, data.state].filter(Boolean).join(", ");
  const expiry = formatDate(data.expiresOn);
  const applyHref = slug ? `/careers/${encodeURIComponent(slug)}/apply` : "/careers";

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} details`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="job-detail-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close job details">
          <X size={17} />
        </button>
        <span className="job-category">
          <i />
          {data.categoryName || "General"}
        </span>
        <h3>{title}</h3>
        {summary && <p className="modal-sub">{summary}</p>}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <dl className="job-detail-facts">
          <Fact label="Location" value={locationOf(data)} />
          <Fact label="City / State" value={cityState} />
          <Fact label="Category" value={data.categoryName} />
          <Fact label="Skill level" value={data.skillLevelLabel} />
          <Fact label="Salary" value={data.salaryRangeLabel} />
          <Fact label="Experience" value={data.experienceLabel} />
          <Fact label="Openings" value={data.openings ? String(data.openings) : null} />
          <Fact label="Shift" value={data.shift ? SHIFT_LABELS[data.shift] || data.shift : null} />
          <Fact label="Apply by" value={expiry} />
        </dl>

        {description && (
          <div className="job-detail-description">
            <h2>Job description</h2>
            <p className="service-detail-text job-detail-text">{description}</p>
          </div>
        )}

        {loading && (
          <p className="job-detail-loading">
            <Loader2 size={15} className="spin" /> Loading full details…
          </p>
        )}

        <div className="job-detail-actions">
          <Link className="button button-primary" href={applyHref}>
            Apply now
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function JobDetailsButton({ job }) {
  const [open, setOpen] = useState(false);
  if (!job) return null;

  return (
    <>
      <button type="button" className="button button-outline" onClick={() => setOpen(true)}>
        View details
      </button>
      {open && <JobDetailsModal job={job} onClose={() => setOpen(false)} />}
    </>
  );
}
