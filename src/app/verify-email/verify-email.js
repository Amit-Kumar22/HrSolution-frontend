"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";
import AuthShell from "@/components/auth-shell";
import FieldError from "@/components/field-error";
import { verifyEmail } from "@/lib/authApi";

function successMessage(result) {
  if (result && typeof result.message === "string" && result.message.trim()) return result.message.trim();
  return "Your email has been verified. Your account is now active.";
}

export default function VerifyEmail({ token: initialToken = "" }) {
  const [token, setToken] = useState(initialToken);
  const [fieldError, setFieldError] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (initialToken && !startedRef.current) {
      startedRef.current = true;
      handleVerify(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  async function handleVerify(value) {
    const normalizedToken = String(value || token || "").trim();
    if (!normalizedToken) {
      setFieldError("Please paste the token from your verification link.");
      return;
    }
    setFieldError("");
    setSubmitting(true);
    setStatus({ state: "idle", message: "" });
    try {
      const result = await verifyEmail(normalizedToken);
      setDone(true);
      setStatus({ state: "success", message: successMessage(result) });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          (error && error.message) ||
          "We could not verify this link. It may be invalid, expired or already used.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting || done) return;
    await handleVerify(token);
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Confirm your email address to activate your account and finish setting up your profile."
      asideTitle="Your account, verified."
      asidePoints={[
        "One click and your email is confirmed",
        "Unverified accounts cannot sign in",
        "Your personal data stays protected",
      ]}
    >
      <form className="authForm" onSubmit={handleSubmit} noValidate>
        {status.state === "error" && (
          <div className="authAlert authAlert--error" role="alert"><TriangleAlert size={16} />{status.message}</div>
        )}
        {status.state === "success" && (
          <div className="authCenter">
            <span className="authStatusIcon authStatusIcon--success"><CheckCircle2 size={30} /></span>
            <h2>Email verified</h2>
            <p className="authSubtitle" style={{ marginBottom: 0 }}>{status.message}</p>
            <ul className="authSteps">
              <li><b>1</b><span>Your account status is now active.</span></li>
              <li><b>2</b><span>Sign in with the email and password you chose.</span></li>
            </ul>
          </div>
        )}
        {!done && (
          <>
            <div className="authField">
              <label className="authLabel" htmlFor="verify-token">Verification token</label>
              <input
                id="verify-token"
                className={`authInput${fieldError ? " authInputError" : ""}`}
                placeholder="Paste the token from your email"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  if (fieldError) setFieldError("");
                }}
                disabled={Boolean(initialToken) || submitting}
                aria-invalid={fieldError ? "true" : undefined}
              />
              <FieldError message={fieldError} />
              {initialToken && <small className="authPasswordHint">A token was detected in your link and is being verified.</small>}
            </div>
            <button type="submit" className="authButton" disabled={submitting}>
              {submitting ? "Verifying…" : "Verify email"}
            </button>
          </>
        )}
        {status.state === "error" && (
          <p className="authLinks">
            Link expired or not working? <Link href="/resend-verification">Resend verification email</Link>
          </p>
        )}
        {status.state === "success" && (
          <p className="authLinks">
            <Link href="/login">Go to sign in</Link>
          </p>
        )}
        <p className="authNote"><ShieldCheck size={12} /> Only verified accounts can sign in.</p>
      </form>
    </AuthShell>
  );
}