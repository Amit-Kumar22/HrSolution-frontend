"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, TriangleAlert } from "lucide-react";
import AuthShell from "@/components/auth-shell";
import FieldError from "@/components/field-error";
import { registerCandidate } from "@/lib/authApi";
import {
  normalizeAuthEmail,
  normalizeAuthPhone,
  passwordHints,
  pickRegistrationErrors,
  validateCandidateForm,
} from "@/lib/auth-forms";

const KNOWN_FIELDS = ["firstName", "lastName", "email", "phone", "password", "consentGiven"];

function successMessage(result) {
  if (result && typeof result.message === "string" && result.message.trim()) return result.message.trim();
  return "Registration received. A verification link has been sent to your email address.";
}

export default function CandidateRegister() {
  const [values, setValues] = useState({
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
    if (fieldErrors[fieldName]) {
      setFieldErrors((previous) => {
        const next = { ...previous };
        delete next[fieldName];
        return next;
      });
    }
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
    const errors = validateCandidateForm(formValues);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setStatus({ state: "error", message: "Please fix the highlighted fields and try again." });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await registerCandidate({
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
      title="Create your job-seeker account"
      subtitle="Register as a candidate to apply for verified openings. You will need to verify your email before signing in."
      asideTitle="Get one step closer to your next role."
      asidePoints={[
        "Create a profile that employers can see",
        "Email verification keeps your account secure",
        "Track your applications from your portal",
      ]}
      footer={
        <p className="authLinks">
          Already registered? <Link href="/login">Sign in</Link>
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
              <span className="authStatusIcon authStatusIcon--success"><MailCheck size={28} /></span>
              <h2>Verification email sent</h2>
              <p className="authSubtitle" style={{ marginBottom: 0 }}>
                {status.message}. Please open the link we sent to{" "}
                <strong>{normalizeAuthEmail(values.email)}</strong> to activate your account.
              </p>
              <ul className="authSteps">
                <li><b>1</b><span>Check your inbox (and spam folder) for the verification email.</span></li>
                <li><b>2</b><span>Click the link to verify your email address.</span></li>
                <li><b>3</b><span>Once verified, sign in to your candidate portal.</span></li>
              </ul>
            </div>
            <p className="authLinks">
              <Link href="/login">Go to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <div className="authGrid">
              <div className="authField">
                <label className="authLabel" htmlFor="candidate-firstName">First name</label>
                <input
                  id="candidate-firstName"
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
                <label className="authLabel" htmlFor="candidate-lastName">Last name</label>
                <input
                  id="candidate-lastName"
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
            <div className="authField">
              <label className="authLabel" htmlFor="candidate-email">Email address</label>
              <input
                id="candidate-email"
                className={`authInput${fieldErrors.email ? " authInputError" : ""}`}
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={values.email}
                onChange={(event) => update("email", event.target.value)}
                aria-invalid={fieldErrors.email ? "true" : undefined}
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div className="authField">
              <label className="authLabel" htmlFor="candidate-phone">Phone number</label>
              <input
                id="candidate-phone"
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
            <div className="authField">
              <label className="authLabel" htmlFor="candidate-password">Password</label>
              <input
                id="candidate-password"
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
                I consent to Shakti Manpower processing my personal data for recruitment purposes, as required by
                India&apos;s DPDP Act. <Link href="/">Read the privacy notice.</Link>
              </span>
            </label>
            <FieldError message={fieldErrors.consentGiven} />
            <button type="submit" className="authButton" disabled={submitting}>
              {submitting ? "Creating your account…" : "Create account"}
            </button>
            <p className="authNote">
              By registering you confirm the details above are correct. Only verified email addresses can sign in.
            </p>
          </>
        )}
      </form>
    </AuthShell>
  );
}