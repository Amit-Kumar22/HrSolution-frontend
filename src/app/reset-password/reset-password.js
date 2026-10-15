"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, TriangleAlert } from "lucide-react";
import AuthShell from "@/components/auth-shell";
import FieldError from "@/components/field-error";
import { resetPassword } from "@/lib/authApi";
import { clearAuthSession } from "@/lib/auth";
import { passwordHints, validatePassword, validatePasswordMatch } from "@/lib/auth-forms";

function successMessage(result) {
  if (result && typeof result.message === "string" && result.message.trim()) return result.message.trim();
  return "Your password has been reset. All existing sessions have been signed out.";
}

export default function ResetPassword({ token: initialToken = "" }) {
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (initialToken && !startedRef.current) {
      startedRef.current = true;
      clearAuthSession();
    }
  }, [initialToken]);

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
    if (submitting || done) return;
    setStatus({ state: "idle", message: "" });

    const normalizedToken = String(token || "").trim();
    const errors = {};
    if (!normalizedToken) errors.token = "Please paste the token from your reset link.";
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;
    const matchError = validatePasswordMatch(password, confirmPassword);
    if (matchError) errors.confirmPassword = matchError;

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await resetPassword(normalizedToken, password);
      clearAuthSession();
      setDone(true);
      setStatus({ state: "success", message: successMessage(result) });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          (error && error.message) ||
          "We could not reset your password. The link may be invalid, expired or already used.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Create a new password for your account. After resetting, all existing sessions will be signed out."
      asideTitle="Regain access with a strong password."
      asidePoints={[
        "New password applies to all your devices",
        "Every existing session is revoked",
        "You will sign in again afterwards",
      ]}
    >
      <form className="authForm" onSubmit={handleSubmit} noValidate>
        {status.state === "error" && (
          <div className="authAlert authAlert--error" role="alert"><TriangleAlert size={16} />{status.message}</div>
        )}
        {status.state === "success" && (
          <div className="authCenter">
            <span className="authStatusIcon authStatusIcon--success"><KeyRound size={28} /></span>
            <h2>Password updated</h2>
            <p className="authSubtitle" style={{ marginBottom: 0 }}>
              {status.message}. Please sign in again with your new password.
            </p>
          </div>
        )}
        {!done && (
          <>
            <div className="authField">
              <label className="authLabel" htmlFor="reset-token">Reset token</label>
              <input
                id="reset-token"
                className={`authInput${fieldErrors.token ? " authInputError" : ""}`}
                placeholder="Paste the token from your email"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  clearError("token");
                }}
                disabled={Boolean(initialToken) || submitting}
                aria-invalid={fieldErrors.token ? "true" : undefined}
              />
              <FieldError message={fieldErrors.token} />
            </div>
            <div className="authField">
              <label className="authLabel" htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                className={`authInput${fieldErrors.password ? " authInputError" : ""}`}
                type="password"
                autoComplete="new-password"
                placeholder="Create a new password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError("password");
                }}
                aria-invalid={fieldErrors.password ? "true" : undefined}
              />
              <FieldError message={fieldErrors.password} />
              <small className="authPasswordHint">{passwordHints().join(" · ")}</small>
            </div>
            <div className="authField">
              <label className="authLabel" htmlFor="reset-confirm">Confirm new password</label>
              <input
                id="reset-confirm"
                className={`authInput${fieldErrors.confirmPassword ? " authInputError" : ""}`}
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearError("confirmPassword");
                }}
                aria-invalid={fieldErrors.confirmPassword ? "true" : undefined}
              />
              <FieldError message={fieldErrors.confirmPassword} />
            </div>
            <button type="submit" className="authButton" disabled={submitting}>
              {submitting ? "Updating password…" : "Reset password"}
            </button>
          </>
        )}
        {status.state === "error" && (
          <p className="authLinks">
            Need a fresh link? <Link href="/login">Request another reset from the sign-in page</Link>
          </p>
        )}
        {status.state === "success" && (
          <p className="authLinks">
            <Link href="/login">Go to sign in</Link>
          </p>
        )}
        <p className="authNote">
          Reset links expire after 30 minutes and are single-use. A new password revokes every active session on your account.
        </p>
      </form>
    </AuthShell>
  );
}