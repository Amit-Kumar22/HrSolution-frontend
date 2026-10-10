"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MailCheck, TriangleAlert } from "lucide-react";
import AuthShell from "@/components/auth-shell";
import FieldError from "@/components/field-error";
import { resendVerification } from "@/lib/authApi";
import { normalizeAuthEmail, validateEmail } from "@/lib/auth-forms";

function successMessage(result) {
  if (result && typeof result.message === "string" && result.message.trim()) return result.message.trim();
  return "If that email address is registered, a new verification link has been sent.";
}

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting || sent) return;
    setStatus({ state: "idle", message: "" });

    const normalizedEmail = normalizeAuthEmail(email);
    const error = validateEmail(normalizedEmail);
    if (error) {
      setFieldError(error);
      return;
    }
    setFieldError("");

    setSubmitting(true);
    try {
      const result = await resendVerification(normalizedEmail);
      setSent(true);
      setStatus({ state: "success", message: successMessage(result) });
    } catch (submitError) {
      setStatus({ state: "error", message: (submitError && submitError.message) || "Could not resend the verification email. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Resend verification email"
      subtitle="If you have not received your account activation link, request a fresh one. We never reveal whether an email is registered."
      asideTitle="Get your account activated."
      asidePoints={[
        "Fresh verification link delivered by email",
        "Link expires after a short time",
        "Sign in only after your email is verified",
      ]}
      footer={
        <p className="authLinks">
          Changed your mind? <Link href="/login">Back to sign in</Link> ·{" "}
          <Link href="/register/candidate">Register as a job seeker</Link>
        </p>
      }
    >
      <form className="authForm" onSubmit={handleSubmit} noValidate>
        {status.state === "error" && (
          <div className="authAlert authAlert--error" role="alert"><TriangleAlert size={16} />{status.message}</div>
        )}
        {status.state === "success" && (
          <div className="authAlert authAlert--success" role="status"><Check size={16} />{status.message}</div>
        )}
        {sent ? (
          <div className="authCenter">
            <span className="authStatusIcon authStatusIcon--success"><MailCheck size={28} /></span>
            <h2>Check your inbox</h2>
            <p className="authSubtitle" style={{ marginBottom: 0 }}>
              If {normalizeAuthEmail(email)} is registered, you will receive a new verification link shortly. Once your
              email is verified you can sign in.
            </p>
          </div>
        ) : (
          <>
            <div className="authField">
              <label className="authLabel" htmlFor="resend-email">Email address</label>
              <input
                id="resend-email"
                className={`authInput${fieldError ? " authInputError" : ""}`}
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldError) setFieldError("");
                }}
                aria-invalid={fieldError ? "true" : undefined}
              />
              <FieldError message={fieldError} />
            </div>
            <button type="submit" className="authButton" disabled={submitting}>
              {submitting ? "Sending…" : "Resend verification email"}
            </button>
          </>
        )}
      </form>
    </AuthShell>
  );
}