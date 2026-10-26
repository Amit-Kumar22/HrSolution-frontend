"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, ShieldAlert, Upload, UserPlus } from "lucide-react";
import { Field, Modal, Notice } from "./admin-ui";
import {
  POLICE_VERIFICATION_STATUSES,
  WORKER_DOCUMENT_TYPES,
  WORKER_GENDERS,
  addBankAccount,
  convertApplicationToWorker,
  createSalaryStructure,
  createWorker,
  getWorkerSensitive,
  isAadhaar,
  isPan,
  lookupWorkerByAadhaar,
  recordPoliceVerification,
  recordWorkerExit,
  updateWorker,
  uploadWorkerDocument,
  validateWorkerDocumentFile,
  verifyWorkerDocument,
  DOCUMENT_TYPES_WITH_EXPIRY,
} from "../../lib/workerApi";

function messageOf(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function fieldsOf(error) {
  return error && typeof error === "object" && error.fields ? error.fields : {};
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function todayDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function ageOnDate(dateOfBirth, onDate) {
  const birth = new Date(dateOfBirth);
  const on = new Date(onDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(on.getTime())) return null;
  let age = on.getFullYear() - birth.getFullYear();
  const month = on.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && on.getDate() < birth.getDate())) age -= 1;
  return age;
}

function personErrors(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.dateOfJoining) errors.dateOfJoining = "Date of joining is required.";
  if (form.dateOfBirth && form.dateOfJoining && form.dateOfBirth > form.dateOfJoining) {
    errors.dateOfBirth = "Date of birth cannot be after the joining date.";
  } else if (form.dateOfBirth && form.dateOfJoining) {
    const age = ageOnDate(form.dateOfBirth, form.dateOfJoining);
    if (age != null && age < 18) errors.dateOfBirth = "The worker must be 18 or older on the joining date.";
  }
  if (form.aadhaar && !isAadhaar(form.aadhaar)) errors.aadhaar = "Enter a 12-digit Aadhaar number.";
  if (form.pan && !isPan(form.pan)) errors.pan = "Enter a valid PAN, for example ABCDE1234F.";
  return errors;
}

function basePayload(form) {
  const payload = {
    firstName: form.firstName.trim(),
    dateOfJoining: form.dateOfJoining,
  };
  const optional = {
    lastName: form.lastName,
    fatherOrHusbandName: form.fatherOrHusbandName,
    dateOfBirth: form.dateOfBirth,
    gender: form.gender,
    phone: form.phone,
    email: form.email,
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
    uan: form.uan,
    esicIpNumber: form.esicIpNumber,
    emergencyContactName: form.emergencyContactName,
    emergencyContactPhone: form.emergencyContactPhone,
    emergencyContactRelation: form.emergencyContactRelation,
    notes: form.notes,
  };
  for (const [key, value] of Object.entries(optional)) {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed !== "" && trimmed != null) payload[key] = trimmed;
  }
  return payload;
}

function emptyPersonForm(worker) {
  return {
    firstName: worker ? worker.firstName || "" : "",
    lastName: worker ? worker.lastName || "" : "",
    fatherOrHusbandName: worker ? worker.fatherOrHusbandName || "" : "",
    dateOfBirth: worker ? dateOnly(worker.dateOfBirth) : "",
    gender: worker ? worker.gender || "" : "",
    dateOfJoining: worker ? dateOnly(worker.dateOfJoining) : todayDate(),
    phone: worker ? worker.phone || "" : "",
    email: worker ? worker.email || "" : "",
    addressLine1: worker ? worker.addressLine1 || "" : "",
    addressLine2: worker ? worker.addressLine2 || "" : "",
    city: worker ? worker.city || "" : "",
    state: worker ? worker.state || "" : "",
    pincode: worker ? worker.pincode || "" : "",
    aadhaar: "",
    pan: "",
    uan: worker ? worker.uan || "" : "",
    esicIpNumber: worker ? worker.esicIpNumber || "" : "",
    emergencyContactName: worker ? worker.emergencyContactName || "" : "",
    emergencyContactPhone: worker ? worker.emergencyContactPhone || "" : "",
    emergencyContactRelation: worker ? worker.emergencyContactRelation || "" : "",
    notes: worker ? worker.notes || "" : "",
  };
}

export function WorkerFormModal({ mode = "create", worker, capabilities, onClose, onSaved }) {
  const [form, setForm] = useState(() => emptyPersonForm(worker));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasExistingSensitive = Boolean(worker && (worker.aadhaarOnFile || worker.panMasked));
  const [preserveSensitive, setPreserveSensitive] = useState(Boolean(worker && capabilities?.canSensitive && hasExistingSensitive));
  const [clearAcknowledged, setClearAcknowledged] = useState(false);

  const editing = mode === "edit" && worker;

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = personErrors(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }

    const willClearAadhaar = Boolean(worker?.aadhaarOnFile) && !form.aadhaar.trim();
    const willClearPan = Boolean(worker?.panMasked) && !form.pan.trim();
    const needsClearAcknowledgement =
      editing && !capabilities?.canSensitive && (willClearAadhaar || willClearPan);
    if (needsClearAcknowledgement && !clearAcknowledged) {
      setFormError("Confirm that you understand saving will clear the current Aadhaar or PAN.");
      return;
    }

    setSaving(true);
    try {
      let currentSensitive = null;
      if (
        editing &&
        capabilities?.canSensitive &&
        preserveSensitive &&
        hasExistingSensitive &&
        (!form.aadhaar.trim() || !form.pan.trim())
      ) {
        currentSensitive = await getWorkerSensitive(worker.id);
      }

      const payload = basePayload(form);
      const aadhaarValue =
        form.aadhaar.trim() || (preserveSensitive ? currentSensitive?.aadhaar || "" : "");
      const panValue =
        form.pan.trim().toUpperCase() || (preserveSensitive ? currentSensitive?.pan || "" : "");

      if (editing && preserveSensitive) {
        if (worker.aadhaarOnFile && !aadhaarValue) {
          throw new Error("The existing Aadhaar could not be read, so the update was cancelled to avoid clearing it.");
        }
        if (worker.panMasked && !panValue) {
          throw new Error("The existing PAN could not be read, so the update was cancelled to avoid clearing it.");
        }
      }

      if (aadhaarValue) payload.aadhaar = aadhaarValue;
      if (panValue) payload.pan = panValue;

      const saved = editing ? await updateWorker(worker.id, payload) : await createWorker(payload);
      onSaved(saved);
    } catch (error) {
      setErrors(fieldsOf(error));
      setFormError(messageOf(error, editing ? "The worker could not be updated." : "The worker could not be onboarded."));
      setSaving(false);
    }
  }

  const clearingRisk =
    editing &&
    ((worker?.aadhaarOnFile && !form.aadhaar.trim()) || (worker?.panMasked && !form.pan.trim()));

  return (
    <Modal
      wide
      title={editing ? "Edit worker" : "Onboard worker"}
      description={
        editing
          ? "Update the worker record. The backend replaces Aadhaar and PAN with what is sent and clears them when omitted."
          : "New workers start on the bench. Their status becomes Deployed automatically when a posting is created."
      }
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="worker-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving...</> : editing ? "Save changes" : "Onboard worker"}
          </button>
        </>
      )}
    >
      <form id="worker-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        {editing && (
          <Notice tone="warn">
            The update endpoint clears Aadhaar and PAN when they are left out. Preserve or replace them deliberately.
          </Notice>
        )}
        <div className="cmFormGrid">
          <div className="cmFormRow">
            <Field label="First name" htmlFor="wk-first" required error={errors.firstName}>
              <input id="wk-first" type="text" maxLength={80} value={form.firstName} onChange={(event) => update("firstName", event.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="wk-last" error={errors.lastName}>
              <input id="wk-last" type="text" maxLength={80} value={form.lastName} onChange={(event) => update("lastName", event.target.value)} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Father or husband name" htmlFor="wk-guardian" error={errors.fatherOrHusbandName} hint="Required on the CLRA and PF registers.">
              <input id="wk-guardian" type="text" maxLength={120} value={form.fatherOrHusbandName} onChange={(event) => update("fatherOrHusbandName", event.target.value)} />
            </Field>
            <Field label="Gender" htmlFor="wk-gender" error={errors.gender}>
              <select id="wk-gender" value={form.gender} onChange={(event) => update("gender", event.target.value)}>
                <option value="">Not recorded</option>
                {WORKER_GENDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Date of birth" htmlFor="wk-dob" error={errors.dateOfBirth} hint="The worker must be 18 or older on the joining date.">
              <input id="wk-dob" type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} />
            </Field>
            <Field label="Date of joining" htmlFor="wk-doj" required error={errors.dateOfJoining}>
              <input id="wk-doj" type="date" value={form.dateOfJoining} onChange={(event) => update("dateOfJoining", event.target.value)} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Phone" htmlFor="wk-phone" error={errors.phone}>
              <input id="wk-phone" type="tel" maxLength={20} value={form.phone} onChange={(event) => update("phone", event.target.value)} />
            </Field>
            <Field label="Email" htmlFor="wk-email" error={errors.email}>
              <input id="wk-email" type="email" maxLength={160} value={form.email} onChange={(event) => update("email", event.target.value)} />
            </Field>
          </div>
          <Field label="Address line 1" htmlFor="wk-addr1" error={errors.addressLine1}>
            <input id="wk-addr1" type="text" maxLength={160} value={form.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} />
          </Field>
          <Field label="Address line 2" htmlFor="wk-addr2" error={errors.addressLine2}>
            <input id="wk-addr2" type="text" maxLength={160} value={form.addressLine2} onChange={(event) => update("addressLine2", event.target.value)} />
          </Field>
          <div className="cmFormRow">
            <Field label="City" htmlFor="wk-city" error={errors.city}>
              <input id="wk-city" type="text" maxLength={80} value={form.city} onChange={(event) => update("city", event.target.value)} />
            </Field>
            <Field label="State" htmlFor="wk-state" error={errors.state}>
              <input id="wk-state" type="text" maxLength={80} value={form.state} onChange={(event) => update("state", event.target.value)} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Pincode" htmlFor="wk-pin" error={errors.pincode}>
              <input id="wk-pin" type="text" inputMode="numeric" maxLength={10} value={form.pincode} onChange={(event) => update("pincode", event.target.value)} />
            </Field>
            <div />
          </div>

          <div className="cmDetailSection" style={{ marginTop: 0 }}>
            <h3>Statutory identifiers</h3>
            <div className="cmFormRow">
              <Field
                label="Aadhaar"
                htmlFor="wk-aadhaar"
                error={errors.aadhaar}
                hint={worker?.aadhaarMasked ? `On file: ${worker.aadhaarMasked}. Leave blank to keep it when preserving.` : "12 digits. Encrypted at rest and returned masked."}
              >
                <input id="wk-aadhaar" type="text" inputMode="numeric" maxLength={12} value={form.aadhaar} onChange={(event) => update("aadhaar", event.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field
                label="PAN"
                htmlFor="wk-pan"
                error={errors.pan}
                hint={worker?.panMasked ? `On file: ${worker.panMasked}. Leave blank to keep it when preserving.` : "Format ABCDE1234F. Encrypted at rest."}
              >
                <input id="wk-pan" type="text" maxLength={10} value={form.pan} onChange={(event) => update("pan", event.target.value.toUpperCase())} />
              </Field>
            </div>
            <div className="cmFormRow">
              <Field label="UAN" htmlFor="wk-uan" error={errors.uan} hint="PF universal account number.">
                <input id="wk-uan" type="text" maxLength={20} value={form.uan} onChange={(event) => update("uan", event.target.value)} />
              </Field>
              <Field label="ESIC IP number" htmlFor="wk-esic" error={errors.esicIpNumber}>
                <input id="wk-esic" type="text" maxLength={30} value={form.esicIpNumber} onChange={(event) => update("esicIpNumber", event.target.value)} />
              </Field>
            </div>

            {editing && capabilities?.canSensitive && (
              <label className="cmCheck">
                <input type="checkbox" checked={preserveSensitive} onChange={(event) => setPreserveSensitive(event.target.checked)} />
                <span>
                  Keep the current Aadhaar and PAN. This reads them from the audit-logged sensitive endpoint when saving.
                  {!preserveSensitive && " If you leave the fields blank, they will be cleared."}
                </span>
              </label>
            )}

            {editing && !capabilities?.canSensitive && hasExistingSensitive && clearingRisk && (
              <label className="cmCheck">
                <input type="checkbox" checked={clearAcknowledged} onChange={(event) => setClearAcknowledged(event.target.checked)} />
                <span>
                  I understand this update will clear the current Aadhaar and PAN, because this role cannot read them back.
                  Enter replacements above or ask an Admin or Accounts user to restore them.
                </span>
              </label>
            )}
          </div>

          <div className="cmDetailSection" style={{ marginTop: 0 }}>
            <h3>Emergency contact</h3>
            <div className="cmFormRow">
              <Field label="Name" htmlFor="wk-em-name" error={errors.emergencyContactName}>
                <input id="wk-em-name" type="text" maxLength={120} value={form.emergencyContactName} onChange={(event) => update("emergencyContactName", event.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="wk-em-phone" error={errors.emergencyContactPhone}>
                <input id="wk-em-phone" type="tel" maxLength={20} value={form.emergencyContactPhone} onChange={(event) => update("emergencyContactPhone", event.target.value)} />
              </Field>
            </div>
            <div className="cmFormRow">
              <Field label="Relation" htmlFor="wk-em-relation" error={errors.emergencyContactRelation}>
                <input id="wk-em-relation" type="text" maxLength={60} value={form.emergencyContactRelation} onChange={(event) => update("emergencyContactRelation", event.target.value)} />
              </Field>
              <div />
            </div>
          </div>

          <Field label="Notes" htmlFor="wk-notes" error={errors.notes} hint="Internal notes. Not shown to the worker.">
            <textarea id="wk-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function PoliceVerificationModal({ worker, onClose, onSaved }) {
  const [status, setStatus] = useState(worker.policeVerificationStatus || "NOT_STARTED");
  const [verifiedOn, setVerifiedOn] = useState(dateOnly(worker.policeVerificationDate));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await recordPoliceVerification(worker.id, {
        status,
        verifiedOn: verifiedOn || undefined,
      });
      onSaved(saved);
    } catch (err) {
      setError(messageOf(err, "The police verification could not be recorded."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Police verification"
      description={`${worker.fullName || "Worker"} - ${worker.employeeCode || "no code"}`}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="police-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving...</> : "Save verification"}
          </button>
        </>
      )}
    >
      <form id="police-form" className="cmForm" onSubmit={submit} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        <Notice tone="info">
          Verified and Not required permit deployment to security roles. Failed blocks it permanently.
          Upload the certificate separately under Documents.
        </Notice>
        <Field label="Status" htmlFor="pv-status" required>
          <select id="pv-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {POLICE_VERIFICATION_STATUSES.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Certificate issued on" htmlFor="pv-date" hint="Optional. The date on the certificate.">
          <input id="pv-date" type="date" value={verifiedOn} onChange={(event) => setVerifiedOn(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function WorkerExitModal({ worker, onClose, onSaved }) {
  const [status, setStatus] = useState("RESIGNED");
  const [lastWorkingDay, setLastWorkingDay] = useState(todayDate());
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const blocked = Boolean(worker.currentDeploymentId);

  async function submit(event) {
    event.preventDefault();
    if (saving || blocked) return;
    const found = {};
    if (!lastWorkingDay) found.lastWorkingDay = "The last working day is required.";
    if (worker.dateOfJoining && lastWorkingDay && lastWorkingDay < dateOnly(worker.dateOfJoining)) {
      found.lastWorkingDay = "The last working day cannot be before the joining date.";
    }
    if (!reason.trim()) found.reason = "A reason is required.";
    setErrors(found);
    setError("");
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const saved = await recordWorkerExit(worker.id, {
        status,
        lastWorkingDay,
        reason: reason.trim(),
      });
      onSaved(saved);
    } catch (err) {
      setErrors(fieldsOf(err));
      setError(messageOf(err, "The exit could not be recorded."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Record worker exit"
      description={`${worker.fullName || "Worker"} - ${worker.employeeCode || "no code"}`}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="exit-form" className="cmDangerButton cmBtn" disabled={saving || blocked}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving...</> : "Record exit"}
          </button>
        </>
      )}
    >
      <form id="exit-form" className="cmForm" onSubmit={submit} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        {blocked && (
          <Notice tone="error">
            This worker still holds an active posting. End the deployment before recording the exit, or they will keep
            appearing on the client attendance sheet and invoice.
          </Notice>
        )}
        <div className="cmFormRow">
          <Field label="Outcome" htmlFor="exit-status" required>
            <select id="exit-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </Field>
          <Field label="Last working day" htmlFor="exit-date" required error={errors.lastWorkingDay}>
            <input id="exit-date" type="date" value={lastWorkingDay} onChange={(event) => setLastWorkingDay(event.target.value)} />
          </Field>
        </div>
        <Field label="Reason" htmlFor="exit-reason" required error={errors.reason}>
          <textarea id="exit-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function SalaryStructureModal({ worker, onClose, onSaved }) {
  const [form, setForm] = useState({
    basic: "",
    da: "",
    hra: "",
    conveyance: "",
    otherAllowance: "",
    otRatePerHour: "",
    effectiveFrom: todayDate(),
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const gross = useMemo(
    () => ["basic", "da", "hra", "conveyance", "otherAllowance"].reduce((sum, key) => {
      const value = Number(form[key]);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0),
    [form],
  );

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const found = {};
    if (form.basic === "" || !Number.isFinite(Number(form.basic)) || Number(form.basic) < 0) {
      found.basic = "Basic pay is required and cannot be negative.";
    }
    if (!form.effectiveFrom) found.effectiveFrom = "The effective date is required.";
    if (worker.dateOfJoining && form.effectiveFrom && form.effectiveFrom < dateOnly(worker.dateOfJoining)) {
      found.effectiveFrom = "The effective date cannot be before the joining date.";
    }
    for (const key of ["da", "hra", "conveyance", "otherAllowance", "otRatePerHour"]) {
      if (form[key] !== "" && (!Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) {
        found[key] = "Enter a valid non-negative amount.";
      }
    }
    setErrors(found);
    setError("");
    if (Object.keys(found).length) return;

    const payload = {
      basic: Number(form.basic),
      effectiveFrom: form.effectiveFrom,
    };
    for (const key of ["da", "hra", "conveyance", "otherAllowance", "otRatePerHour"]) {
      if (form[key] !== "") payload[key] = Number(form[key]);
    }
    if (form.notes.trim()) payload.notes = form.notes.trim();

    setSaving(true);
    try {
      const saved = await createSalaryStructure(worker.id, payload);
      onSaved(saved);
    } catch (err) {
      setErrors(fieldsOf(err));
      setError(messageOf(err, "The wage structure could not be saved."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add wage revision"
      description={`${worker.fullName || "Worker"} - the current structure is closed the day before the new effective date.`}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="salary-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving...</> : "Save revision"}
          </button>
        </>
      )}
    >
      <form id="salary-form" className="cmForm" onSubmit={submit} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        <Notice tone="info">
          Wage history is dated. Revisions are not edited in place because payslips have already been issued.
        </Notice>
        <div className="cmFormRow">
          <Field label="Basic" htmlFor="sal-basic" required error={errors.basic}>
            <input id="sal-basic" type="number" min="0" step="0.01" value={form.basic} onChange={(event) => update("basic", event.target.value)} />
          </Field>
          <Field label="Dearness allowance (DA)" htmlFor="sal-da" error={errors.da} hint="Part of the PF base.">
            <input id="sal-da" type="number" min="0" step="0.01" value={form.da} onChange={(event) => update("da", event.target.value)} />
          </Field>
        </div>
        <div className="cmFormRow">
          <Field label="HRA" htmlFor="sal-hra" error={errors.hra}>
            <input id="sal-hra" type="number" min="0" step="0.01" value={form.hra} onChange={(event) => update("hra", event.target.value)} />
          </Field>
          <Field label="Conveyance" htmlFor="sal-conv" error={errors.conveyance}>
            <input id="sal-conv" type="number" min="0" step="0.01" value={form.conveyance} onChange={(event) => update("conveyance", event.target.value)} />
          </Field>
        </div>
        <div className="cmFormRow">
          <Field label="Other allowance" htmlFor="sal-other" error={errors.otherAllowance}>
            <input id="sal-other" type="number" min="0" step="0.01" value={form.otherAllowance} onChange={(event) => update("otherAllowance", event.target.value)} />
          </Field>
          <Field label="Overtime rate per hour" htmlFor="sal-ot" error={errors.otRatePerHour}>
            <input id="sal-ot" type="number" min="0" step="0.01" value={form.otRatePerHour} onChange={(event) => update("otRatePerHour", event.target.value)} />
          </Field>
        </div>
        <div className="cmFormRow">
          <Field label="Effective from" htmlFor="sal-from" required error={errors.effectiveFrom}>
            <input id="sal-from" type="date" value={form.effectiveFrom} onChange={(event) => update("effectiveFrom", event.target.value)} />
          </Field>
          <Field label="Gross (calculated)" htmlFor="sal-gross">
            <input id="sal-gross" type="text" value={gross.toFixed(2)} readOnly disabled />
          </Field>
        </div>
        <Field label="Notes" htmlFor="sal-notes" error={errors.notes}>
          <textarea id="sal-notes" rows={2} maxLength={1000} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function WorkerDocumentUploadModal({ worker, onClose, onSaved }) {
  const [form, setForm] = useState({
    documentType: "AADHAAR",
    referenceNumber: "",
    issuedOn: "",
    expiresOn: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const expectsExpiry = DOCUMENT_TYPES_WITH_EXPIRY.includes(form.documentType);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const found = {};
    if (!form.documentType) found.documentType = "Choose a document type.";
    const fileError = validateWorkerDocumentFile(file);
    if (fileError) found.file = fileError;
    if (form.issuedOn && form.expiresOn && form.expiresOn < form.issuedOn) {
      found.expiresOn = "The expiry date cannot be before the issue date.";
    }
    setErrors(found);
    setError("");
    if (Object.keys(found).length) return;

    const metadata = { documentType: form.documentType };
    if (form.referenceNumber.trim()) metadata.referenceNumber = form.referenceNumber.trim();
    if (form.issuedOn) metadata.issuedOn = form.issuedOn;
    if (form.expiresOn) metadata.expiresOn = form.expiresOn;

    setSaving(true);
    try {
      const saved = await uploadWorkerDocument(worker.id, { file, metadata });
      onSaved(saved);
    } catch (err) {
      setErrors(fieldsOf(err));
      setError(messageOf(err, "The document could not be uploaded."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Upload worker document"
      description={`${worker.fullName || "Worker"} - PDF, PNG or JPEG up to 10 MB.`}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="doc-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Uploading...</> : <><Upload size={15} /> Upload</>}
          </button>
        </>
      )}
    >
      <form id="doc-form" className="cmForm" onSubmit={submit} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        <div className="cmFormRow">
          <Field label="Document type" htmlFor="doc-type" required error={errors.documentType}>
            <select id="doc-type" value={form.documentType} onChange={(event) => update("documentType", event.target.value)}>
              {WORKER_DOCUMENT_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Reference number" htmlFor="doc-ref" error={errors.referenceNumber} hint="The number on the certificate, never an Aadhaar or PAN.">
            <input id="doc-ref" type="text" maxLength={80} value={form.referenceNumber} onChange={(event) => update("referenceNumber", event.target.value)} />
          </Field>
        </div>
        <div className="cmFormRow">
          <Field label="Issued on" htmlFor="doc-issued" error={errors.issuedOn}>
            <input id="doc-issued" type="date" value={form.issuedOn} onChange={(event) => update("issuedOn", event.target.value)} />
          </Field>
          <Field
            label="Expires on"
            htmlFor="doc-expires"
            error={errors.expiresOn}
            hint={expectsExpiry ? "Recommended for this document type. It drives renewal reminders." : "Optional."}
          >
            <input id="doc-expires" type="date" value={form.expiresOn} onChange={(event) => update("expiresOn", event.target.value)} />
          </Field>
        </div>
        <Field label="File" htmlFor="doc-file" required error={errors.file}>
          <input id="doc-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => { setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null); }} />
        </Field>
        {expectsExpiry && !form.expiresOn && (
          <Notice tone="warn">Without an expiry date this document will never be chased for renewal.</Notice>
        )}
      </form>
    </Modal>
  );
}

export function WorkerDocumentVerifyModal({ document, onClose, onSaved }) {
  const [decision, setDecision] = useState("VERIFIED");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (decision === "REJECTED" && !reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await verifyWorkerDocument(document.id, {
        status: decision,
        reason: decision === "REJECTED" ? reason.trim() : undefined,
      });
      onSaved(saved);
    } catch (err) {
      setError(messageOf(err, "The document decision could not be saved."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Verify document"
      description={`${document.documentTypeLabel || document.documentType || "Document"} - a decision cannot be changed later.`}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="verify-doc-form" className={decision === "REJECTED" ? "cmDangerButton cmBtn" : "primaryButton cmBtn"} disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving...</> : decision === "REJECTED" ? "Reject document" : "Accept document"}
          </button>
        </>
      )}
    >
      <form id="verify-doc-form" className="cmForm" onSubmit={submit} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        <Notice tone="warn">A decided document cannot be re-decided. Upload a replacement if it needs another look.</Notice>
        <Field label="Decision" htmlFor="verify-decision" required>
          <select id="verify-decision" value={decision} onChange={(event) => setDecision(event.target.value)}>
            <option value="VERIFIED">Accept as verified</option>
            <option value="REJECTED">Reject</option>
          </select>
        </Field>
        {decision === "REJECTED" && (
          <Field label="Rejection reason" htmlFor="verify-reason" required>
            <textarea id="verify-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        )}
      </form>
    </Modal>
  );
}

export function BankAccountModal({ worker, hasAccounts, onClose, onSaved }) {
  const [form, setForm] = useState({
    accountNumber: "",
    ifsc: "",
    bankName: "",
    branch: "",
    accountHolderName: "",
    primaryAccount: !hasAccounts,
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const found = {};
    const account = form.accountNumber.replace(/\s+/g, "");
    if (!/^\d{9,18}$/.test(account)) found.accountNumber = "Enter a valid account number of 9 to 18 digits.";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase())) {
      found.ifsc = "Enter a valid IFSC, for example HDFC0000123.";
    }
    setErrors(found);
    setError("");
    if (Object.keys(found).length) return;

    const payload = {
      accountNumber: account,
      ifsc: form.ifsc.trim().toUpperCase(),
      primaryAccount: Boolean(form.primaryAccount),
    };
    if (form.bankName.trim()) payload.bankName = form.bankName.trim();
    if (form.branch.trim()) payload.branch = form.branch.trim();
    if (form.accountHolderName.trim()) payload.accountHolderName = form.accountHolderName.trim();

    setSaving(true);
    try {
      const saved = await addBankAccount(worker.id, payload);
      onSaved(saved);
    } catch (err) {
      setErrors(fieldsOf(err));
      setError(messageOf(err, "The bank account could not be added."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add bank account"
      description={`${worker.fullName || "Worker"} - account numbers are encrypted at rest and returned masked.`}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="bank-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving...</> : "Add account"}
          </button>
        </>
      )}
    >
      <form id="bank-form" className="cmForm" onSubmit={submit} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        <div className="cmFormRow">
          <Field label="Account number" htmlFor="bank-account" required error={errors.accountNumber}>
            <input id="bank-account" type="text" inputMode="numeric" maxLength={18} value={form.accountNumber} onChange={(event) => update("accountNumber", event.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="IFSC" htmlFor="bank-ifsc" required error={errors.ifsc}>
            <input id="bank-ifsc" type="text" maxLength={11} value={form.ifsc} onChange={(event) => update("ifsc", event.target.value.toUpperCase())} />
          </Field>
        </div>
        <div className="cmFormRow">
          <Field label="Bank name" htmlFor="bank-name" error={errors.bankName}>
            <input id="bank-name" type="text" maxLength={120} value={form.bankName} onChange={(event) => update("bankName", event.target.value)} />
          </Field>
          <Field label="Branch" htmlFor="bank-branch" error={errors.branch}>
            <input id="bank-branch" type="text" maxLength={120} value={form.branch} onChange={(event) => update("branch", event.target.value)} />
          </Field>
        </div>
        <Field label="Account holder name" htmlFor="bank-holder" error={errors.accountHolderName} hint="Only when the bank holds a different spelling from the worker record.">
          <input id="bank-holder" type="text" maxLength={120} value={form.accountHolderName} onChange={(event) => update("accountHolderName", event.target.value)} />
        </Field>
        <label className="cmCheck">
          <input type="checkbox" checked={form.primaryAccount} onChange={(event) => update("primaryAccount", event.target.checked)} />
          <span>Make this the primary account wages are paid into. The first account becomes primary automatically.</span>
        </label>
      </form>
    </Modal>
  );
}

export function SensitiveWorkerModal({ worker, onClose }) {
  const [phase, setPhase] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [hiddenNotice, setHiddenNotice] = useState("");

  useEffect(() => {
    if (!data) return undefined;
    const timer = window.setTimeout(() => {
      setData(null);
      setPhase("idle");
      setHiddenNotice("The sensitive values were hidden automatically after 60 seconds.");
    }, 60000);
    return () => window.clearTimeout(timer);
  }, [data]);

  async function reveal() {
    setPhase("loading");
    setError("");
    setHiddenNotice("");
    try {
      const payload = await getWorkerSensitive(worker.id);
      setData(payload);
      setPhase("ready");
    } catch (err) {
      setError(messageOf(err, "The sensitive details could not be loaded."));
      setPhase("idle");
    }
  }

  function hide() {
    setData(null);
    setPhase("idle");
    setHiddenNotice("The sensitive values are hidden.");
  }

  return (
    <Modal
      title="Sensitive identifiers"
      description={`${worker.fullName || "Worker"} - access is recorded in the audit trail.`}
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      {error && <p className="actionError" role="alert">{error}</p>}
      {hiddenNotice && <Notice tone="info">{hiddenNotice}</Notice>}
      <Notice tone="warn">
        Every reveal writes a SENSITIVE_DATA_ACCESSED entry naming you and this worker. Do not screenshot, copy or share
        these values. They are never stored by this application.
      </Notice>
      {!data ? (
        <div className="cmSensitiveGate">
          <ShieldAlert size={26} />
          <p>The Aadhaar and PAN are not loaded until you ask for them.</p>
          <button type="button" className="primaryButton cmBtn" onClick={reveal} disabled={phase === "loading"}>
            {phase === "loading" ? <><Loader2 size={15} className="spin" /> Loading...</> : <><Eye size={15} /> Reveal Aadhaar and PAN</>}
          </button>
        </div>
      ) : (
        <div className="cmSensitiveBox">
          <div className="cmDetailGrid">
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Aadhaar</span>
              <span className="cmDetailValue cmSensitiveValue">{data.aadhaar || "Not on file"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">PAN</span>
              <span className="cmDetailValue cmSensitiveValue">{data.pan || "Not on file"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">UAN</span>
              <span className="cmDetailValue">{data.uan || "Not recorded"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">ESIC IP number</span>
              <span className="cmDetailValue">{data.esicIpNumber || "Not recorded"}</span>
            </div>
          </div>
          <button type="button" className="secondaryButton cmBtn" onClick={hide}>Hide now</button>
        </div>
      )}
    </Modal>
  );
}

export function WorkerLookupModal({ onClose, onOpenWorker }) {
  const [aadhaar, setAadhaar] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(undefined);

  async function search(event) {
    event.preventDefault();
    if (busy) return;
    if (!isAadhaar(aadhaar)) {
      setError("Enter the 12-digit Aadhaar number.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const payload = await lookupWorkerByAadhaar(aadhaar);
      setResult(payload || null);
    } catch (err) {
      setError(messageOf(err, "The Aadhaar lookup could not be completed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Find a worker by Aadhaar"
      description="For the walk-in desk: check whether this person has been onboarded before."
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      <form className="cmForm" onSubmit={search} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        <Notice tone="info">The number is hashed on the server and never logged. Only masked summary details are returned.</Notice>
        <div className="cmFormRow">
          <Field label="Aadhaar number" htmlFor="lookup-aadhaar" required>
            <input
              id="lookup-aadhaar"
              type="text"
              inputMode="numeric"
              maxLength={12}
              value={aadhaar}
              onChange={(event) => setAadhaar(event.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <div className="cmLookupAction">
            <button type="submit" className="primaryButton cmBtn" disabled={busy}>
              {busy ? <><Loader2 size={15} className="spin" /> Searching...</> : "Search"}
            </button>
          </div>
        </div>
      </form>
      {result === null && <Notice tone="info">No worker holds that Aadhaar. They can be onboarded as a new worker.</Notice>}
      {result && (
        <div className="cmLookupResult">
          <div>
            <strong>{result.fullName || "Worker"}</strong>
            <span className="cmMuted">{result.employeeCode || "No code"} - {workerSummaryLine(result)}</span>
            <span className="cmMuted">{result.currentDeploymentLabel || "Currently on the bench"}</span>
          </div>
          <button type="button" className="primaryButton cmBtn" onClick={() => onOpenWorker(result.id)}>Open profile</button>
        </div>
      )}
    </Modal>
  );
}

function workerSummaryLine(worker) {
  const parts = [];
  if (worker.status) parts.push(String(worker.status).replace(/_/g, " ").toLowerCase());
  if (worker.policeVerificationStatus) parts.push(`police: ${String(worker.policeVerificationStatus).replace(/_/g, " ").toLowerCase()}`);
  if (worker.dateOfJoining) parts.push(`joined ${dateOnly(worker.dateOfJoining)}`);
  return parts.join(" - ") || "No further details";
}

export function ConvertToWorkerModal({ application, onClose, onConverted }) {
  const [form, setForm] = useState({
    dateOfJoining: todayDate(),
    fatherOrHusbandName: "",
    dateOfBirth: "",
    gender: "",
    aadhaar: "",
    pan: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [converted, setConverted] = useState(null);
  const joined = application && application.status === "JOINED";

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || !joined) return;
    const found = {};
    if (!form.dateOfJoining) found.dateOfJoining = "The joining date is required.";
    if (form.aadhaar && !isAadhaar(form.aadhaar)) found.aadhaar = "Enter a 12-digit Aadhaar number.";
    if (form.pan && !isPan(form.pan)) found.pan = "Enter a valid PAN, for example ABCDE1234F.";
    if (form.dateOfBirth && form.dateOfJoining && form.dateOfBirth > form.dateOfJoining) {
      found.dateOfBirth = "Date of birth cannot be after the joining date.";
    } else if (form.dateOfBirth && form.dateOfJoining) {
      const age = ageOnDate(form.dateOfBirth, form.dateOfJoining);
      if (age != null && age < 18) found.dateOfBirth = "The worker must be 18 or older on the joining date.";
    }
    setErrors(found);
    setError("");
    if (Object.keys(found).length) return;

    const payload = { dateOfJoining: form.dateOfJoining };
    if (form.fatherOrHusbandName.trim()) payload.fatherOrHusbandName = form.fatherOrHusbandName.trim();
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
    if (form.gender) payload.gender = form.gender;
    if (form.aadhaar) payload.aadhaar = form.aadhaar;
    if (form.pan) payload.pan = form.pan.toUpperCase();

    setSaving(true);
    try {
      const worker = await convertApplicationToWorker(application.id, payload);
      setConverted(worker);
      setSaving(false);
    } catch (err) {
      setErrors(fieldsOf(err));
      setError(messageOf(err, "The application could not be converted to a worker."));
      setSaving(false);
    }
  }

  if (converted) {
    return (
      <Modal
        title="Application converted"
        description="The candidate is now on the bench and traceable to this application."
        onClose={() => onConverted(converted)}
        footer={<button type="button" className="primaryButton cmBtn" onClick={() => onConverted(converted)}>Done</button>}
      >
        <Notice tone="success">
          {converted.fullName || "The worker"} was onboarded as {converted.employeeCode || `worker #${converted.id}`}.
        </Notice>
        <div className="cmDetailGrid">
          <div className="cmDetailRow">
            <span className="cmDetailLabel">Employee code</span>
            <span className="cmDetailValue">{converted.employeeCode || "-"}</span>
          </div>
          <div className="cmDetailRow">
            <span className="cmDetailLabel">Status</span>
            <span className="cmDetailValue">{String(converted.status || "ON_BENCH").replace(/_/g, " ")}</span>
          </div>
          <div className="cmDetailRow">
            <span className="cmDetailLabel">Joined</span>
            <span className="cmDetailValue">{converted.dateOfJoining || "-"}</span>
          </div>
          <div className="cmDetailRow">
            <span className="cmDetailLabel">Worker id</span>
            <span className="cmDetailValue">#{converted.id}</span>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Convert to worker"
      description={application ? `${application.candidateName || "Candidate"} - ${application.jobTitle || `Job #${application.jobId}`}` : "Joined application"}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="convert-form" className="primaryButton cmBtn" disabled={saving || !joined}>
            {saving ? <><Loader2 size={15} className="spin" /> Converting...</> : <><UserPlus size={15} /> Create worker</>}
          </button>
        </>
      )}
    >
      <form id="convert-form" className="cmForm" onSubmit={submit} noValidate>
        {error && <p className="actionError" role="alert">{error}</p>}
        {!joined ? (
          <Notice tone="error">Only an application in the Joined stage can become a worker.</Notice>
        ) : (
          <Notice tone="info">
            Name, phone, email and the candidate link are carried across automatically. Add the statutory details that a
            candidate record does not hold.
          </Notice>
        )}
        <div className="cmFormRow">
          <Field label="Date of joining" htmlFor="conv-doj" required error={errors.dateOfJoining}>
            <input id="conv-doj" type="date" value={form.dateOfJoining} onChange={(event) => update("dateOfJoining", event.target.value)} />
          </Field>
          <Field label="Gender" htmlFor="conv-gender" error={errors.gender}>
            <select id="conv-gender" value={form.gender} onChange={(event) => update("gender", event.target.value)}>
              <option value="">Not recorded</option>
              {WORKER_GENDERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="cmFormRow">
          <Field label="Date of birth" htmlFor="conv-dob" error={errors.dateOfBirth}>
            <input id="conv-dob" type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} />
          </Field>
          <Field label="Father or husband name" htmlFor="conv-guardian" error={errors.fatherOrHusbandName}>
            <input id="conv-guardian" type="text" maxLength={120} value={form.fatherOrHusbandName} onChange={(event) => update("fatherOrHusbandName", event.target.value)} />
          </Field>
        </div>
        <div className="cmFormRow">
          <Field label="Aadhaar" htmlFor="conv-aadhaar" error={errors.aadhaar} hint="Optional now; can be added later.">
            <input id="conv-aadhaar" type="text" inputMode="numeric" maxLength={12} value={form.aadhaar} onChange={(event) => update("aadhaar", event.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="PAN" htmlFor="conv-pan" error={errors.pan} hint="Optional now; can be added later.">
            <input id="conv-pan" type="text" maxLength={10} value={form.pan} onChange={(event) => update("pan", event.target.value.toUpperCase())} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
