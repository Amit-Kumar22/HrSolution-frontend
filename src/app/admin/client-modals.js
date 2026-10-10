"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  approveClientRegistration,
  changeClientStatus,
  createClient,
  listIndustries,
  updateClient,
} from "@/lib/adminApi";
import {
  CLIENT_STATUS_OPTIONS,
  approveFormToPayload,
  clientFormToPayload,
  clientToForm,
  emptyApproveForm,
  emptyStatusForm,
  statusFormToPayload,
  statusLabel,
  statusTone,
  validateApproveForm,
  validateClientForm,
  validateStatusForm,
} from "@/lib/client-forms";
import { GST_STATES, stateCodeOf, stateNameOf } from "@/lib/gst-states";
import { Field, Modal, Notice, Chip } from "./admin-ui";

function mapPayloadErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") {
    return error.fields;
  }
  return {};
}

function errorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function StatusChip({ status }) {
  return <Chip tone={statusTone(status)}>{statusLabel(status)}</Chip>;
}

/* ------------------------------------------------------------------ */
/* Status change                                                       */
/* ------------------------------------------------------------------ */

export function ClientStatusDialog({ client, onClose, onDone }) {
  const [form, setForm] = useState(() => emptyStatusForm(client?.status === "PENDING_APPROVAL" ? "ACTIVE" : client?.status));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () => CLIENT_STATUS_OPTIONS.filter((value) => value !== "PENDING_APPROVAL"),
    [],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateStatusForm(form);
    if (form.status === "PENDING_APPROVAL") found.status = "A client cannot be moved back to Pending approval.";
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      await changeClientStatus(client.id, statusFormToPayload(form).status, statusFormToPayload(form).reason);
      onDone(form.status === "SUSPENDED"
        ? "Client suspended. New work is blocked; invoicing for completed work stays available."
        : "Client status updated.");
    } catch (error) {
      setErrors(mapPayloadErrors(error));
      setFormError(errorMessage(error, "The status could not be changed."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Change client status"
      description={`${client?.legalName || ""}${client?.clientCode ? ` · ${client.clientCode}` : ""}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="client-status-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : "Change status"}
          </button>
        </>
      )}
    >
      <form id="client-status-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <div className="cmFormRow">
          <Field label="Current status" htmlFor="status-current">
            <span className="cmStatusRow"><StatusChip status={client?.status} /></span>
          </Field>
          <Field label="New status" htmlFor="status-new" required error={errors.status}>
            <select id="status-new" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {options.map((value) => (
                <option key={value} value={value}>{statusLabel(value)}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Reason" htmlFor="status-reason" required error={errors.reason} hint="Stored on the audit trail.">
          <textarea
            id="status-reason"
            rows={3}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
        </Field>
        <Notice tone="info">
          Suspending a client stops new work being allocated, but invoicing and collection for work already
          completed remain available. A processed client can never be returned to Pending approval.
        </Notice>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit client (POST /clients, PUT /clients/{id})             */
/* ------------------------------------------------------------------ */

export function ClientFormDialog({ client, onClose, onDone }) {
  const isEdit = Boolean(client && client.id);
  const [form, setForm] = useState(() => clientToForm(client));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [industries, setIndustries] = useState([]);
  const [industriesLoaded, setIndustriesLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    listIndustries()
      .then((list) => { if (active) setIndustries(Array.isArray(list) ? list : []); })
      .catch(() => { if (active) setIndustries([]); })
      .finally(() => { if (active) setIndustriesLoaded(true); });
    return () => { active = false; };
  }, []);

  function onStateNameChange(name) {
    setForm((previous) => ({ ...previous, billingState: name, billingStateCode: stateCodeOf(name) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateClientForm(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateClient(client.id, clientFormToPayload(form));
        onDone("Client updated.");
      } else {
        await createClient(clientFormToPayload(form));
        onDone("Client created and set active.");
      }
    } catch (error) {
      setErrors(mapPayloadErrors(error));
      setFormError(errorMessage(error, isEdit ? "The client could not be updated." : "The client could not be created."));
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={isEdit ? "Edit client" : "Add client"}
      description={isEdit
        ? `${client?.legalName || ""}${client?.clientCode ? ` · ${client.clientCode}` : ""}`
        : "Created as ACTIVE, since staff adding a client directly have already vetted it."}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="client-form" className="primaryButton cmBtn" disabled={saving}>
            {saving
              ? <><Loader2 size={15} className="spin" /> {isEdit ? "Saving…" : "Creating…"}</>
              : isEdit ? "Save changes" : "Create client"}
          </button>
        </>
      )}
    >
      <form id="client-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        {!isEdit && (
          <Notice tone="info">
            GSTIN is optional now, but it is required before an invoice can be issued. Billing state code decides
            CGST+SGST versus IGST on every invoice.
          </Notice>
        )}
        <div className="cmFormGrid" style={!isEdit ? { marginTop: 14 } : undefined}>
          <div className="cmFormRow">
            <Field label="Legal name" htmlFor="c-legal" required error={errors.legalName}>
              <input id="c-legal" value={form.legalName} maxLength={200} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </Field>
            <Field label="Trade name" htmlFor="c-trade" error={errors.tradeName}>
              <input id="c-trade" value={form.tradeName} maxLength={200} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="GSTIN" htmlFor="c-gstin" error={errors.gstin} hint="15 characters">
              <input id="c-gstin" value={form.gstin} maxLength={15} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="PAN" htmlFor="c-pan" error={errors.pan}>
              <input id="c-pan" value={form.pan} maxLength={10} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="CIN" htmlFor="c-cin" error={errors.cin} hint="21 characters">
              <input id="c-cin" value={form.cin} maxLength={21} onChange={(e) => setForm({ ...form, cin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Industry" htmlFor="c-industry" hint={industriesLoaded ? undefined : "Loading industries…"}>
              <select
                id="c-industry"
                value={form.industryId}
                onChange={(e) => setForm({ ...form, industryId: e.target.value })}
                disabled={!industriesLoaded}
              >
                <option value="">Not specified</option>
                {industries.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Payment terms (days)" htmlFor="c-terms" required error={errors.paymentTermsDays} hint="0–365, default 30">
              <input
                id="c-terms"
                type="number"
                min="0"
                max="365"
                value={form.paymentTermsDays}
                onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
              />
            </Field>
            <Field label="Billing country" htmlFor="c-country">
              <input id="c-country" value={form.billingCountry} maxLength={100} onChange={(e) => setForm({ ...form, billingCountry: e.target.value })} />
            </Field>
          </div>
          <Field label="Billing address line 1" htmlFor="c-addr1">
            <input id="c-addr1" value={form.billingAddressLine1} maxLength={200} onChange={(e) => setForm({ ...form, billingAddressLine1: e.target.value })} />
          </Field>
          <Field label="Billing address line 2" htmlFor="c-addr2">
            <input id="c-addr2" value={form.billingAddressLine2} maxLength={200} onChange={(e) => setForm({ ...form, billingAddressLine2: e.target.value })} />
          </Field>
          <div className="cmFormRow">
            <Field label="Billing city" htmlFor="c-city">
              <input id="c-city" value={form.billingCity} maxLength={100} onChange={(e) => setForm({ ...form, billingCity: e.target.value })} />
            </Field>
            <Field label="Billing pincode" htmlFor="c-pin" error={errors.billingPincode}>
              <input id="c-pin" value={form.billingPincode} maxLength={6} onChange={(e) => setForm({ ...form, billingPincode: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Billing state" htmlFor="c-state" hint="Choosing a state sets its GST code.">
              <select id="c-state" value={form.billingState} onChange={(e) => onStateNameChange(e.target.value)}>
                <option value="">Select state</option>
                {GST_STATES.map((state) => (
                  <option key={state.code} value={state.name}>{state.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Billing state code" htmlFor="c-statecode" error={errors.billingStateCode} hint="2-digit GST state code">
              <input
                id="c-statecode"
                value={form.billingStateCode}
                maxLength={2}
                onChange={(e) => setForm({ ...form, billingStateCode: e.target.value })}
                onBlur={() => {
                  const code = form.billingStateCode.trim();
                  if (code && stateNameOf(code)) setForm((previous) => ({ ...previous, billingStateCode: code, billingState: stateNameOf(code) }));
                }}
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="c-notes" hint="Optional, up to 2000 characters">
            <textarea id="c-notes" rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Registration approval                                               */
/* ------------------------------------------------------------------ */

export function ApproveRegistrationDialog({ registration, onClose, onDone }) {
  const [form, setForm] = useState(() => emptyApproveForm(registration));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const declaredName = registration?.pendingCompanyName || "";

  function onStateCodeChange(code) {
    setForm((previous) => ({ ...previous, billingStateCode: code, billingState: stateNameOf(code) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateApproveForm(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      const payload = approveFormToPayload(form);
      await approveClientRegistration(Number(form.userId), payload);
      onDone(`${payload.legalName} approved. The client record was created, the registrant linked as primary contact and the account activated.`);
    } catch (error) {
      setErrors(mapPayloadErrors(error));
      setFormError(errorMessage(error, "The registration could not be approved."));
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title="Approve client registration"
      description={`User ID ${registration?.id} · ${registration?.email || ""}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="approve-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Approving…</> : "Approve registration"}
          </button>
        </>
      )}
    >
      <form id="approve-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <Notice tone="info">
          {declaredName
            ? <>The declared company name <strong>{declaredName}</strong> is kept as the trade name; you can correct the legal name before approving.</>
            : "Review and correct the legal name before approving."}
        </Notice>
        <div className="cmFormGrid" style={{ marginTop: 14 }}>
          <div className="cmFormRow">
            <Field label="User ID" htmlFor="a-user">
              <input id="a-user" value={form.userId} readOnly disabled />
            </Field>
            <Field label="Legal name" htmlFor="a-legal" required error={errors.legalName}>
              <input id="a-legal" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="GSTIN" htmlFor="a-gstin" error={errors.gstin}>
              <input id="a-gstin" value={form.gstin} maxLength={15} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="PAN" htmlFor="a-pan" error={errors.pan}>
              <input id="a-pan" value={form.pan} maxLength={10} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Billing city" htmlFor="a-city" required error={errors.billingCity}>
              <input id="a-city" value={form.billingCity} onChange={(e) => setForm({ ...form, billingCity: e.target.value })} />
            </Field>
            <Field label="Billing state" htmlFor="a-state" required error={errors.billingState}>
              <select id="a-state" value={form.billingState} onChange={(e) => setForm({ ...form, billingState: e.target.value })}>
                <option value="">Select state</option>
                {GST_STATES.map((state) => (
                  <option key={state.code} value={state.name}>{state.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Billing state code" htmlFor="a-statecode" required error={errors.billingStateCode}>
              <select id="a-statecode" value={form.billingStateCode} onChange={(e) => onStateCodeChange(e.target.value)}>
                <option value="">Select code</option>
                {GST_STATES.map((state) => (
                  <option key={state.code} value={state.code}>{state.code} · {state.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Designation" htmlFor="a-designation" required error={errors.designation}>
              <input id="a-designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Payment terms (days)" htmlFor="a-terms" required error={errors.paymentTermsDays}>
              <input
                id="a-terms"
                type="number"
                min="0"
                max="365"
                value={form.paymentTermsDays}
                onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}
