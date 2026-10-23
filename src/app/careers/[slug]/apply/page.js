import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Footer, Navbar } from "@/components/site-chrome";
import { SiteProvider } from "@/components/site-provider";
import HistoryBack from "@/components/history-back";
import PublicJobApplicationForm from "@/components/public-job-application-form";
import { locationOf } from "@/lib/job-format";
import { getPublicJobBySlug } from "@/lib/publicApi";

export const instant = false;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const job = await getPublicJobBySlug(slug);
    if (!job || typeof job !== "object") return { title: "Apply for a job" };
    return {
      title: `Apply — ${job.title || "Job opening"}`,
      description: job.summary || undefined,
    };
  } catch {
    return { title: "Apply for a job" };
  }
}

export default async function CareerApplyPage({ params }) {
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

  const title = job && typeof job === "object" ? job.title || "Job opening" : "Job opening";

  return (
    <SiteProvider>
      <Navbar />
      <main>
        <section className="section section-soft job-detail-hero">
          <div className="container">
            <HistoryBack fallbackHref="/#careers">Back</HistoryBack>
            <span className="eyebrow">APPLY</span>
            <h1>Apply for {title}</h1>
            {!loadError && (
              <p className="service-summary">
                {[job.categoryName, locationOf(job)].filter(Boolean).join(" · ") ||
                  "No account needed — tell us a little about yourself."}
              </p>
            )}
          </div>
        </section>

        <section className="section section-white">
          <div className="container">
            {loadError ? (
              <div className="application-unavailable" role="alert">
                <span className="application-unavailable-icon">
                  <AlertCircle size={22} />
                </span>
                <h2>We could not load this vacancy</h2>
                <p>{loadError}</p>
                <div className="job-detail-actions">
                  <a className="button button-outline" href={`/careers/${encodeURIComponent(slug)}/apply`}>
                    Try again
                  </a>
                  <Link className="button button-primary" href="/#careers">
                    Back to job openings <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="apply-layout">
                <div className="apply-main">
                  <PublicJobApplicationForm slug={slug} jobTitle={title} />
                </div>
                <aside className="apply-aside">
                  <h2>No account needed</h2>
                  <p>
                    Apply straight from this page. We only ask for what a recruiter needs to call you
                    back — your name, a mobile number and how to reach you.
                  </p>
                  <ul className="apply-aside-list">
                    <li>A PDF resume is optional but helps you stand out.</li>
                    <li>Fields marked with * are required.</li>
                    <li>We will only use your details for this application.</li>
                  </ul>
                  <Link className="button button-outline" href={`/careers/${encodeURIComponent(slug)}`}>
                    View full job details
                  </Link>
                </aside>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </SiteProvider>
  );
}
