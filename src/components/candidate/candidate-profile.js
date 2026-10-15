"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Pencil, Save, UserRound, X } from "lucide-react";
import { getCandidateProfile, listCandidateCategories, updateCandidateProfile, CandidateApiError } from "@/lib/candidateApi";
import { normalizeAuthPhone, validatePhone } from "@/lib/auth-forms";
import FieldError from "@/components/field-error";
import { ErrorState, Spinner, formatDate } from "./candidate-ui";

const MAX_QUALIFICATION = 120;
const MAX_CITY = 100;
const MAX_STATE = 100;
const MAX_NAME = 160;
const MAX_EXPERIENCE_MONTHS = 720;

function profileDefaults(profile, session) {
  const user = session && session.user ? session.user : {};
  const fullName =
    (profile && profile.fullName) ||
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "";
  return {
    fullName: fullName || "",
    email: (profile && profile.email) || user.email || "",
    phone: normalizeAuthPhone((profile && profile.phone) || user.phone || ""),
    city: (profile && profile.city) || "",
    state: (profile && profile.state) || "",
    totalExperienceMonths:
      profile && Number.isFinite(Number(profile.totalExperienceMonths)) ? String(profile.totalExperienceMonths) : "0",
    highestQualification: (profile && profile.highestQualification) || "",
    preferredCategoryId:
      profile && profile.preferredCategoryId !== null && profile.preferredCategoryId !== undefined
        ? String(profile.preferredCategoryId)
        : "",
    consentGiven: profile ? Boolean(profile.consentGiven) : false,
  };
}

function validateProfile(values) {
  const errors = {};
  const name = String(values.fullName || "").trim();
  if (!name) errors.fullName = "Full name is required.";
  else if (name.length > MAX_NAME) errors.fullName = `Full name must be ${MAX_NAME} characters or fewer.`;

  const phoneError = validatePhone(values.phone);
  if (phoneError) errors.phone = phoneError;

  const city = String(values.city || "").trim();
  if (!city) errors.city = "City is required.";
  else if (city.length > MAX_CITY) errors.city = `City must be ${MAX_CITY} characters or fewer.`;

  const state = String(values.state || "").trim();
  if (!state) errors.state = "State is required.";
  else if (state.length > MAX_STATE) errors.state = `State must be ${MAX_STATE} characters or fewer.`;

  const months = String(values.totalExperienceMonths || "").trim();
  if (months === "") errors.totalExperienceMonths = "Total experience is required (enter 0 if fresher).";
  else {
    const numeric = Number(months);
    if (!Number.isInteger(numeric)) errors.totalExperienceMonths = "Enter experience as a whole number of months.";
    else if (numeric < 0 || numeric > MAX_EXPERIENCE_MONTHS)
      errors.totalExperienceMonths = `Experience must be between 0 and ${MAX_EXPERIENCE_MONTHS} months.`;
  }

  const qualification = String(values.highestQualification || "").trim();
  if (!qualification) errors.highestQualification = "Highest qualification is required.";
  else if (qualification.length > MAX_QUALIFICATION)
    errors.highestQualification = `Qualification must be ${MAX_QUALIFICATION} characters or fewer.`;

  if (!values.preferredCategoryId) errors.preferredCategoryId = "Select your preferred job category.";
  if (!values.consentGiven) errors.consentGiven = "Please accept the data consent to save your profile.";

  return errors;
}

function ProfileForm({ profile, session, categories, onCancel, onSaved }) {
  const [values, setValues] = useState(() => profileDefaults(profile, session));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeCategories = useMemo(() => categories.filter((c) => c.active !== false), [categories]);

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setSubmitError("");

    const nextErrors = validateProfile(values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCandidateProfile({
        fullName: values.fullName.trim(),
        phone: normalizeAuthPhone(values.phone),
        city: values.city.trim(),
        state: values.state.trim(),
        totalExperienceMonths: Number(values.totalExperienceMonths),
        highestQualification: values.highestQualification.trim(),
        preferredCategoryId: Number(values.preferredCategoryId),
        consentGiven: Boolean(values.consentGiven),
      });
      onSaved(updated);
    } catch (error) {
      if (error instanceof CandidateApiError && error.fields && Object.keys(error.fields).length) {
        setErrors(error.fields);
      }
      setSubmitError(error instanceof Error ? error.message : "Your profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="authForm cp-form" onSubmit={handleSubmit} noValidate>
      {submitError && (
        <div className="authAlert authAlert--error" role="alert">
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      <div className="authGrid">
        <div className="authField authField--full">
          <label className="authLabel" htmlFor="cp-fullName">Full name</label>
          <input
            id="cp-fullName"
            className={`authInput${errors.fullName ? " authInputError" : ""}`}
            type="text"
            value={values.fullName}
            maxLength={MAX_NAME}
            onChange={(event) => setField("fullName", event.target.value)}
            disabled={saving}
          />
          <FieldError message={errors.fullName} />
        </div>

        <div className="authField authField--full">
          <label className="authLabel" htmlFor="cp-email">Email address</label>
          <input id="cp-email" className="authInput" type="email" value={values.email} readOnly disabled aria-readonly="true" />
          <small className="authPasswordHint cp-hint">Your email identifies you across every application and cannot be changed here.</small>
        </div>

        <div className="authField">
          <label className="authLabel" htmlFor="cp-phone">Phone number</label>
          <input
            id="cp-phone"
            className={`authInput${errors.phone ? " authInputError" : ""}`}
            type="tel"
            inputMode="numeric"
            value={values.phone}
            maxLength={10}
            onChange={(event) => setField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
            disabled={saving}
          />
          <FieldError message={errors.phone} />
        </div>

        <div className="authField">
          <label className="authLabel" htmlFor="cp-experience">Total experience (months)</label>
          <input
            id="cp-experience"
            className={`authInput${errors.totalExperienceMonths ? " authInputError" : ""}`}
            type="number"
            min={0}
            max={MAX_EXPERIENCE_MONTHS}
            step={1}
            value={values.totalExperienceMonths}
            onChange={(event) => setField("totalExperienceMonths", event.target.value)}
            disabled={saving}
          />
          <FieldError message={errors.totalExperienceMonths} />
        </div>

        <div className="authField">
          <label className="authLabel" htmlFor="cp-city">City</label>
          <input
            id="cp-city"
            className={`authInput${errors.city ? " authInputError" : ""}`}
            type="text"
            value={values.city}
            maxLength={MAX_CITY}
            onChange={(event) => setField("city", event.target.value)}
            disabled={saving}
          />
          <FieldError message={errors.city} />
        </div>

        <div className="authField">
          <label className="authLabel" htmlFor="cp-state">State</label>
          <input
            id="cp-state"
            className={`authInput${errors.state ? " authInputError" : ""}`}
            type="text"
            value={values.state}
            maxLength={MAX_STATE}
            onChange={(event) => setField("state", event.target.value)}
            disabled={saving}
          />
          <FieldError message={errors.state} />
        </div>

        <div className="authField">
          <label className="authLabel" htmlFor="cp-qualification">Highest qualification</label>
          <input
            id="cp-qualification"
            className={`authInput${errors.highestQualification ? " authInputError" : ""}`}
            type="text"
            value={values.highestQualification}
            maxLength={MAX_QUALIFICATION}
            placeholder="e.g. MCA, ITI Electrician"
            onChange={(event) => setField("highestQualification", event.target.value)}
            disabled={saving}
          />
          <FieldError message={errors.highestQualification} />
        </div>

        <div className="authField">
          <label className="authLabel" htmlFor="cp-category">Preferred job category</label>
          <select
            id="cp-category"
            className={`authSelect${errors.preferredCategoryId ? " authInputError" : ""}`}
            value={values.preferredCategoryId}
            onChange={(event) => setField("preferredCategoryId", event.target.value)}
            disabled={saving}
          >
            <option value="">Select a category</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.skillLevelLabel ? ` — ${category.skillLevelLabel}` : ""}
              </option>
            ))}
          </select>
          <FieldError message={errors.preferredCategoryId} />
        </div>
      </div>

      <label className="authCheckboxRow">
        <input
          type="checkbox"
          checked={values.consentGiven}
          onChange={(event) => setField("consentGiven", event.target.checked)}
          disabled={saving}
        />
        <span>I consent to Shakti Manpower holding and processing my profile and CV for recruitment purposes.</span>
      </label>
      <FieldError message={errors.consentGiven} />

      <div className="authButtonRow cp-formActions">
        <button type="button" className="authButtonSecondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="authButton" disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

export default function CandidateProfile({ profile, loading, error, session, onRefresh, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    listCandidateCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch((caught) => {
        if (!cancelled) setCategoriesError(caught instanceof Error ? caught.message : "Job categories could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading your profile…" />;
  if (error) return <ErrorState message={error} onRetry={onRefresh} />;

  const missing = !profile;

  if (editing || missing) {
    return (
      <section className="cp-panel">
        <div className="cp-panelHead">
          <div>
            <h2>{missing ? "Complete your profile" : "Edit your profile"}</h2>
            <p>
              {missing
                ? "Add your details so employers can match you with the right vacancies. Your profile is also created automatically when you apply for a job."
                : "Keep your details up to date. Your email address stays locked to protect your application history."}
            </p>
          </div>
        </div>
        {notice && (
          <div className="authAlert authAlert--success" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </div>
        )}
        {categoriesLoading && <p className="cp-hint">Loading job categories…</p>}
        {categoriesError && (
          <div className="authAlert authAlert--error" role="alert">
            <AlertCircle size={16} />
            {categoriesError}
          </div>
        )}
        <ProfileForm
          profile={profile}
          session={session}
          categories={categories}
          onCancel={() => {
            if (!missing) setEditing(false);
          }}
          onSaved={(updated) => {
            setNotice("Your profile has been saved.");
            setEditing(false);
            onSaved(updated);
          }}
        />
      </section>
    );
  }

  return (
    <section className="cp-panel">
      <div className="cp-panelHead">
        <div>
          <h2>My profile</h2>
          <p>Your personal and professional details as shared with employers.</p>
        </div>
        <button type="button" className="authButtonSecondary cp-inlineButton" onClick={() => setEditing(true)}>
          <Pencil size={14} /> Edit profile
        </button>
      </div>

      {notice && (
        <div className="authAlert authAlert--success" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      <div className="cp-detailGrid">
        <div className="cp-detail"><span>Full name</span><strong>{profile.fullName || "—"}</strong></div>
        <div className="cp-detail"><span>Email address</span><strong>{profile.email || "—"}</strong></div>
        <div className="cp-detail"><span>Phone number</span><strong>{profile.phone || "—"}</strong></div>
        <div className="cp-detail"><span>City</span><strong>{profile.city || "—"}</strong></div>
        <div className="cp-detail"><span>State</span><strong>{profile.state || "—"}</strong></div>
        <div className="cp-detail"><span>Experience</span><strong>{profile.experienceLabel || "—"}</strong></div>
        <div className="cp-detail"><span>Highest qualification</span><strong>{profile.highestQualification || "—"}</strong></div>
        <div className="cp-detail"><span>Preferred category</span><strong>{profile.preferredCategoryName || "—"}</strong></div>
        <div className="cp-detail"><span>Resume</span><strong>{profile.resumeFileName || "Not uploaded"}</strong></div>
        <div className="cp-detail"><span>Applications</span><strong>{Number.isFinite(Number(profile.applicationCount)) ? profile.applicationCount : 0}</strong></div>
        <div className="cp-detail"><span>Consent</span><strong>{profile.consentGiven ? "Given" : "Not given"}</strong></div>
        <div className="cp-detail"><span>Profile ID</span><strong>#{profile.id ?? "—"}</strong></div>
      </div>

      <div className="cp-inlineNote">
        <UserRound size={15} /> Your profile was last shown as record #{profile.id ?? "—"}.
      </div>
    </section>
  );
}
