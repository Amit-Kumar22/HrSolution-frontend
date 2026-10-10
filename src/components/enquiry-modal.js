"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import { submitEnquiry } from "@/lib/publicApi";
import FieldError from "./field-error";
import {
  LEAD_KNOWN_FIELDS,
  buildLeadPayload,
  pickApiFieldErrors,
  readLeadValues,
  resolveSuccessMessage,
  validateLead,
} from "@/lib/lead-form";

function EnquiryForm({ onClose, categories = [], categoriesLoading = false }) {
  const renderedAtRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [categoryChoice, setCategoryChoice] = useState("");

  useEffect(() => {
    renderedAtRef.current = Date.now();
  }, []);

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
    const validationErrors = validateLead(readLeadValues(formData));

    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setStatus({ state: "error", message: "Please fill in the required details to continue." });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setStatus({ state: "submitting", message: "" });

    try {
      const result = await submitEnquiry(buildLeadPayload(formData, renderedAtRef.current));
      form.reset();
      setCategoryChoice("");
      renderedAtRef.current = Date.now();
      setStatus({
        state: "success",
        message: resolveSuccessMessage(
          result,
          "Thank you — your enquiry has been received. Our team will contact you shortly.",
        ),
      });
    } catch (error) {
      const apiFieldErrors = pickApiFieldErrors(error, LEAD_KNOWN_FIELDS);
      if (Object.keys(apiFieldErrors).length) setFieldErrors(apiFieldErrors);
      setStatus({
        state: "error",
        message:
          (error && typeof error.message === "string" && error.message) ||
          "Your enquiry could not be sent. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label htmlFor="enquiry-companyName">
          Company name *
          <input
            id="enquiry-companyName"
            name="companyName"
            placeholder="Company or organisation"
            aria-required="true"
            aria-invalid={fieldErrors.companyName ? "true" : undefined}
            onChange={() => clearFieldError("companyName")}
          />
          <FieldError message={fieldErrors.companyName} />
        </label>
        <label htmlFor="enquiry-contactPerson">
          Contact person *
          <input
            id="enquiry-contactPerson"
            name="contactPerson"
            placeholder="Your name"
            aria-required="true"
            aria-invalid={fieldErrors.contactPerson ? "true" : undefined}
            onChange={() => clearFieldError("contactPerson")}
          />
          <FieldError message={fieldErrors.contactPerson} />
        </label>
        <label htmlFor="enquiry-phone">
          Phone *
          <input
            id="enquiry-phone"
            name="phone"
            type="tel"
            placeholder="10-digit mobile number"
            aria-required="true"
            aria-invalid={fieldErrors.phone ? "true" : undefined}
            onChange={() => clearFieldError("phone")}
          />
          <FieldError message={fieldErrors.phone} />
        </label>
        <label htmlFor="enquiry-email">
          Email
          <input
            id="enquiry-email"
            name="email"
            type="email"
            placeholder="you@company.com"
            aria-invalid={fieldErrors.email ? "true" : undefined}
            onChange={() => clearFieldError("email")}
          />
          <FieldError message={fieldErrors.email} />
        </label>
        <label htmlFor="enquiry-categoryId">
          Manpower requirement
          <select
            id="enquiry-categoryId"
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
        {categoryChoice === "other" && (
          <label htmlFor="enquiry-otherCategory">
            Describe your requirement
            <input
              id="enquiry-otherCategory"
              name="otherCategory"
              placeholder="e.g. Forklift operators"
              onChange={() => clearFieldError("otherCategory")}
            />
          </label>
        )}
        <label className="form-message" htmlFor="enquiry-message">
          Message
          <textarea
            id="enquiry-message"
            name="message"
            rows="3"
            placeholder="Roles, headcount, site location or start date"
            onChange={() => clearFieldError("message")}
          />
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
            Send Enquiry <ArrowRight size={16} />
          </>
        )}
      </button>

      {status.state === "success" && (
        <p className="form-success" role="status">
          {status.message}
        </p>
      )}
      {status.state === "error" && (
        <p className="form-error" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}

export default function EnquiryModal({ open, onClose, categories = [], categoriesLoading = false }) {
  useEffect(() => {
    if (!open) return undefined;
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Request manpower enquiry"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="enquiry-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close enquiry form">
          <X size={17} />
        </button>
        <span className="eyebrow">REQUEST MANPOWER</span>
        <h3>Tell us what your team needs</h3>
        <p className="modal-sub">
          Company name, contact person and phone are all we need — everything else is optional.
        </p>
        <EnquiryForm
          onClose={onClose}
          categories={categories}
          categoriesLoading={categoriesLoading}
        />
      </div>
    </div>
  );
}
