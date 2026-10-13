"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { createAccount } from "../../lib/adminApi";
import { normalizeAuthEmail, validatePassword, validatePasswordMatch } from "../../lib/auth-forms";
import { Field, Modal, Notice } from "../admin/admin-ui";
import { roleLabel } from "./account-meta";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[6-9][0-9]{9}$/;

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  roles: [],
};

function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (base.length < 12) base.push(pick(all));
  return base.sort(() => Math.random() - 0.5).join("");
}

function validate(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  else if (form.firstName.trim().length > 100) errors.firstName = "First name must be 100 characters or fewer.";
  if (form.lastName.trim().length > 100) errors.lastName = "Last name must be 100 characters or fewer.";
  const email = normalizeAuthEmail(form.email);
  if (!email) errors.email = "Email address is required.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  else if (email.length > 180) errors.email = "Email must be 180 characters or fewer.";
  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = "Enter a valid 10-digit Indian mobile number, or leave it blank.";
  }
  const passwordError = validatePassword(form.password);
  if (passwordError) errors.password = passwordError;
  const matchError = validatePasswordMatch(form.password, form.confirmPassword);
  if (matchError) errors.confirmPassword = matchError;
  if (!form.roles.length) errors.roles = "Select at least one role for this account.";
  return errors;
}

export default function AccountForm({ roles, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => roleLabel(a.name).localeCompare(roleLabel(b.name))),
    [roles],
  );

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function toggleRole(roleName) {
    setForm((prev) => {
      const has = prev.roles.includes(roleName);
      return { ...prev, roles: has ? prev.roles.filter((r) => r !== roleName) : [...prev.roles, roleName] };
    });
    setErrors((prev) => (prev.roles ? { ...prev, roles: undefined } : prev));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const created = await createAccount({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: normalizeAuthEmail(form.email),
        phone: form.phone.trim() || undefined,
        password: form.password,
        roles: form.roles,
      });
      onCreated(created);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The account could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add new account"
      description="Create a staff sign-in and assign the roles that decide which dashboard and modules the user can reach."
      onClose={onClose}
      wide
    >
      {formError && <Notice tone="error">{formError}</Notice>}
      <form className="cmForm cmFormGrid" onSubmit={handleSubmit}>
        <div className="cmFormRow">
          <Field label="First name" htmlFor="ac-first" required error={errors.firstName}>
            <input
              id="ac-first"
              value={form.firstName}
              onChange={(event) => setField("firstName", event.target.value)}
              autoComplete="off"
              maxLength={100}
              disabled={saving}
            />
          </Field>
          <Field label="Last name" htmlFor="ac-last" error={errors.lastName}>
            <input
              id="ac-last"
              value={form.lastName}
              onChange={(event) => setField("lastName", event.target.value)}
              autoComplete="off"
              maxLength={100}
              disabled={saving}
            />
          </Field>
        </div>

        <div className="cmFormRow">
          <Field label="Email address" htmlFor="ac-email" required error={errors.email}>
            <input
              id="ac-email"
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              autoComplete="off"
              maxLength={180}
              placeholder="name@company.com"
              disabled={saving}
            />
          </Field>
          <Field label="Phone number" htmlFor="ac-phone" error={errors.phone} hint="Optional · 10-digit Indian mobile">
            <input
              id="ac-phone"
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
              autoComplete="off"
              maxLength={10}
              placeholder="9876543210"
              disabled={saving}
            />
          </Field>
        </div>

        <Field label="Initial password" htmlFor="ac-password" required error={errors.password}>
          <div className="cmInlinePreview">
            <input
              id="ac-password"
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={saving}
            />
            <button
              type="button"
              className="secondaryButton cmBtn"
              onClick={() => setField("password", generatePassword())}
              disabled={saving}
            >
              <RefreshCw size={15} /> Generate
            </button>
          </div>
        </Field>

        <Field label="Confirm password" htmlFor="ac-confirm" required error={errors.confirmPassword}>
          <input
            id="ac-confirm"
            value={form.confirmPassword}
            onChange={(event) => setField("confirmPassword", event.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter the initial password"
            disabled={saving}
          />
        </Field>

        <Field label="Roles & dashboard access" required error={errors.roles}>
          <div className="cmCheckList">
            {sortedRoles.map((role) => {
              const checked = form.roles.includes(role.name);
              return (
                <label key={role.name} className={`cmCheckItem${checked ? " cmCheckChecked" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleRole(role.name)} disabled={saving} />
                  <span className="cmCheckBox" aria-hidden="true" />
                  <span className="cmCheckText">
                    <strong>{roleLabel(role.name)}</strong>
                    <small>{role.description || role.name}</small>
                  </span>
                </label>
              );
            })}
            {!sortedRoles.length && <p className="cmCount">No roles were returned by the server.</p>}
          </div>
        </Field>

        <Notice tone="info">
          Passwords are hashed by the backend and never returned in API responses. The user signs in through the
          existing login page and lands on the dashboard for their assigned role.
        </Notice>

        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={15} className="spin" /> Creating…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
