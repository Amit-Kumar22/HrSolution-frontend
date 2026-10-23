import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Footer, Navbar } from "@/components/site-chrome";
import { SiteProvider } from "@/components/site-provider";
import HistoryBack from "@/components/history-back";
import JobApplyButton from "@/components/job-apply-button";
import { locationOf } from "@/lib/job-format";
import { getPublicJobBySlug } from "@/lib/publicApi";

const SHIFT_LABELS = { DAY: "Day shift", NIGHT: "Night shift", ROTATIONAL: "Rotational shift" };

export const instant = false;

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const job = await getPublicJobBySlug(slug);
    if (!job || typeof job !== "object") return { title: "Job not found" };
    return {
      title: job.metaTitle || job.title || "Job opening",
      description: job.metaDescription || job.summary || undefined,
    };
  } catch {
    return { title: "Job not found" };
  }
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

function JobContent({ job, slug }) {
  const title = job.title || "Job opening";
  const summary = typeof job.summary === "string" ? job.summary.trim() : "";
  const description = typeof job.description === "string" ? job.description.trim() : "";
  const cityState = [job.city, job.state].filter(Boolean).join(", ");
  const expiry = formatDate(job.expiresOn);

  return (
    <>
      <section className="section section-soft job-detail-hero">
        <div className="container">
          <HistoryBack fallbackHref="/#careers">Back</HistoryBack>
          <span className="job-category">
            <i />
            {job.categoryName || "General"}
          </span>
          <h1>{title}</h1>
          {summary && <p className="service-summary">{summary}</p>}
          <div className="job-detail-actions" id="apply">
            <JobApplyButton slug={slug} />
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="container">
          <div className="job-detail-body">
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

            <div className="service-detail-cta">
              <div>
                <h2>Ready to apply?</h2>
                <p>Apply online in a few minutes — no account needed. Just your details and, if you have one, a PDF resume.</p>
              </div>
              <JobApplyButton slug={slug} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default async function CareerJobPage({ params }) {
  const { slug } = await params;
  let job = null;
  let loadError = "";

  try {
    job = await getPublicJobBySlug(slug);
  } catch (error) {
    if (error && error.status === 404) notFound();
    loadError =
      (error && typeof error.message === "string" && error.message) ||
      "This job opening could not be loaded right now.";
  }

  if (!loadError && (!job || typeof job !== "object")) notFound();

  return (
    <SiteProvider>
      <Navbar />
      <main>
        {loadError ? (
          <section className="section section-soft">
            <div className="container">
              <div className="section-feedback" role="alert">
                <span className="section-feedback-icon">
                  <AlertCircle size={17} />
                </span>
                <p>{loadError}</p>
              </div>
              <div className="job-detail-actions">
                <a className="button button-outline" href={`/careers/${encodeURIComponent(slug)}`}>
                  Try again
                </a>
                <Link className="button button-primary" href="/careers">
                  Back to all jobs <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <JobContent job={job} slug={slug} />
        )}
      </main>
      <Footer />
    </SiteProvider>
  );
}
