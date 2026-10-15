"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSalary(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return `₹${numeric.toLocaleString("en-IN")}`;
}

export function formatExperience(months) {
  const value = Number(months);
  if (!Number.isFinite(value) || value <= 0) return "Fresher";
  const years = Math.floor(value / 12);
  const rest = value % 12;
  const parts = [];
  if (years) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (rest) parts.push(`${rest} mo`);
  return parts.join(" ");
}

const STATUS_TONES = {
  APPLIED: "info",
  SCREENING: "info",
  SHORTLISTED: "progress",
  INTERVIEW_SCHEDULED: "progress",
  SELECTED: "success",
  OFFERED: "success",
  JOINED: "success",
  REJECTED: "blocked",
  ON_HOLD: "pending",
  WITHDRAWN: "muted",
};

export function statusTone(status) {
  return STATUS_TONES[status] || "info";
}

export function statusLabel(application) {
  if (application && typeof application.statusLabel === "string" && application.statusLabel.trim()) {
    return application.statusLabel.trim();
  }
  const status = application && application.status;
  if (!status) return "Unknown";
  return String(status)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="cp-state" role="status" aria-live="polite">
      <span className="cp-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry, retryLabel = "Try again" }) {
  return (
    <div className="cp-state cp-state--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="authButtonSecondary cp-stateButton" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="cp-state cp-state--empty">
      {title && <p className="cp-stateTitle">{title}</p>}
      {children && <p className="cp-stateText">{children}</p>}
      {action}
    </div>
  );
}

export function StatusBadge({ status, label }) {
  return <span className={`cp-badge cp-badge--${statusTone(status)}`}>{label || statusLabel({ status })}</span>;
}

export function Modal({ open, title, description, onClose, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cp-modalBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <div className={`cp-modalCard cp-modalCard--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="cp-modalHead">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="cp-modalClose" aria-label="Close dialog" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="cp-modalBody">{children}</div>
        {footer && <div className="cp-modalFooter">{footer}</div>}
      </div>
    </div>
  );
}
