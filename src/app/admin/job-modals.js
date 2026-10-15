"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  AdminApiError,
  APPLICATION_STATUSES,
  CANDIDATE_SOURCES,
  JOB_STATUSES,
  SHIFT_OPTIONS,
  applicationStatusLabel,
  applicationStatusTone,
  changeJobStatus,
  createJob,
  deleteJob,
  getJob,
  getJobPipeline,
  jobShiftLabel,
  jobStatusLabel,
  jobStatusTone,
  listCandidates,
  listClientSites,
  listClients,
  listEligibleStaff,
  listManpowerCategories,
  recordJobApplication,
  updateJob,
} from "../../lib/adminApi";
import {
  Chip,
  ConfirmDialog,
  Field,
  LoadingState,
  Modal,
  Notice,
  formatDate,
  slugify,
  SLUG_PATTERN,
} from "./admin-ui";

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */

export function JobStatusChip({ status }) {
  return <Chip tone={jobStatusTone(status)}>{jobStatusLabel(status)}</Chip>;
}

export function ExpiredChip({ job }) {
  if (!job) return <span className="cmMuted">—</span>;
  return job.expired ? <Chip tone="danger">Expired</Chip> : <Chip tone="success">Within dates</Chip>;
}

export function VisibilityChip({ job }) {
  if (!job) return <span className="cmMuted">—</span>;
  return job.publiclyVisible ? (
    <Chip tone="success"><Eye size={12} /> Public</Chip>
  ) : (
    <Chip tone="neutral"><EyeOff size={12} /> Hidden</Chip>
  );
}

function DetailRow({ label, children, full = false }) {
  return (
    <div className={`cmDetailRow${full ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit job                                                   */
/* ------------------------------------------------------------------ */

function numberOrEmpty(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "";
}

function isLive(job) {
  if (!job) return false;
  return Boolean(job.publiclyVisible) || job.status === "OPEN";
}

export function JobFormModal({ mode = "create", job = null, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => ({
    title: isEdit ? job?.title || "" : "",
    slug: isEdit ? job?.slug || "" : "",
    summary: isEdit ? job?.summary || "" : "",
    description: isEdit ? job?.description || "" : "",
    categoryId: isEdit && job?.categoryId != null ? String(job.categoryId) : "",
    clientId: isEdit && job?.clientId != null ? String(job.clientId) : "",
    siteId: isEdit && job?.siteId != null ? String(job.siteId) : "",
    location: isEdit ? job?.location || "" : "",
    city: isEdit ? job?.city || "" : "",
    state: isEdit ? job?.state || "" : "",
    openings: isEdit ? numberOrEmpty(job?.openings) || "1" : "1",
    salaryMin: isEdit ? numberOrEmpty(job?.salaryMin) : "",
    salaryMax: isEdit ? numberOrEmpty(job?.salaryMax) : "",
    experienceMinMonths: isEdit ? numberOrEmpty(job?.experienceMinMonths ?? 0) : "0",
    experienceMaxMonths: isEdit ? numberOrEmpty(job?.experienceMaxMonths) : "",
    shift: isEdit ? job?.shift || "DAY" : "DAY",
    expiresOn: isEdit ? job?.expiresOn || "" : "",
    metaTitle: isEdit ? job?.metaTitle || "" : "",
    metaDescription: isEdit ? job?.metaDescription || "" : "",
    displayOrder: isEdit ? numberOrEmpty(job?.displayOrder ?? 0) : "0",
  }));
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingSlugChange, setPendingSlugChange] = useState(false);

  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [refDataError, setRefDataError] = useState("");
  const [sitesLoading, setSitesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([listManpowerCategories(), listClients({ size: 200 })]);
      if (cancelled) return;
      const [categoryResult, clientResult] = results;
      if (categoryResult.status === "fulfilled") {
        setCategories(Array.isArray(categoryResult.value) ? categoryResult.value : []);
      }
      if (clientResult.status === "fulfilled") {
        setClients(clientResult.value?.content || []);
      }
      if (categoryResult.status === "rejected" || clientResult.status === "rejected") {
        setRefDataError("Some dropdown lists could not be loaded. You can still type IDs where needed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const clientId = values.clientId;
    if (!clientId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const list = await listClientSites(Number(clientId));
        if (!cancelled) setSites(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setSites([]);
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [values.clientId]);

  function setField(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === "title" && !slugTouched) next.slug = slugify(value);
      if (name === "clientId" && value !== current.clientId) next.siteId = "";
      return next;
    });
    if (name === "clientId") {
      setSites([]);
      setSitesLoading(Boolean(value));
    }
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function validate() {
    const next = {};
    const title = values.title.trim();
    if (!title) next.title = "Job title is required.";
    else if (title.length > 160) next.title = "Keep the title to 160 characters or fewer.";

    const slug = values.slug.trim();
    if (!slug) next.slug = "Job slug is required.";
    else if (slug.length > 160) next.slug = "Keep the slug to 160 characters or fewer.";
    else if (!SLUG_PATTERN.test(slug)) {
      next.slug = "Use lowercase letters, numbers and single hyphens (e.g. security-guard-pune).";
    }

    if (!values.categoryId) next.categoryId = "Choose a manpower category.";

    if (values.summary.trim().length > 400) next.summary = "Keep the summary to 400 characters or fewer.";
    if (values.description.length > 20000) next.description = "Keep the description to 20,000 characters or fewer.";

    const openings = Number(values.openings);
    if (!Number.isInteger(openings) || openings < 1 || openings > 10000) {
      next.openings = "Openings must be a whole number between 1 and 10,000.";
    }

    const hasMin = values.salaryMin !== "";
    const hasMax = values.salaryMax !== "";
    if (hasMin || hasMax) {
      const min = hasMin ? Number(values.salaryMin) : null;
      const max = hasMax ? Number(values.salaryMax) : null;
      if (hasMin && (!Number.isFinite(min) || min < 0)) next.salaryMin = "Enter a valid minimum salary.";
      if (hasMax && (!Number.isFinite(max) || max < 0)) next.salaryMax = "Enter a valid maximum salary.";
      if (hasMin && hasMax && Number.isFinite(min) && Number.isFinite(max) && min > max) {
        next.salaryMax = "Maximum salary must be greater than or equal to the minimum.";
      }
    }

    const hasExpMin = values.experienceMinMonths !== "";
    const hasExpMax = values.experienceMaxMonths !== "";
    if (hasExpMin || hasExpMax) {
      const min = hasExpMin ? Number(values.experienceMinMonths) : 0;
      const max = hasExpMax ? Number(values.experienceMaxMonths) : null;
      if (hasExpMin && (!Number.isInteger(min) || min < 0 || min > 600)) {
        next.experienceMinMonths = "Minimum experience must be between 0 and 600 months.";
      }
      if (hasExpMax && (!Number.isInteger(max) || max < 0 || max > 600)) {
        next.experienceMaxMonths = "Maximum experience must be between 0 and 600 months.";
      }
      if (hasExpMin && hasExpMax && Number.isInteger(min) && Number.isInteger(max) && min > max) {
        next.experienceMaxMonths = "Maximum experience must be greater than or equal to the minimum.";
      }
    }

    if (values.metaTitle.trim().length > 160) next.metaTitle = "Keep the meta title to 160 characters or fewer.";
    if (values.metaDescription.trim().length > 320) {
      next.metaDescription = "Keep the meta description to 320 characters or fewer.";
    }

    if (values.displayOrder !== "") {
      const order = Number(values.displayOrder);
      if (!Number.isInteger(order)) next.displayOrder = "Display order must be a whole number.";
    }

    return next;
  }

  function buildPayload() {
    const payload = {
      title: values.title.trim(),
      slug: values.slug.trim(),
      categoryId: Number(values.categoryId),
      openings: Number(values.openings),
      shift: values.shift,
      displayOrder: values.displayOrder === "" ? 0 : Number(values.displayOrder),
    };
    if (values.summary.trim()) payload.summary = values.summary.trim();
    if (values.description.trim()) payload.description = values.description.trim();
    if (values.clientId) payload.clientId = Number(values.clientId);
    if (values.siteId) payload.siteId = Number(values.siteId);
    if (values.location.trim()) payload.location = values.location.trim();
    if (values.city.trim()) payload.city = values.city.trim();
    if (values.state.trim()) payload.state = values.state.trim();
    if (values.salaryMin !== "") payload.salaryMin = Number(values.salaryMin);
    if (values.salaryMax !== "") payload.salaryMax = Number(values.salaryMax);
    if (values.experienceMinMonths !== "") payload.experienceMinMonths = Number(values.experienceMinMonths);
    if (values.experienceMaxMonths !== "") payload.experienceMaxMonths = Number(values.experienceMaxMonths);
    if (values.expiresOn) payload.expiresOn = values.expiresOn;
    if (values.metaTitle.trim()) payload.metaTitle = values.metaTitle.trim();
    if (values.metaDescription.trim()) payload.metaDescription = values.metaDescription.trim();
    return payload;
  }

  async function performSave() {
    setFormError("");
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = isEdit ? await updateJob(job.id, payload) : await createJob(payload);
      onSaved(saved, isEdit);
    } catch (error) {
      if (error instanceof AdminApiError) {
        if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("The job could not be saved. Please try again.");
      }
      setSaving(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    const validation = validate();
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }
    const slugChanged = isEdit && values.slug.trim() !== (job?.slug || "");
    if (slugChanged && isLive(job)) {
      setPendingSlugChange(true);
      return;
    }
    performSave();
  }

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: category.id, label: category.name || category.code || `Category #${category.id}` })),
    [categories],
  );

  return (
    <Modal
      wide
      title={isEdit ? "Edit job advert" : "Create job advert"}
      description={
        isEdit
          ? "Update the advert details. Publishing uses the separate status action."
          : "New adverts are always created as a DRAFT. Publish it afterwards from the jobs list."
      }
      onClose={onClose}
    >
      <form className="cmForm" onSubmit={submit} noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        {refDataError && (
          <div style={{ marginTop: formError ? 12 : 0 }}>
            <Notice tone="warn">{refDataError}</Notice>
          </div>
        )}
        {!isEdit && (
          <Notice tone="info">
            This advert will be saved as <strong>DRAFT</strong>. It stays invisible on the website until you publish it.
          </Notice>
        )}

        <div className="cmFormGrid" style={{ marginTop: 16 }}>
          <h3 className="cmFormSectionTitle">Basic information</h3>
          <div className="cmFormRow">
            <Field label="Job title" htmlFor="job-title" required error={errors.title}>
              <input
                id="job-title"
                value={values.title}
                maxLength={160}
                placeholder="e.g. Security Guard"
                onChange={(event) => setField("title", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field
              label="Job slug"
              htmlFor="job-slug"
              required
              error={errors.slug}
              hint={isEdit ? "Changing a live advert's slug can break existing links." : "Used in the public job URL."}
            >
              <input
                id="job-slug"
                value={values.slug}
                maxLength={160}
                placeholder="security-guard-pune-plant"
                onChange={(event) => {
                  setSlugTouched(true);
                  setField("slug", event.target.value);
                }}
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Job summary" htmlFor="job-summary" error={errors.summary} hint="One-line teaser shown in the job list.">
            <input
              id="job-summary"
              value={values.summary}
              maxLength={400}
              placeholder="Day-shift security guards for a manufacturing plant in Pune"
              onChange={(event) => setField("summary", event.target.value)}
              disabled={saving}
            />
          </Field>

          <Field label="Job description" htmlFor="job-description" error={errors.description}>
            <textarea
              id="job-description"
              rows={6}
              value={values.description}
              placeholder="Duties, responsibilities, working hours and any other details."
              onChange={(event) => setField("description", event.target.value)}
              disabled={saving}
            />
          </Field>

          <h3 className="cmFormSectionTitle">Job classification</h3>
          <div className="cmFormRow">
            <Field label="Manpower category" htmlFor="job-category" required error={errors.categoryId}>
              <select
                id="job-category"
                value={values.categoryId}
                onChange={(event) => setField("categoryId", event.target.value)}
                disabled={saving}
              >
                <option value="">Select a category…</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Client" htmlFor="job-client" error={errors.clientId} hint="Optional and never shown publicly.">
              <select
                id="job-client"
                value={values.clientId}
                onChange={(event) => setField("clientId", event.target.value)}
                disabled={saving}
              >
                <option value="">Internal / not client-specific</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName || client.legalName || client.clientCode || `Client #${client.id}`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="cmFormRow">
            <Field
              label="Client site"
              htmlFor="job-site"
              error={errors.siteId}
              hint={values.clientId ? (sitesLoading ? "Loading sites…" : "Optional. Must belong to the selected client.") : "Choose a client first."}
            >
              <select
                id="job-site"
                value={values.siteId}
                onChange={(event) => setField("siteId", event.target.value)}
                disabled={saving || !values.clientId || sitesLoading}
              >
                <option value="">No specific site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.displayLabel || site.siteName || `Site #${site.id}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Display order" htmlFor="job-order" error={errors.displayOrder} hint="Lower numbers appear first on the website.">
              <input
                id="job-order"
                type="number"
                step={1}
                value={values.displayOrder}
                placeholder="0"
                onChange={(event) => setField("displayOrder", event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <h3 className="cmFormSectionTitle">Location</h3>
          <Field label="Location / work address" htmlFor="job-location" error={errors.location}>
            <input
              id="job-location"
              value={values.location}
              maxLength={200}
              placeholder="e.g. MIDC Bhosari, Pune"
              onChange={(event) => setField("location", event.target.value)}
              disabled={saving}
            />
          </Field>
          <div className="cmFormRow">
            <Field label="City" htmlFor="job-city" error={errors.city}>
              <input
                id="job-city"
                value={values.city}
                maxLength={100}
                placeholder="Pune"
                onChange={(event) => setField("city", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="State" htmlFor="job-state" error={errors.state}>
              <input
                id="job-state"
                value={values.state}
                maxLength={100}
                placeholder="Maharashtra"
                onChange={(event) => setField("state", event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <h3 className="cmFormSectionTitle">Vacancy details</h3>
          <div className="cmFormRow">
            <Field label="Number of openings" htmlFor="job-openings" required error={errors.openings}>
              <input
                id="job-openings"
                type="number"
                min={1}
                max={10000}
                step={1}
                value={values.openings}
                onChange={(event) => setField("openings", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Shift" htmlFor="job-shift" error={errors.shift}>
              <select
                id="job-shift"
                value={values.shift}
                onChange={(event) => setField("shift", event.target.value)}
                disabled={saving}
              >
                {SHIFT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="cmFormRow">
            <Field label="Minimum salary (₹ / month)" htmlFor="job-salary-min" error={errors.salaryMin} hint="Leave both blank for “not disclosed”.">
              <input
                id="job-salary-min"
                type="number"
                min={0}
                step={100}
                value={values.salaryMin}
                placeholder="18000"
                onChange={(event) => setField("salaryMin", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Maximum salary (₹ / month)" htmlFor="job-salary-max" error={errors.salaryMax}>
              <input
                id="job-salary-max"
                type="number"
                min={0}
                step={100}
                value={values.salaryMax}
                placeholder="22000"
                onChange={(event) => setField("salaryMax", event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <div className="cmFormRow">
            <Field label="Minimum experience (months)" htmlFor="job-exp-min" error={errors.experienceMinMonths} hint="0 means freshers welcome.">
              <input
                id="job-exp-min"
                type="number"
                min={0}
                max={600}
                step={1}
                value={values.experienceMinMonths}
                placeholder="0"
                onChange={(event) => setField("experienceMinMonths", event.target.value)}
                disabled={saving}
              />
            </Field>
            <Field label="Maximum experience (months)" htmlFor="job-exp-max" error={errors.experienceMaxMonths}>
              <input
                id="job-exp-max"
                type="number"
                min={0}
                max={600}
                step={1}
                value={values.experienceMaxMonths}
                placeholder="60"
                onChange={(event) => setField("experienceMaxMonths", event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Application expiry date" htmlFor="job-expires" error={errors.expiresOn} hint="Last day the advert appears. Leave blank for no expiry.">
            <input
              id="job-expires"
              type="date"
              value={values.expiresOn}
              onChange={(event) => setField("expiresOn", event.target.value)}
              disabled={saving}
            />
          </Field>

          <h3 className="cmFormSectionTitle">SEO information</h3>
          <Field label="Meta title" htmlFor="job-meta-title" error={errors.metaTitle}>
            <input
              id="job-meta-title"
              value={values.metaTitle}
              maxLength={160}
              placeholder="Security Guard Jobs in Pune"
              onChange={(event) => setField("metaTitle", event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field label="Meta description" htmlFor="job-meta-description" error={errors.metaDescription}>
            <textarea
              id="job-meta-description"
              rows={3}
              value={values.metaDescription}
              maxLength={320}
              placeholder="Apply for security guard vacancies in Pune."
              onChange={(event) => setField("metaDescription", event.target.value)}
              disabled={saving}
            />
          </Field>
        </div>

        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : isEdit ? "Save changes" : "Create draft"}
          </button>
        </div>
      </form>

      {pendingSlugChange && (
        <ConfirmDialog
          title="Change the slug of a live advert?"
          message="This job is already live. Changing its slug will break any existing links, bookmarks and search-engine results that point to the old address."
          confirmLabel="Change slug anyway"
          busy={saving}
          onConfirm={() => {
            setPendingSlugChange(false);
            performSave();
          }}
          onCancel={() => setPendingSlugChange(false)}
        >
          <div className="cmDetailGrid">
            <DetailRow label="Current slug" full><code className="cmCode">{job?.slug}</code></DetailRow>
            <DetailRow label="New slug" full><code className="cmCode">{values.slug.trim()}</code></DetailRow>
          </div>
        </ConfirmDialog>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Change status                                                       */
/* ------------------------------------------------------------------ */

export function ChangeJobStatusModal({ job, onClose, onSaved }) {
  const [status, setStatus] = useState(job?.status || "OPEN");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const goingLive = status === "OPEN" && job?.status !== "OPEN";
  const expired = Boolean(job?.expired);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (reason.length > 500) {
      setError("Keep the reason to 500 characters or fewer.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const updated = await changeJobStatus(job.id, { status, reason: reason.trim() || undefined });
      onSaved(updated, status);
    } catch (err) {
      if (err instanceof AdminApiError) setError(err.message);
      else setError("The status could not be changed. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Change status — ${job?.title || `Job #${job?.id}`}`}
      description="Move this advert through its lifecycle. Only open adverts appear on the public website."
      onClose={onClose}
    >
      <form className="cmForm" onSubmit={submit} noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        {goingLive && expired && (
          <Notice tone="warn">
            This advert&apos;s expiry date has already passed. The backend will refuse to publish it until you extend the
            expiry date.
          </Notice>
        )}
        {status === "OPEN" && (
          <Notice tone="info">
            Publishing makes this advert eligible for the public Careers page, subject to the backend&apos;s visibility
            rules.
          </Notice>
        )}

        <div className="cmFormGrid" style={{ marginTop: 16 }}>
          <Field label="New status" htmlFor="job-status" required>
            <select id="job-status" value={status} onChange={(event) => setStatus(event.target.value)} disabled={saving}>
              {JOB_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason (optional)" htmlFor="job-status-reason" hint="Recorded in the audit trail.">
            <textarea
              id="job-status-reason"
              rows={3}
              maxLength={500}
              value={reason}
              placeholder="e.g. Approved and ready for publication"
              onChange={(event) => setReason(event.target.value)}
              disabled={saving}
            />
          </Field>
        </div>

        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Updating…</> : "Update status"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Delete job                                                          */
/* ------------------------------------------------------------------ */

export function DeleteJobDialog({ job, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await deleteJob(job.id);
      onDeleted(job);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "The job could not be deleted.");
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      title="Delete job advert"
      message="This is a soft delete. A job with existing applications cannot be deleted — close it instead."
      confirmLabel="Delete job"
      busy={busy}
      onConfirm={confirm}
      onCancel={() => { if (!busy) onClose(); }}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <div className="cmDetailGrid">
        <DetailRow label="Job" full>{job?.title || `Job #${job?.id}`}</DetailRow>
        <DetailRow label="Applications">{job?.applicationCount ?? 0}</DetailRow>
        <DetailRow label="Status"><JobStatusChip status={job?.status} /></DetailRow>
      </div>
      <Notice tone="warn" >
        If deletion is refused because applications exist, change the status to <strong>Closed</strong> instead — the
        record and its applications stay intact.
      </Notice>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Add application on a candidate's behalf                             */
/* ------------------------------------------------------------------ */

export function AddJobApplicationModal({ job, onClose, onSaved }) {
  const [candidateId, setCandidateId] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateResults, setCandidateResults] = useState([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [source, setSource] = useState("WALK_IN");
  const [coverNote, setCoverNote] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [note, setNote] = useState("");
  const [staff, setStaff] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listEligibleStaff();
        if (!cancelled) setStaff(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setStaff([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const query = candidateQuery.trim();
    if (query.length < 2) return undefined;
    const current = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const page = await listCandidates({ search: query, size: 10, includeSpam: false });
        if (seq.current !== current) return;
        setCandidateResults(page.content || []);
      } catch {
        if (seq.current === current) setCandidateResults([]);
      } finally {
        if (seq.current === current) setCandidateLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [candidateQuery]);

  function submit(event) {
    event.preventDefault();
    if (saving) return;
    const next = {};
    if (!candidateId) next.candidateId = "Select an existing candidate. Create the candidate first if they are new.";
    if (expectedSalary !== "") {
      const value = Number(expectedSalary);
      if (!Number.isFinite(value) || value < 0) next.expectedSalary = "Enter a valid expected salary.";
    }
    if (coverNote.length > 2000) next.coverNote = "Cover note must be 2,000 characters or fewer.";
    if (note.length > 1000) next.note = "Internal note must be 1,000 characters or fewer.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError("");
    setSaving(true);
    const payload = {
      candidateId: Number(candidateId),
      source,
    };
    if (coverNote.trim()) payload.coverNote = coverNote.trim();
    if (expectedSalary !== "") payload.expectedSalary = Number(expectedSalary);
    if (assignedToUserId) payload.assignedToUserId = Number(assignedToUserId);
    if (note.trim()) payload.note = note.trim();

    (async () => {
      try {
        const application = await recordJobApplication(job.id, payload);
        onSaved(application);
      } catch (error) {
        if (error instanceof AdminApiError) {
          if (error.fields && Object.keys(error.fields).length) setErrors(error.fields);
          setFormError(error.message);
        } else {
          setFormError("The application could not be recorded. Please try again.");
        }
        setSaving(false);
      }
    })();
  }

  return (
    <Modal
      title="Record an application"
      description={`${job?.title || `Job #${job?.id}`} · for walk-ins, phone enquiries and agency submissions.`}
      onClose={onClose}
    >
      <form className="cmForm" onSubmit={submit} noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        <Notice tone="info">
          The candidate must already exist. If they are new, register them first and come back to record the application.
        </Notice>

        <div className="cmFormGrid" style={{ marginTop: 16 }}>
          <Field label="Existing candidate" htmlFor="app-candidate-search" required error={errors.candidateId}>
            <input
              id="app-candidate-search"
              value={candidateQuery}
              placeholder="Search by name, email or phone…"
              onChange={(event) => {
                const value = event.target.value;
                setCandidateQuery(value);
                setCandidateId("");
                setSelectedCandidate(null);
                if (value.trim().length < 2) {
                  setCandidateResults([]);
                  setCandidateLoading(false);
                } else {
                  setCandidateLoading(true);
                }
              }}
              disabled={saving}
            />
          </Field>

          {candidateLoading && <LoadingState label="Searching candidates…" />}
          {!candidateLoading && candidateQuery.trim().length >= 2 && candidateResults.length === 0 && (
            <Notice tone="warn">No candidates matched. Try a different search, or register the candidate first.</Notice>
          )}
          {candidateResults.length > 0 && !selectedCandidate && (
            <div className="jobCandidateList">
              {candidateResults.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className="jobCandidateItem"
                  onClick={() => {
                    setCandidateId(String(candidate.id));
                    setSelectedCandidate(candidate);
                    setCandidateQuery(candidate.fullName || `Candidate #${candidate.id}`);
                    setCandidateResults([]);
                    setErrors((current) => {
                      if (!current.candidateId) return current;
                      const nextErrors = { ...current };
                      delete nextErrors.candidateId;
                      return nextErrors;
                    });
                  }}
                >
                  <strong>{candidate.fullName || `Candidate #${candidate.id}`}</strong>
                  <small>{[candidate.email, candidate.phone, candidate.city].filter(Boolean).join(" · ")}</small>
                </button>
              ))}
            </div>
          )}
          {selectedCandidate && (
            <div className="jobSelectedCandidate">
              <Chip tone="success">Selected</Chip>
              <strong>{selectedCandidate.fullName}</strong>
              <small>{[selectedCandidate.email, selectedCandidate.phone].filter(Boolean).join(" · ")}</small>
              <button
                type="button"
                className="cmLinkButton"
                onClick={() => {
                  setSelectedCandidate(null);
                  setCandidateId("");
                  setCandidateQuery("");
                }}
              >
                Change
              </button>
            </div>
          )}

          <div className="cmFormRow">
            <Field label="Application source" htmlFor="app-source" required>
              <select id="app-source" value={source} onChange={(event) => setSource(event.target.value)} disabled={saving}>
                {CANDIDATE_SOURCES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Expected salary (₹ / month)" htmlFor="app-salary" error={errors.expectedSalary}>
              <input
                id="app-salary"
                type="number"
                min={0}
                step={100}
                value={expectedSalary}
                placeholder="20000"
                onChange={(event) => setExpectedSalary(event.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Assigned user" htmlFor="app-assignee" error={errors.assignedToUserId} hint="Optional. The recruiter who will own this application.">
            <select id="app-assignee" value={assignedToUserId} onChange={(event) => setAssignedToUserId(event.target.value)} disabled={saving}>
              <option value="">Unassigned</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>{person.fullName || person.email || `User #${person.id}`}</option>
              ))}
            </select>
          </Field>

          <Field label="Cover note" htmlFor="app-cover" error={errors.coverNote}>
            <textarea
              id="app-cover"
              rows={3}
              maxLength={2000}
              value={coverNote}
              placeholder="Candidate applied during an office visit."
              onChange={(event) => setCoverNote(event.target.value)}
              disabled={saving}
            />
          </Field>

          <Field label="Internal note" htmlFor="app-note" error={errors.note} hint="Recorded against the submission in the funnel trail.">
            <textarea
              id="app-note"
              rows={2}
              maxLength={1000}
              value={note}
              placeholder="Follow up with the candidate."
              onChange={(event) => setNote(event.target.value)}
              disabled={saving}
            />
          </Field>
        </div>

        <div className="cmModalFooter">
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Recording…</> : "Record application"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export function JobPipelineModal({ jobId, jobTitle, onClose }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getJobPipeline(jobId);
        if (!cancelled) {
          setPipeline(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof AdminApiError ? err.message : "The pipeline could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  const rows = useMemo(() => {
    if (!pipeline) return [];
    const counts = pipeline.countsByStatus && typeof pipeline.countsByStatus === "object" ? pipeline.countsByStatus : {};
    const known = APPLICATION_STATUSES.map((status) => ({
      value: status.value,
      label: status.label,
      tone: status.tone,
      count: Number(counts[status.value]) || 0,
    }));
    const knownValues = new Set(APPLICATION_STATUSES.map((status) => status.value));
    const extra = Object.keys(counts)
      .filter((key) => !knownValues.has(key))
      .map((key) => ({ value: key, label: applicationStatusLabel(key), tone: applicationStatusTone(key), count: Number(counts[key]) || 0 }));
    return [...known, ...extra];
  }, [pipeline]);

  return (
    <Modal
      wide
      title={`Application pipeline${jobTitle ? ` — ${jobTitle}` : ""}`}
      description="How many applications sit at each stage for this job."
      onClose={onClose}
    >
      {loading ? (
        <LoadingState label="Loading pipeline…" />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : pipeline ? (
        <>
          <div className="cmDetailGrid">
            <DetailRow label="Total openings">{pipeline.openings ?? "—"}</DetailRow>
            <DetailRow label="Committed openings">{pipeline.openingsCommitted ?? "—"}</DetailRow>
            <DetailRow label="Remaining openings">{pipeline.openingsRemaining ?? "—"}</DetailRow>
            <DetailRow label="Total applications">{pipeline.totalApplications ?? "—"}</DetailRow>
          </div>
          <div className="jobPipelineGrid">
            {rows.map((row) => (
              <div className="jobPipelineCard" key={row.value}>
                <span className="jobPipelineCount">{row.count}</span>
                <span className={`jobPipelineLabel jobPipelineLabel-${row.tone}`}>{row.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Job details                                                         */
/* ------------------------------------------------------------------ */

export function JobDetailModal({
  jobId,
  canManage = false,
  onClose,
  onEdit,
  onChangeStatus,
  onDelete,
  onAddApplication,
  onViewPipeline,
}) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const current = ++seq.current;
    (async () => {
      try {
        const data = await getJob(jobId);
        if (!cancelled && seq.current === current) {
          setJob(data);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled && seq.current === current) {
          setLoadError(error instanceof AdminApiError ? error.message : "The job could not be loaded.");
        }
      } finally {
        if (!cancelled && seq.current === current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  return (
    <Modal
      wide
      title={job ? job.title : "Job details"}
      description={job ? (job.slug ? `/${job.slug}` : undefined) : undefined}
      onClose={onClose}
    >
      {loading ? (
        <LoadingState label="Loading job…" />
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : job ? (
        <>
          <div className="cmStatusRow">
            <JobStatusChip status={job.status} />
            <VisibilityChip job={job} />
            <ExpiredChip job={job} />
            {job.categoryName && <Chip tone="neutral">{job.categoryName}</Chip>}
            {job.skillLevel && <Chip tone="neutral">{job.skillLevel.replace(/_/g, " ").toLowerCase()}</Chip>}
          </div>

          {job.summary && <p className="cmDetailMessage" style={{ marginTop: 14 }}>{job.summary}</p>}

          <div className="cmDetailGrid" style={{ marginTop: 16 }}>
            <DetailRow label="Job ID"><span className="cmCode">#{job.id}</span></DetailRow>
            <DetailRow label="Slug"><code className="cmCode">{job.slug}</code></DetailRow>
            <DetailRow label="Category">{job.categoryName || "—"}</DetailRow>
            <DetailRow label="Skill level">{job.skillLevel ? job.skillLevel.replace(/_/g, " ").toLowerCase() : "—"}</DetailRow>
            <DetailRow label="Client">{job.clientName || "—"}</DetailRow>
            <DetailRow label="Client site">{job.siteName || "—"}</DetailRow>
            <DetailRow label="Location">{job.location || "—"}</DetailRow>
            <DetailRow label="City / State">{[job.city, job.state].filter(Boolean).join(", ") || "—"}</DetailRow>
            <DetailRow label="Shift">{jobShiftLabel(job.shift)}</DetailRow>
            <DetailRow label="Total openings">{job.openings ?? "—"}</DetailRow>
            <DetailRow label="Committed openings">{job.openingsCommitted ?? "—"}</DetailRow>
            <DetailRow label="Remaining openings">{job.openingsRemaining ?? "—"}</DetailRow>
            <DetailRow label="Total applications">{job.applicationCount ?? "—"}</DetailRow>
            <DetailRow label="Salary range">{job.salaryRangeLabel || "Not disclosed"}</DetailRow>
            <DetailRow label="Experience">{job.experienceLabel || "Not stated"}</DetailRow>
            <DetailRow label="Expiry date">{job.expiresOn ? formatDate(job.expiresOn) : "No expiry"}</DetailRow>
            <DetailRow label="Days until expiry">
              {typeof job.daysUntilExpiry === "number" ? `${job.daysUntilExpiry} day${job.daysUntilExpiry === 1 ? "" : "s"}` : "—"}
            </DetailRow>
            <DetailRow label="Expired status">{job.expired ? "Expired" : "Within dates"}</DetailRow>
            <DetailRow label="Public visibility">{job.publiclyVisible ? "Visible on website" : "Hidden from website"}</DetailRow>
            <DetailRow label="Display order">{job.displayOrder ?? "—"}</DetailRow>
          </div>

          <div className="cmDetailSection">
            <h3>Description</h3>
            {job.description ? (
              <p className="cmDetailMessage jobDescriptionText">{job.description}</p>
            ) : (
              <p className="cmHint">No description provided.</p>
            )}
          </div>

          <div className="cmDetailSection">
            <h3>SEO</h3>
            <div className="cmDetailGrid">
              <DetailRow label="Meta title" full>{job.metaTitle || "—"}</DetailRow>
              <DetailRow label="Meta description" full>{job.metaDescription || "—"}</DetailRow>
            </div>
          </div>

          {canManage && (
            <div className="cmDetailSection">
              <h3>Actions</h3>
              <div className="cmStatusRow">
                <button type="button" className="secondaryButton cmBtn" onClick={() => onEdit(job)}>
                  <Pencil size={15} /> Edit
                </button>
                <button type="button" className="secondaryButton cmBtn" onClick={() => onChangeStatus(job)}>
                  <TrendingUp size={15} /> Change status
                </button>
                <button type="button" className="secondaryButton cmBtn" onClick={() => onAddApplication(job)}>
                  <Plus size={15} /> Record application
                </button>
                <button type="button" className="secondaryButton cmBtn" onClick={() => onViewPipeline(job)}>
                  <Users size={15} /> View pipeline
                </button>
                <button type="button" className="cmDangerButton cmBtn" onClick={() => onDelete(job)}>
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  );
}
