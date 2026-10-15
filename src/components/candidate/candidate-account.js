"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { changePassword, clearAuthSession, logout, setAuthFlash } from "@/lib/auth";
import { passwordHints, validatePassword, validatePasswordMatch } from "@/lib/auth-forms";
import FieldError from "@/components/field-error";
import { ErrorState } from "./candidate-ui";

export default function CandidateAccount({ session, onLogoutError }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [changing, setChanging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  function validate() {
    const next = {};
    if (!currentPassword) next.currentPassword = "Enter your current password.";
    const strength = validatePassword(newPassword);
    if (strength) next.newPassword = strength;
    const match = validatePasswordMatch(newPassword, confirmPassword);
    if (match) next.confirmPassword = match;
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (changing) return;
    setSubmitError("");
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setChanging(true);
    try {
      const message = await changePassword(session, currentPassword, newPassword);
      const text =
        message && typeof message.message === "string" && message.message.trim()
          ? message.message.trim()
          : "Password changed successfully. Please sign in again.";
      setAuthFlash(text);
      clearAuthSession();
      router.replace("/login");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your password could not be changed. Please try again.");
      setChanging(false);
    }
  }

  async function handleLogout(allDevices) {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout(session, allDevices);
    } catch {
      setLogoutError("We could not reach the server, but you have been signed out on this device.");
    } finally {
      router.replace("/");
    }
  }

  return (
    <div className="cp-stack">
      <section className="cp-panel">
        <div className="cp-panelHead">
          <div>
            <h2>Change password</h2>
            <p>Changing your password signs out every device, including this one.</p>
          </div>
        </div>

        {submitError && <ErrorState message={submitError} />}

        <form className="authForm cp-form" onSubmit={handleSubmit} noValidate>
          <div className="authField authField--full">
            <label className="authLabel" htmlFor="cp-current-password">Current password</label>
            <input
              id="cp-current-password"
              className={`authInput${errors.currentPassword ? " authInputError" : ""}`}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={changing}
            />
            <FieldError message={errors.currentPassword} />
          </div>
          <div className="authField authField--full">
            <label className="authLabel" htmlFor="cp-new-password">New password</label>
            <input
              id="cp-new-password"
              className={`authInput${errors.newPassword ? " authInputError" : ""}`}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={changing}
            />
            <small className="authPasswordHint cp-hint">{passwordHints().join(" · ")}</small>
            <FieldError message={errors.newPassword} />
          </div>
          <div className="authField authField--full">
            <label className="authLabel" htmlFor="cp-confirm-password">Confirm new password</label>
            <input
              id="cp-confirm-password"
              className={`authInput${errors.confirmPassword ? " authInputError" : ""}`}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={changing}
            />
            <FieldError message={errors.confirmPassword} />
          </div>
          <div className="authButtonRow cp-formActions">
            <button type="submit" className="authButton" disabled={changing}>
              <KeyRound size={15} /> {changing ? "Changing…" : "Change password"}
            </button>
          </div>
        </form>
      </section>

      <section className="cp-panel">
        <div className="cp-panelHead">
          <div>
            <h2>Sign out</h2>
            <p>End this session, or end every session across all your devices.</p>
          </div>
        </div>
        {(logoutError || onLogoutError) && (
          <div className="authAlert authAlert--error" role="alert">{logoutError || onLogoutError}</div>
        )}
        <div className="cp-inlineNote">
          <ShieldCheck size={15} /> Signed in as {session?.user?.email || "your account"}.
        </div>
        <div className="authButtonRow cp-formActions">
          <button type="button" className="authButtonSecondary" onClick={() => handleLogout(false)} disabled={loggingOut}>
            <LogOut size={15} /> Sign out
          </button>
          <button type="button" className="cp-dangerButton" onClick={() => handleLogout(true)} disabled={loggingOut}>
            <LogOut size={15} /> Sign out all devices
          </button>
        </div>
      </section>
    </div>
  );
}
