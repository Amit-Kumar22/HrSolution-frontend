import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, BriefcaseBusiness } from "lucide-react";
import PublicImage from "@/components/public-image";
import { Footer, Navbar } from "@/components/site-chrome";
import { SiteProvider } from "@/components/site-provider";
import { SERVICE_ICONS } from "@/lib/public-icons";
import { getServiceBySlug, resolvePublicFileUrl } from "@/lib/publicApi";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const service = await getServiceBySlug(slug);
    if (!service || typeof service !== "object") {
      return { title: "Service not found" };
    }
    return {
      title: service.metaTitle || service.title || "Manpower Service",
      description: service.metaDescription || service.summary || undefined,
    };
  } catch {
    return { title: "Service not found" };
  }
}

function ServiceContent({ service }) {
  const Icon = SERVICE_ICONS[String(service.icon || "").trim().toLowerCase()] || BriefcaseBusiness;
  const heroImage = resolvePublicFileUrl(service.heroImageUrl);
  const summary = typeof service.summary === "string" ? service.summary.trim() : "";
  const description = typeof service.description === "string" ? service.description.trim() : "";
  const title = service.title || "Manpower Service";

  return (
    <>
      <section className="service-detail-hero section-soft">
        <div className="container">
          <Link className="service-back" href="/#services">
            <ArrowLeft size={14} /> Back to services
          </Link>
          <span className="icon-tile icon-blue">
            <Icon size={22} />
          </span>
          <h1>{title}</h1>
          {summary && <p className="service-summary">{summary}</p>}
          {heroImage && (
            <PublicImage
              src={heroImage}
              alt={title}
              className="service-hero-image"
              fallback={null}
            />
          )}
        </div>
      </section>

      <section className="section section-white">
        <div className="container">
          <div className="service-detail-body">
            {description && <p className="service-detail-text">{description}</p>}
            <div className="service-detail-cta">
              <div>
                <h2>Need {title.toLowerCase()} for your site?</h2>
                <p>Share your requirement and our team will get back to you with a quote.</p>
              </div>
              <Link className="button button-primary" href="/#contact">
                Request Manpower <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default async function ServiceDetailPage({ params }) {
  const { slug } = await params;
  let service = null;
  let loadError = null;

  try {
    service = await getServiceBySlug(slug);
  } catch (error) {
    if (error && error.status === 404) notFound();
    loadError =
      (error && typeof error.message === "string" && error.message) ||
      "This service could not be loaded right now.";
  }

  if (!loadError && (!service || typeof service !== "object")) notFound();

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
              <div className="service-detail-actions">
                <a className="button button-outline" href={`/services/${encodeURIComponent(slug)}`}>
                  Try again
                </a>
                <Link className="button button-primary" href="/#services">
                  Back to services
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <ServiceContent service={service} />
        )}
      </main>
      <Footer />
    </SiteProvider>
  );
}
