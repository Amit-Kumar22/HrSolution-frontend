"use client";

import Link from "next/link";
import { Check } from "lucide-react";

export default function AuthShell({ title, subtitle, children, footer, asideTitle, asidePoints = [] }) {
  return (
    <main className="authPage">
      <section className="authAside">
        <Link href="/" className="authBrand" aria-label="Shakti Manpower home">
          <img className="panel-logo" src="/logo2.png" alt="Shakti Manpower" />
          <span className="authBrandCopy">
            <strong>Shakti Manpower</strong>
            <small>HR SOLUTIONS PORTAL</small>
          </span>
        </Link>
        <div className="authAsideBody">
          <h2>{asideTitle || "One account for your entire workforce."}</h2>
          {asidePoints.length > 0 && (
            <ul className="authAsideList">
              {asidePoints.map((point) => (
                <li key={point}>
                  <Check size={14} />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
        <small className="authCopyright">© 2026 Shakti Manpower Services Pvt. Ltd.</small>
      </section>

      <section className="authMain">
        <div className="authCard">
          <Link href="/" className="authMobileBrand" aria-label="Shakti Manpower home">
            <img className="panel-logo" src="/logo2.png" alt="Shakti Manpower" />
            <strong>Shakti Manpower</strong>
          </Link>
          <h1>{title}</h1>
          {subtitle && <p className="authSubtitle">{subtitle}</p>}
          {children}
          {footer}
        </div>
      </section>
    </main>
  );
}
