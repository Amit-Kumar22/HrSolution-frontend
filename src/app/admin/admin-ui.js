"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";

export function useFlash(timeout = 4500) {
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);

  const showFlash = useCallback(
    (tone, message) => {
      setFlash({ tone, message });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), timeout);
    },
    [timeout],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [flash, showFlash];
}

export function FlashBanner({ flash }) {
  if (!flash) return null;
  return (
    <p className={flash.tone === "error" ? "actionError" : "actionSuccess"} role="status">
      {flash.message}
    </p>
  );
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function SectionHead({ title, description, action }) {
  return (
    <div className="cmHead">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="cmHeadAction">{action}</div>}
    </div>
  );
}

export function StatusPill({ published }) {
  return (
    <span className={`cmStatus ${published ? "cmStatusPublished" : "cmStatusDraft"}`}>
      <i />
      {published ? "Published" : "Draft"}
    </span>
  );
}

export function Switch({ checked, onChange, disabled = false, id, label }) {
  return (
    <label className={`cmSwitch${disabled ? " cmSwitchDisabled" : ""}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="cmSwitchTrack" aria-hidden="true"><i /></span>
      {label && <span className="cmSwitchLabel">{label}</span>}
    </label>
  );
}

export function Field({ label, htmlFor, required = false, error, hint, children }) {
  return (
    <label className={`cmField${error ? " cmFieldInvalid" : ""}`} htmlFor={htmlFor}>
      <span className="cmFieldLabel">
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {hint && !error && <small className="cmHint">{hint}</small>}
      {error && <small className="cmFieldError" role="alert">{error}</small>}
    </label>
  );
}

export function Notice({ tone = "info", children }) {
  return <p className={`cmNotice cmNotice-${tone}`}>{children}</p>;
}

export function Modal({ title, description, onClose, children, footer, wide = false }) {
  return (
    <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modalCard cmModalCard${wide ? " cmModalWide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modalHeader">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="modalClose" aria-label={`Close ${title}`} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
        {footer && <div className="cmModalFooter">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", busy = false, onConfirm, onCancel, children }) {
  return (
    <div className="modalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div className="modalCard cmConfirmCard" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="modalHeader">
          <div>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
        </div>
        {children && <div className="cmConfirmBody">{children}</div>}
        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="cmDangerButton cmBtn" onClick={onConfirm} disabled={busy}>
            {busy ? <><Loader2 size={15} className="spin" /> Working…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = AlertCircle, title, message }) {
  return (
    <div className="cmEmpty">
      <Icon size={22} />
      <strong>{title}</strong>
      {message && <p>{message}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="cmError" role="alert">
      <AlertCircle size={18} />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="secondaryButton cmBtn" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="cmLoading">
      <Loader2 size={18} className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function Chip({ tone = "neutral", children }) {
  return <span className={`cmChip cmChip-${tone}`}>{children}</span>;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
