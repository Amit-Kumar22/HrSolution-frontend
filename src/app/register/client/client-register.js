"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, TriangleAlert } from "lucide-react";
import AuthShell from "@/components/auth-shell";
import FieldError from "@/components/field-error";
import { registerClient } from "@/lib/authApi";
import {
  normalizeAuthEmail,
  normalizeAuthPhone,
  passwordHints,
  pickRegistrationErrors,
  validateClientForm,
} from "@/lib/auth-forms";

function successMessage(result) {
  if (result && typeof result.message === "string" && result.message.trim()) return result.message.trim();
  return "Your company registration has been received and is awaiting administrator approval.";
}

export default function ClientRegister() {
  const [values, setValues] = useState({
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    consentGiven: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);

  function update(fieldName, value) {
    setValues((previous) => ({ ...previous, [fieldName]: value }));
    clearError(fieldName);
  }

  function clearError(fieldName) {
    if (fieldErrors[fieldName]) {
      setFieldErrors((previous) => {
        const next = { ...previous };
        delete next[fieldName];
        return next;
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setStatus({ state: "idle", message: "" });

    const formValues = {
      ...values,
      email: normalizeAuthEmail(values.email),
      phone: normalizeAuthPhone(values.phone),
    };
    const errors = validateClientForm(formValues);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatus({ state: "error", message: "Please fix the highlighted fields and try again." });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await registerClient({
        companyName: formValues.companyName.trim(),
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        email: formValues.email,
        phone: formValues.phone,
        password: values.password,
        consentGiven: true,
      });
      setStatus({ state: "success", message: successMessage(result) });
    } catch (error) {
      const apiErrors = pickRegistrationErrors(error);
      if (Object.keys(apiErrors).length) setFieldErrors(apiErrors);
      setStatus({ state: "error", message: (error && error.message) || "Registration failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Register your company"
      subtitle="Create a client account to manage requisitions, deployments and invoices. Administrator approval is required before you can sign in."
      asideTitle="A dedicated portal for your workforce."
      asidePoints={[
        "Raise work-orders and track requisitions",
        "One dashboard for deployments and billing",
        "Approval confirms your business identity",
      ]}
      footer={
        <p className="authLinks">
          Already approved? <Link href="/login">Sign in</Link>
        </p>
      }
    >
      <form className="authForm" onSubmit={handleSubmit} noValidate>
        {status.state === "error" && (
          <div className="authAlert authAlert--error" role="alert"><TriangleAlert size={16} />{status.message}</div>
        )}
        {status.state === "success" ? (
          <>
            <div className="authCenter">
              <span className="authStatusIcon authStatusIcon--success"><Building2 size={28} /></span>
              <h2>Registration received</h2>
              <p className="authSubtitle" style={{ marginBottom: 0 }}>
                {status.message}. An email confirmation has been sent to{" "}
                <strong>{normalizeAuthEmail(values.email)}</strong>. You will be able to sign in once an administrator
                approves your account.
              </p>
              <ul className="authSteps">
                <li><b>1</b><span>Our team reviews your company details.</span></li>
                <li><b>2</b><span>An administrator approves your registration.</span></li>
                <li><b>3</b><span>You receive an email and can sign in at /login.</span></li>
              </ul>
            </div>
            <p className="authLinks">
              <Link href="/login">Go to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <div className="authField">
              <label className="authLabel" htmlFor="client-companyName">Company name</label>
              <input
                id="client-companyName"
                className={`authInput${fieldErrors.companyName ? " authInputError" : ""}`}
                autoComplete="organization"
                placeholder="Company or organisation"
                value={values.companyName}
                onChange={(event) => update("companyName", event.target.value)}
                aria-invalid={fieldErrors.companyName ? "true" : undefined}
              />
              <FieldError message={fieldErrors.companyName} />
            </div>
            <div className="authGrid">
              <div className="authField">
                <label className="authLabel" htmlFor="client-firstName">Contact first name</label>
                <input
                  id="client-firstName"
                  className={`authInput${fieldErrors.firstName ? " authInputError" : ""}`}
                  autoComplete="given-name"
                  placeholder="First name"
                  value={values.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                  aria-invalid={fieldErrors.firstName ? "true" : undefined}
                />
                <FieldError message={fieldErrors.firstName} />
              </div>
              <div className="authField">
                <label className="authLabel" htmlFor="client-lastName">Contact last name</label>
                <input
                  id="client-lastName"
                  className={`authInput${fieldErrors.lastName ? " authInputError" : ""}`}
                  autoComplete="family-name"
                  placeholder="Last name"
                  value={values.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                  aria-invalid={fieldErrors.lastName ? "true" : undefined}
                />
                <FieldError message={fieldErrors.lastName} />
              </div>
            </div>
            <div className="authGrid">
              <div className="authField">
                <label className="authLabel" htmlFor="client-email">Email address</label>
                <input
                  id="client-email"
                  className={`authInput${fieldErrors.email ? " authInputError" : ""}`}
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={values.email}
                  onChange={(event) => update("email", event.target.value)}
                  aria-invalid={fieldErrors.email ? "true" : undefined}
                />
                <FieldError message={fieldErrors.email} />
              </div>
              <div className="authField">
                <label className="authLabel" htmlFor="client-phone">Phone number</label>
                <input
                  id="client-phone"
                  className={`authInput${fieldErrors.phone ? " authInputError" : ""}`}
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={values.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  aria-invalid={fieldErrors.phone ? "true" : undefined}
                />
                <FieldError message={fieldErrors.phone} />
              </div>
            </div>
            <div className="authField">
              <label className="authLabel" htmlFor="client-password">Password</label>
              <input
                id="client-password"
                className={`authInput${fieldErrors.password ? " authInputError" : ""}`}
                type="password"
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={values.password}
                onChange={(event) => update("password", event.target.value)}
                aria-invalid={fieldErrors.password ? "true" : undefined}
              />
              <FieldError message={fieldErrors.password} />
              <small className="authPasswordHint">{passwordHints().join(" · ")}</small>
            </div>
            <label className="authCheckboxRow">
              <input
                type="checkbox"
                checked={values.consentGiven}
                onChange={(event) => update("consentGiven", event.target.checked)}
                aria-invalid={fieldErrors.consentGiven ? "true" : undefined}
              />
              <span>
                I consent to Shakti Manpower processing this information to set up the company account, as required by
                India&apos;s DPDP Act. <Link href="/">Read the privacy notice.</Link>
              </span>
            </label>
            <FieldError message={fieldErrors.consentGiven} />
            <button type="submit" className="authButton" disabled={submitting}>
              {submitting ? "Submitting registration…" : "Submit registration"}
            </button>
            <p className="authNote">
              Your company account cannot be used until an administrator approves it. You will see a
              PENDING&nbsp;APPROVAL status in the meantime.
            </p>
          </>
        )}
      </form>
    </AuthShell>
  );
}