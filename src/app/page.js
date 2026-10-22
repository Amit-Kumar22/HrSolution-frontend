"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  Clock3,
  FileCheck2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import FieldError from "@/components/field-error";
import PublicImage from "@/components/public-image";
import PublicJobCard from "@/components/public-job-card";
import { Footer, Navbar, ProfileBanner, buildAddress, companyNameOf } from "@/components/site-chrome";
import { SiteProvider, useSite } from "@/components/site-provider";
import { INDUSTRY_ICONS, SERVICE_ICONS } from "@/lib/public-icons";
import { listPublicJobs, resolvePublicFileUrl, submitContactMessage, toTelHref } from "@/lib/publicApi";
import {
  LEAD_KNOWN_FIELDS,
  buildContactPayload,
  pickApiFieldErrors,
  readLeadValues,
  resolveSuccessMessage,
  validateLead,
} from "@/lib/lead-form";

const DEFAULT_HERO_TEXT =
  "We provide reliable, skilled and workforce-ready manpower solutions that help businesses build efficient teams and manage their workforce with confidence.";
const DEFAULT_ABOUT_PARAGRAPHS = [
  "We connect businesses with dependable and qualified manpower across multiple industries. Our workforce solutions are designed to meet changing business requirements with the right people, skills and support.",
  "From professional recruitment to on-site coordination, our team makes workforce planning simpler, more flexible and reliable.",
];

const benefits = [
  { icon: Clock3, title: "48–72 hr deployment", text: "Ready bench of verified workers across Jharkhand, Bihar and Bengal." },
  { icon: BadgeCheck, title: "Background-verified", text: "Police verification, identity checks and previous employer references." },
  { icon: ShieldCheck, title: "Statutory compliance", text: "PF, ESI, PT, LWF and labour licence documentation, kept current." },
  { icon: FileCheck2, title: "One clear invoice", text: "Consolidated monthly billing with attendance and payroll backup." },
  { icon: Phone, title: "Dedicated support", text: "One point of contact, escalation support and regular reviews." },
  { icon: MapPin, title: "Local presence", text: "On-ground coordination in Ranchi, Jamshedpur, Dhanbad and Patna." },
];

const process = [
  ["01", "Share your requirement", "Tell us the role, headcount, site and start date."],
  ["02", "We source & verify", "Screening, skill checks and background verification."],
  ["03", "Approve your shortlist", "Review suitable candidates and confirm your team."],
  ["04", "Deploy & support", "Workers report ready; our team stays in touch."],
];

const COMPANY_STATS = [
  { target: 5000, suffix: "+", label: "Workers deployed" },
  { target: 120, suffix: "+", label: "Client companies" },
  { target: 18, suffix: "", label: "Cities covered" },
  { target: 14, suffix: " yrs", label: "Industry experience" },
  { target: 100, suffix: "%", label: "Statutory compliance" },
];

function SectionHeading({ eyebrow, title, text, light = false }) {
  return (
    <div className={`section-heading${light ? " section-heading-light" : ""}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function SkeletonGrid({ className, count }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index} />
      ))}
    </div>
  );
}

function SectionFeedback({ message, onRetry }) {
  return (
    <div className="section-feedback" role="alert">
      <span className="section-feedback-icon">
        <AlertCircle size={17} />
      </span>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

const HERO_TEAM = [
  { initials: "RS", tone: "a" },
  { initials: "AK", tone: "b" },
  { initials: "MJ", tone: "c" },
  { initials: "PV", tone: "d" },
];

function HeroArtwork() {
  return (
    <div className="hero-art" aria-label="Workforce deployment dashboard illustration" role="img">
      <span className="art-glow art-glow-a" />
      <span className="art-glow art-glow-b" />
      <span className="art-grid" />
      <div className="art-orbit" />
      <div className="deployed-card">
        <span className="icon-tile icon-amber"><UsersRound size={22} /></span>
        <span><strong>5,000+</strong><small>Workers deployed</small></span>
      </div>
      <div className="deployment-card">
        <div className="deployment-head">
          <div><strong>Plant workforce</strong><small>Jamshedpur · Requisition #RQ-2026-0418</small></div>
          <span className="status-pill"><i /> In progress</span>
        </div>
        <div className="progress-label"><span>Workers deployed</span><b>42 / 50</b></div>
        <div className="progress-track"><span /></div>
        <div className="role-counts">
          <div><b>24</b><span>Security guard</span></div>
          <div><b>12</b><span>Helper</span></div>
          <div><b>6</b><span>Operator</span></div>
        </div>
        <div className="deployment-team">
          <span className="avatar-stack">
            {HERO_TEAM.map((member) => (
              <i className={`avatar avatar-${member.tone}`} key={member.initials}>{member.initials}</i>
            ))}
          </span>
          <span className="deployment-team-note">42 verified on site today</span>
        </div>
        <div className="chart-head"><span>Deployments · last 7 days</span><b>+18%</b></div>
        <div className="mini-chart">
          <i /><i /><i /><i /><i /><i /><i />
        </div>
      </div>
      <div className="compliance-card">
        <span className="icon-tile icon-green"><FileCheck2 size={19} /></span>
        <span><strong>PF ECR filed · Sep 2026</strong><small>Monthly compliance record</small></span>
      </div>
      <div className="live-chip"><i /> Live workforce tracking</div>
      <span className="art-dot dot-one" /><span className="art-dot dot-two" />
    </div>
  );
}

function Hero() {
  const { profile, openEnquiry } = useSite();
  const paragraph = profile?.tagline?.trim() || DEFAULT_HERO_TEXT;

  return (
    <section className="hero section-soft" id="home">
      <span className="hero-mesh" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="trust-pill"><i /> Trusted by 120+ companies across Eastern India</span>
          <h1>
            Reliable Manpower.<br />
            Stronger Workforce.<br />
            <span className="headline-accent">Better Business.</span>
          </h1>
          <p>{paragraph}</p>
          <div className="hero-actions">
            <button type="button" className="button button-primary hero-cta" onClick={openEnquiry}>
              <span className="hero-cta-label">Hire Manpower</span> <ArrowRight size={16} className="hero-cta-arrow" />
            </button>
            <button type="button" className="button button-outline" onClick={openEnquiry}>
              Get a Quote
            </button>
          </div>
          <div className="hero-assurances">
            <span><ShieldCheck size={16} /> PF &amp; ESI compliant</span>
            <span><BadgeCheck size={16} /> Verified workforce</span>
            <span><Clock3 size={16} /> 48–72 hr deployment</span>
          </div>
        </div>
        <HeroArtwork />
      </div>
    </section>
  );
}

function TrustedEmployers() {
  const sectors = ["STEEL & METALS", "MINING", "HEALTHCARE", "LOGISTICS", "RETAIL", "GOVERNMENT"];
  return (
    <section className="trusted-employers" aria-label="Industries served">
      <div className="container">
        <p>TRUSTED BY LEADING EMPLOYERS</p>
        <div className="employer-list">
          {sectors.map((sector) => <span key={sector}>{sector}</span>)}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const statsRef = useRef(null);
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    const element = statsRef.current;
    if (!element || !("IntersectionObserver" in window)) return;

    let frameId;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setCounts(COMPANY_STATS.map(({ target }) => target));
        return;
      }

      setCounts(COMPANY_STATS.map(() => 1));
      let startTime;
      const duration = 1800;
      const animate = (timestamp) => {
        if (startTime === undefined) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easedProgress = 1 - (1 - progress) ** 3;
        setCounts(COMPANY_STATS.map(({ target }) => Math.floor(1 + (target - 1) * easedProgress)));

        if (progress < 1) {
          frameId = window.requestAnimationFrame(animate);
        } else {
          setCounts(COMPANY_STATS.map(({ target }) => target));
        }
      };

      frameId = window.requestAnimationFrame(animate);
    }, { threshold: 0.25 });

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section className="stats-band" aria-label="Company statistics">
      <div className="container stats-grid" ref={statsRef}>
        {COMPANY_STATS.map(({ target, suffix, label }, index) => {
          const value = counts?.[index] ?? target;
          const formattedValue = `${value.toLocaleString("en-US")}${suffix}`;
          const finalValue = `${target.toLocaleString("en-US")}${suffix}`;
          return (
            <div className="stat" key={label}>
              <strong aria-label={finalValue}>{formattedValue}</strong>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function About() {
  const { profile } = useSite();
  const highlights = ["Skilled workforce", "Flexible staffing", "Quick deployment", "Professional recruitment"];
  const paragraphs = profile?.about
    ? String(profile.about).split(/\n+/).map((part) => part.trim()).filter(Boolean)
    : [];
  const content = paragraphs.length ? paragraphs : DEFAULT_ABOUT_PARAGRAPHS;

  return (
    <section className="section section-white" id="about">
      <div className="container about-grid">
        <div className="about-visual">
          <div className="about-number"><strong>14</strong><span>years connecting<br />people &amp; opportunity</span></div>
          <div className="about-note"><span className="icon-tile icon-green"><Check size={18} /></span><span><strong>People-first, site-ready</strong><small>Dependable support from day one</small></span></div>
          <span className="about-stamp">EASTERN INDIA<br /><b>WORKFORCE PARTNER</b></span>
        </div>
        <div className="about-copy">
          <span className="eyebrow">ABOUT {companyNameOf(profile).toUpperCase()}</span>
          <h2>Your Trusted<br />Workforce Partner</h2>
          {content.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <div className="about-highlights">{highlights.map((item) => <span key={item}><Check size={15} />{item}</span>)}</div>
          <a className="text-link" href="#services">Discover our services <ArrowRight size={15} /></a>
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ service }) {
  const Icon = SERVICE_ICONS[String(service.icon || "").trim().toLowerCase()] || BriefcaseBusiness;
  const heroImage = resolvePublicFileUrl(service.heroImageUrl);
  const summary = service.summary || service.description || "";
  const href = service.slug
    ? `/services/${encodeURIComponent(service.slug)}`
    : "#services";

  const handleClick = (e) => {
    const target = e.target;
    if (target instanceof Element && (target.closest('a') || target.closest('button'))) return;
    window.location.href = href;
  };

  return (
    <article className="service-card" tabIndex={0} role="link" aria-label={`Learn more about ${service.title}`} onClick={handleClick} onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = href;
      }
    }}>
      {heroImage && (
        <PublicImage src={heroImage} alt={service.title || ""} className="service-card-image" fallback={null} />
      )}
      <span className="icon-tile icon-blue"><Icon size={20} /></span>
      <h3>{service.title}</h3>
      {summary && <p>{summary}</p>}
      <Link href={href} aria-label={`Learn more about ${service.title}`} onClick={(e) => e.stopPropagation()}>
        Learn more <ArrowRight size={14} />
      </Link>
    </article>
  );
}

function Services() {
  const { services, loading, servicesError, reload } = useSite();
  if (!loading && !servicesError && services.length === 0) return null;

  return (
    <section className="section section-soft" id="services">
      <div className="container">
        <SectionHeading eyebrow="OUR SERVICES" title="One partner for your entire contract workforce" text="From sourcing to salary — we take care of hiring, deployment, payroll and compliance so your team can focus on production." />
        {loading && <SkeletonGrid className="service-grid" count={6} />}
        {!loading && servicesError && <SectionFeedback message={servicesError} onRetry={reload} />}
        {!loading && !servicesError && services.length > 0 && (
          <div className="service-grid">
            {services.map((service) => (
              <ServiceCard key={service.slug || service.title} service={service} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Industries() {
  const { industries, loading, industriesError, reload } = useSite();
  if (!loading && !industriesError && industries.length === 0) return null;

  return (
    <section className="section industry-section" id="industries" aria-labelledby="industries-title">
      <div className="container">
        <div className="industry-heading">
          <div>
            <span className="eyebrow">INDUSTRIES WE SERVE</span>
            <h2 id="industries-title">Workforce for every <span>shop floor</span></h2>
          </div>
          <p>Category-wise trained manpower matched to the minimum wage, shift and safety norms of your sector.</p>
        </div>
        {loading && <SkeletonGrid className="industry-grid" count={8} />}
        {!loading && industriesError && <SectionFeedback message={industriesError} onRetry={reload} />}
        {!loading && !industriesError && industries.length > 0 && (
          <div className="industry-grid">
            {industries.map((industry, index) => {
              const Icon = INDUSTRY_ICONS[String(industry.icon || "").trim().toLowerCase()] || Building2;
              return (
                <article className="industry-card" key={industry.slug || industry.name} tabIndex={0}>
                  <div className="industry-card-top">
                    <span className="icon-tile icon-amber-light"><Icon size={20} /></span>
                    <span className="industry-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{industry.name}</h3>
                  {industry.description && <p>{industry.description}</p>}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function WhyChooseUs() {
  return (
    <section className="section section-soft" id="why-us">
      <div className="container why-grid">
        <div className="why-intro">
          <span className="eyebrow">WHY CHOOSE US</span>
          <h2>Built for compliance-heavy industries</h2>
          <p>Plant heads and HR teams choose us because audits stop being a headache — every worker, wage and challan is on record.</p>
          <blockquote>“Our compliance checks are organised, documented and ready when you need them.”<cite>— Our workforce support promise</cite></blockquote>
        </div>
        <div className="benefit-grid">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article className="benefit" key={title}>
              <span className="icon-tile icon-green"><Icon size={20} /></span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function JobOpenings() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listPublicJobs({ page: 0, size: 3 })
      .then((data) => {
        if (cancelled) return;
        setJobs(data.content);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("Job openings could not be loaded right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="section careers-section" id="careers">
      <div className="container">
        <div className="careers-heading">
          <div>
            <span className="eyebrow">CAREERS</span>
            <h2>Latest job openings</h2>
            <p>Verified employers, PF &amp; ESI benefits, salary on time — every month.</p>
          </div>
          <Link className="button button-outline" href="/careers">
            Browse all jobs <ArrowRight size={15} />
          </Link>
        </div>
        {loading ? (
          <SkeletonGrid className="job-grid" count={3} />
        ) : jobs.length > 0 ? (
          <div className="job-grid">
            {jobs.map((job) => (
              <PublicJobCard key={job.slug || job.id || job.title} job={job} />
            ))}
          </div>
        ) : (
          <div className="careers-empty">
            <h3>No open vacancies right now</h3>
            <p>{error || "Please check back soon for new openings."}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="section process-section" id="process">
      <div className="container">
        <SectionHeading eyebrow="HOW IT WORKS" title="From requirement to deployment in 4 steps" text="A simple, documented process your HR and operations teams will appreciate." light />
        <div className="process-grid">
          {process.map(([number, title, text]) => (
            <article className="process-step" key={number}>
              <span className="step-number">{number}</span><span className="step-line" />
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ item }) {
  const name = item.clientName || "";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "?";
  const rating = Math.max(0, Math.min(5, Math.round(Number(item.rating) || 0)));
  const photoUrl = resolvePublicFileUrl(item.photoUrl);
  const logoUrl = resolvePublicFileUrl(item.logoUrl);
  const detail =
    [item.designation, item.clientCompany].filter(Boolean).join(" · ") || item.attribution || "";
  const content = item.content || "";

  return (
    <article className="testimonial-card">
      {rating > 0 && (
        <div className="stars" aria-label={`${rating} out of 5 stars`}>
          {"★".repeat(rating)}{"☆".repeat(5 - rating)}
        </div>
      )}
      {content && <p>“{content}”</p>}
      <div className="client">
        <span>
          {photoUrl ? (
            <PublicImage src={photoUrl} alt={name} className="client-photo" fallback={initials} />
          ) : (
            initials
          )}
        </span>
        <div>
          {name && <strong>{name}</strong>}
          {detail && <small>{detail}</small>}
        </div>
        {logoUrl && <PublicImage src={logoUrl} alt="" className="client-logo" fallback={null} />}
      </div>
    </article>
  );
}

function Testimonials() {
  const { testimonials, loading, testimonialsError, reload } = useSite();
  const showList = !loading && !testimonialsError && testimonials.length > 0;
  const showEmpty = !loading && !testimonialsError && testimonials.length === 0;

  return (
    <section className="section section-white" id="testimonials">
      <div className="container">
        <SectionHeading
          eyebrow="CLIENT STORIES"
          title="What our clients value"
          text="Real feedback from businesses that rely on our workforce teams every day."
        />
        {loading && <SkeletonGrid className="testimonial-grid" count={3} />}
        {!loading && testimonialsError && <SectionFeedback message={testimonialsError} onRetry={reload} />}
        {showList && (
          <div className="testimonial-grid">
            {testimonials.map((item, index) => (
              <TestimonialCard key={item.id ?? index} item={item} />
            ))}
          </div>
        )}
        {showList && (
          <div className="carousel-dots" aria-hidden="true"><i /><i /><i /></div>
        )}
        {showEmpty && (
          <div className="testimonial-empty">
            <PublicImage
              src="/t.png"
              alt="Client testimonials"
              className="testimonial-empty-image"
              fallback={null}
            />
            <p>Client stories will appear here soon.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Cta() {
  const { profile, openEnquiry } = useSite();
  const phone = profile?.phone;

  return (
    <section className="section section-soft cta-wrap">
      <div className="container cta-panel">
        <div><h2>Need reliable manpower for your business?</h2><p>Tell us your workforce requirements and let our team help you find the right people.</p></div>
        <div className="cta-actions">
          {phone && (
            <a href={toTelHref(phone)} className="cta-phone"><Phone size={17} /> {phone}</a>
          )}
          <button type="button" className="button button-primary" onClick={openEnquiry}>
            Request Manpower <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const { profile, categories, categoriesLoading, categoriesError } = useSite();
  const renderedAtRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [categoryChoice, setCategoryChoice] = useState("");

  useEffect(() => {
    renderedAtRef.current = Date.now();
  }, []);

  const phone = profile?.phone;
  const email = profile?.supportEmail || profile?.email;
  const address = buildAddress(profile);

  function clearFieldError(fieldName) {
    setFieldErrors((previous) => {
      if (!previous[fieldName]) return previous;
      const next = { ...previous };
      delete next[fieldName];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = readLeadValues(formData);
    const validationErrors = validateLead(values);
    if (!values.email) validationErrors.email = "Email address is required.";
    if (!String(formData.get("message") || "").trim()) {
      validationErrors.message = "Message is required.";
    }

    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setStatus({ state: "error", message: "Please fill in the required details to continue." });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setStatus({ state: "submitting", message: "" });

    try {
      const result = await submitContactMessage(
        buildContactPayload(formData, renderedAtRef.current),
      );
      form.reset();
      setCategoryChoice("");
      renderedAtRef.current = Date.now();
      setStatus({
        state: "success",
        message: resolveSuccessMessage(
          result,
          "Thank you — your message has been received. Our team will get back to you shortly.",
        ),
      });
    } catch (error) {
      const apiFieldErrors = pickApiFieldErrors(error, ["name", ...LEAD_KNOWN_FIELDS]);
      if (apiFieldErrors.name) {
        apiFieldErrors.contactPerson = apiFieldErrors.contactPerson || apiFieldErrors.name;
        delete apiFieldErrors.name;
      }
      if (Object.keys(apiFieldErrors).length) setFieldErrors(apiFieldErrors);
      setStatus({
        state: "error",
        message:
          (error && typeof error.message === "string" && error.message) ||
          "Your message could not be sent. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section section-white" id="contact">
      <div className="container contact-grid">
        <div className="contact-copy">
          <span className="eyebrow">LET’S GET TO WORK</span>
          <h2>Tell us what your team needs.</h2>
          <p>Share a few details and our workforce team will get back to you within two working hours.</p>
          {phone && (
            <div className="contact-detail">
              <span className="icon-tile icon-amber-light"><Phone size={18} /></span>
              <div><small>Call our team</small><a href={toTelHref(phone)}>{phone}</a></div>
            </div>
          )}
          {email && (
            <div className="contact-detail">
              <span className="icon-tile icon-amber-light"><Mail size={18} /></span>
              <div><small>Email us</small><a href={`mailto:${email}`}>{email}</a></div>
            </div>
          )}
          {address && (
            <div className="contact-detail">
              <span className="icon-tile icon-amber-light"><MapPin size={18} /></span>
              <div><small>Our office</small><span>{address}</span></div>
            </div>
          )}
        </div>

        <form className="enquiry-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <label htmlFor="contact-contactPerson">
              Contact person *
              <input
                id="contact-contactPerson"
                name="contactPerson"
                placeholder="Your name"
                aria-required="true"
                aria-invalid={fieldErrors.contactPerson ? "true" : undefined}
                onChange={() => clearFieldError("contactPerson")}
              />
              <FieldError message={fieldErrors.contactPerson} />
            </label>
            <label htmlFor="contact-companyName">
              Company name *
              <input
                id="contact-companyName"
                name="companyName"
                placeholder="Company or organisation"
                aria-required="true"
                aria-invalid={fieldErrors.companyName ? "true" : undefined}
                onChange={() => clearFieldError("companyName")}
              />
              <FieldError message={fieldErrors.companyName} />
            </label>
            <label htmlFor="contact-email">
              Email address *
              <input
                id="contact-email"
                name="email"
                type="email"
                placeholder="you@company.com"
                aria-required="true"
                aria-invalid={fieldErrors.email ? "true" : undefined}
                onChange={() => clearFieldError("email")}
              />
              <FieldError message={fieldErrors.email} />
            </label>
            <label htmlFor="contact-phone">
              Phone number *
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                placeholder="10-digit mobile number"
                aria-required="true"
                aria-invalid={fieldErrors.phone ? "true" : undefined}
                onChange={() => clearFieldError("phone")}
              />
              <FieldError message={fieldErrors.phone} />
            </label>
            <label htmlFor="contact-city">
              City
              <input
                id="contact-city"
                name="city"
                placeholder="City"
                onChange={() => clearFieldError("city")}
              />
            </label>
            <label htmlFor="contact-state">
              State
              <input
                id="contact-state"
                name="state"
                placeholder="State"
                onChange={() => clearFieldError("state")}
              />
            </label>
            <label htmlFor="contact-categoryId">
              Manpower requirement
              <select
                id="contact-categoryId"
                name="categoryId"
                value={categoryChoice}
                onChange={(event) => {
                  setCategoryChoice(event.target.value);
                  clearFieldError("categoryId");
                }}
              >
                <option value="">
                  {categoriesLoading && !categories.length ? "Loading options…" : "Select a requirement"}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
                <option value="other">Other (please specify)</option>
              </select>
            </label>
            <label htmlFor="contact-numberOfWorkers">
              Number of workers
              <input
                id="contact-numberOfWorkers"
                name="numberOfWorkers"
                type="number"
                min="1"
                placeholder="e.g. 25"
                onChange={() => clearFieldError("numberOfWorkers")}
              />
            </label>
            {categoryChoice === "other" && (
              <label htmlFor="contact-otherCategory">
                Describe your requirement
                <input
                  id="contact-otherCategory"
                  name="otherCategory"
                  placeholder="e.g. Forklift operators"
                  onChange={() => clearFieldError("otherCategory")}
                />
              </label>
            )}
            <label htmlFor="contact-durationMonths">
              Duration (months)
              <input
                id="contact-durationMonths"
                name="durationMonths"
                type="number"
                min="1"
                placeholder="e.g. 12"
                onChange={() => clearFieldError("durationMonths")}
              />
            </label>
            <label htmlFor="contact-requiredFrom">
              Required from
              <input
                id="contact-requiredFrom"
                name="requiredFrom"
                type="date"
                onChange={() => clearFieldError("requiredFrom")}
              />
            </label>
            <label className="form-message" htmlFor="contact-message">
              Message *
              <textarea
                id="contact-message"
                name="message"
                rows="3"
                placeholder="Tell us about roles, shifts or your start date"
                aria-required="true"
                aria-invalid={fieldErrors.message ? "true" : undefined}
                onChange={() => clearFieldError("message")}
              />
              <FieldError message={fieldErrors.message} />
            </label>
          </div>

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
                <Loader2 size={16} className="spin" /> Sending…
              </>
            ) : (
              <>
                Submit <ArrowRight size={16} />
              </>
            )}
          </button>

          {status.state === "success" && (
            <p className="form-success" role="status">{status.message}</p>
          )}
          {status.state === "error" && (
            <p className="form-error" role="alert">{status.message}</p>
          )}

          {categoriesError && (
            <small className="form-note">
              Requirement options could not be loaded — choose “Other (please specify)” to describe
              what you need.
            </small>
          )}
          <small className="form-note">
            Your details go straight to our workforce team. We never share your information.
          </small>
        </form>
      </div>
    </section>
  );
}

function HomeContent() {
  return (
    <>
      <Navbar />
      <ProfileBanner />
      <main>
        <Hero />
        <TrustedEmployers />
        <Stats />
        <About />
        <Services />
        <Industries />
        <Process />
        <WhyChooseUs />
        <JobOpenings />
        <Testimonials />
        <Cta />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

export default function Home() {
  return (
    <SiteProvider>
      <HomeContent />
    </SiteProvider>
  );
}
