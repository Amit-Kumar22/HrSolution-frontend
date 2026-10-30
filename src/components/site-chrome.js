"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronDown,
  Clock3,
  Mail,
  MapPin,
  Menu,
  Phone,
  X,
} from "lucide-react";
import PublicImage from "./public-image";
import { resolvePublicFileUrl, toTelHref } from "@/lib/publicApi";
import { useSite } from "./site-provider";

const DEFAULT_NAME = "Shree Manpower";
const DEFAULT_FOOTER_TEXT =
  "HR solutions and manpower supply partner for industries across Jharkhand, Bihar, West Bengal and Odisha since 2012.";
const DEFAULT_FOOTER_SERVICES = [
  "Manpower supply",
  "Security services",
  "Recruitment",
  "Payroll outsourcing",
  "Statutory compliance",
  "Housekeeping",
];

const NAV_ITEMS = [
  ["Home", "/#home"],
  ["About Us", "/#about"],
  ["Services", "/#services"],
  ["Industries", "/#industries"],
  ["Manpower", "/#manpower"],
  ["Careers", "/careers"],
  ["Contact Us", "/#contact"],
];

export function companyNameOf(profile) {
  return profile?.tradeName || profile?.legalName || DEFAULT_NAME;
}

export function legalNameOf(profile) {
  return profile?.legalName || profile?.tradeName || DEFAULT_NAME;
}

export function buildAddress(profile) {
  if (!profile) return "";
  const locality = [profile.city, profile.state].filter(Boolean).join(", ");
  const localityWithPin = [locality, profile.pincode].filter(Boolean).join(" ");
  return [
    profile.addressLine1,
    profile.addressLine2,
    localityWithPin,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");
}

const SITE_YEAR = new Date().getFullYear();

export function Brand({ footer = false }) {
  const { profile } = useSite();
  const name = companyNameOf(profile);
  const logoUrl = "/logo2.png";
  const letter = (name.trim()[0] || "M").toUpperCase();

  return (
    <Link href="/#home" className={`brand${footer ? " brand-footer" : ""}`} aria-label={`${name} home`}>
      <span className="brand-mark">
        <PublicImage src={logoUrl} alt="" className="brand-logo" fallback={letter} />
      </span>
      <span className="brand-copy">
        <strong>{name}</strong>
        {!footer && <small>HR SOLUTIONS · SINCE 2012</small>}
      </span>
    </Link>
  );
}

function Topbar() {
  const { profile } = useSite();
  const phone = profile?.phone;
  const email = "info@pubes.in";
  const location = [profile?.city, profile?.state].filter(Boolean).join(", ");

  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <div className="topbar-contact">
          {phone && (
            <a href={toTelHref(phone)}>
              <Phone size={13} /> {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`}>
              <Mail size={13} /> {email}
            </a>
          )}
        </div>
        <p>
          Mon–Sat · 9:30 AM–6:30 PM {location && <><span>│</span> {location}</>}
        </p>
      </div>
    </div>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { openEnquiry } = useSite();

  return (
    <>
      <Topbar />
      <header className="site-header">
        <div className="container nav-inner">
          <Brand />
          <nav className={`main-nav${open ? " nav-open" : ""}`} aria-label="Main navigation">
            {NAV_ITEMS.map(([label, href]) =>
              href.startsWith("/careers") ? (
                <Link key={label} href={href} onClick={() => setOpen(false)}>
                  {label}
                </Link>
              ) : (
                <a key={label} href={href} onClick={() => setOpen(false)}>
                  {label}
                  {label === "Services" && <ChevronDown size={14} />}
                </a>
              ),
            )}
            <div className="nav-actions">
              <a className="button button-outline nav-login" href="/login" onClick={() => setOpen(false)}>
                Login
              </a>
              <button
                type="button"
                className="button button-primary nav-cta"
                onClick={() => {
                  setOpen(false);
                  openEnquiry();
                }}
              >
                Request Manpower
              </button>
            </div>
          </nav>
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
    </>
  );
}

export function ProfileBanner() {
  const { profileError, loading, reload } = useSite();
  if (!profileError) return null;

  return (
    <div className="api-banner" role="alert">
      <span>
        <AlertCircle size={14} /> {profileError}
      </span>
      <button type="button" onClick={reload} disabled={loading}>
        {loading ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

export function Footer() {
  const { profile, services, loading, servicesError, reload } = useSite();
  const legalName = legalNameOf(profile);
  const address = buildAddress(profile);
  const phone = profile?.phone;
  const email = "info@pubes.in";
  const tagline = profile?.tagline?.trim() || DEFAULT_FOOTER_TEXT;
  const year = SITE_YEAR;

  const complianceTags = [
    ["GSTIN", profile?.gstin],
    ["PF Code", profile?.pfEstablishmentCode],
    ["ESIC", profile?.esiEstablishmentCode],
    ["CLRA Licence", profile?.clraLicenceNumber || profile?.clraLicenseNumber],
    ["PSARA", profile?.psaraLicenceNumber || profile?.psaraLicenseNumber],
  ];

  const showServicesError = Boolean(servicesError) && !loading;

  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-company">
          <Brand footer />
          <p>{tagline}</p>
          <ul className="footer-contact">
            {address && (
              <li>
                <MapPin size={15} />
                {address}
              </li>
            )}
            {phone && (
              <li>
                <Phone size={15} />
                <a href={toTelHref(phone)}>{phone}</a>
              </li>
            )}
            {email && (
              <li>
                <Mail size={15} />
                <a href={`mailto:${email}`}>{email}</a>
              </li>
            )}
            <li>
              <Clock3 size={15} />
              Mon–Sat · 9:30 AM–6:30 PM
            </li>
          </ul>
        </div>

        <div className="footer-column">
          <h3>COMPANY</h3>
          <Link href="/#about">About us</Link>
          <Link href="/#industries">Industries</Link>
          <Link href="/careers">Careers</Link>
          <Link href="/login">Client login</Link>
          <Link href="/#contact">Contact</Link>
        </div>

        <div className="footer-column">
          <h3>SERVICES</h3>
          {services.length > 0
            ? services.map((service) =>
                service.slug ? (
                  <Link
                    key={service.slug}
                    href={`/services/${encodeURIComponent(service.slug)}`}
                  >
                    {service.title}
                  </Link>
                ) : (
                  <span key={service.title}>{service.title}</span>
                ),
              )
            : DEFAULT_FOOTER_SERVICES.map((service) => (
                <Link key={service} href="/#services">
                  {service}
                </Link>
              ))}
          {showServicesError && (
            <button
              type="button"
              className="footer-retry"
              onClick={reload}
            >
              Retry loading services
            </button>
          )}
        </div>

        <div className="footer-column">
          <h3>FOR JOB SEEKERS</h3>
          <Link href="/careers">Current openings</Link>
          <Link href="/register/candidate">Register as candidate</Link>
          <Link href="/login">Worker login</Link>
          <Link href="/#contact">Download payslip</Link>
          <Link href="/#contact">FAQs</Link>
        </div>
      </div>

      <div className="container compliance-tags">
        {complianceTags.map(([label, value]) => (
          <span key={label}>{label}{value ? ` ${value}` : ""}</span>
        ))}
      </div>

      <div className="container footer-bottom">
        <p>
          © {year} {legalName}. All rights reserved.
        </p>
        <div>
          <Link href="/#contact">Privacy Policy</Link>
          <Link href="/#contact">Terms of Service</Link>
          <Link href="/#contact">Grievance Officer</Link>
        </div>
      </div>
    </footer>
  );
}
