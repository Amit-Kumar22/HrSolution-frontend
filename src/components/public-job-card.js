import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, MapPin, Wallet } from "lucide-react";

const SHIFT_LABELS = { DAY: "Day shift", NIGHT: "Night shift", ROTATIONAL: "Rotational shift" };

function formatExpiry(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function locationOf(job) {
  return (
    job?.location ||
    [job?.city, job?.state].filter(Boolean).join(", ") ||
    "Location not stated"
  );
}

export default function PublicJobCard({ job }) {
  if (!job) return null;
  const slug = job.slug;
  const href = slug ? `/careers/${encodeURIComponent(slug)}` : "/careers";
  const applyHref = slug ? `/careers/${encodeURIComponent(slug)}/apply` : "/careers";
  const expiry = formatExpiry(job.expiresOn);

  return (
    <article className="job-card">
      <div className="job-meta">
        <span className="job-category">
          <i />
          {job.categoryName || "General"}
        </span>
        {expiry && <small>Apply by {expiry}</small>}
      </div>
      <h3>{job.title}</h3>
      <ul className="job-details">
        <li>
          <MapPin size={14} />
          {locationOf(job)}
        </li>
        <li>
          <Wallet size={14} />
          {job.salaryRangeLabel || "Salary not disclosed"}
        </li>
        <li>
          <BriefcaseBusiness size={14} />
          {job.experienceLabel || "Experience not stated"}
          {job.openings ? ` · ${job.openings} opening${job.openings > 1 ? "s" : ""}` : ""}
        </li>
        {job.shift && (
          <li>
            <CalendarClock size={14} />
            {SHIFT_LABELS[job.shift] || job.shift}
          </li>
        )}
      </ul>
      {job.summary && <p className="job-summary">{job.summary}</p>}
      <div className="job-actions">
        <Link className="button button-dark" href={applyHref}>
          Apply now
        </Link>
        <Link className="button button-outline" href={href}>
          View details
        </Link>
      </div>
    </article>
  );
}
