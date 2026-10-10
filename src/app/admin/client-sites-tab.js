"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Power, Trash2 } from "lucide-react";
import {
  createClientSite,
  deleteSite,
  getSite,
  listClientSites,
  setSiteActive,
  updateSite,
} from "@/lib/adminApi";
import {
  STATE_CODE_HINT,
  emptySiteForm,
  siteFormToPayload,
  siteToForm,
  validateSiteForm,
} from "@/lib/client-forms";
import { GST_STATES, stateNameOf } from "@/lib/gst-states";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  Notice,
  Switch,
} from "./admin-ui";

function mapPayloadErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") return error.fields;
  return {};
}

function errorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function SiteFormDialog({ client, site, onClose, onDone }) {
  const [form, setForm] = useState(() => (site ? siteToForm(site) : emptySiteForm()));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateSiteForm(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    const payload = siteFormToPayload(form);
    setSaving(true);
    try {
      if (site) {
        await updateSite(site.id, payload);
        onDone("Site updated.");
      } else {
        await createClientSite(client.id, payload);
        onDone("Site added.");
      }
    } catch (error) {
      setErrors(mapPayloadErrors(error));
      setFormError(errorMessage(error, site ? "The site could not be updated." : "The site could not be added."));
      setSaving(false);
    }
  }

  function onStateChange(name) {
    setForm((previous) => ({ ...previous, state: name }));
  }

  return (
    <Modal
      wide
      title={site ? "Edit site" : "Add site"}
      description={`${client?.legalName || ""}${site ? ` · ${site.siteCode}` : ""}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="site-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : site ? "Save changes" : "Add site"}
          </button>
        </>
      )}
    >
      <form id="site-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <div className="cmFormGrid">
          <div className="cmFormRow">
            <Field label="Site code" htmlFor="s-code" required error={errors.siteCode}>
              <input id="s-code" value={form.siteCode} onChange={(e) => setForm({ ...form, siteCode: e.target.value })} />
            </Field>
            <Field label="Site name" htmlFor="s-name" required error={errors.siteName}>
              <input id="s-name" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
            </Field>
          </div>
          <Field label="Address line 1" htmlFor="s-addr1">
            <input id="s-addr1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
          </Field>
          <Field label="Address line 2" htmlFor="s-addr2">
            <input id="s-addr2" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
          </Field>
          <div className="cmFormRow">
            <Field label="City" htmlFor="s-city" required error={errors.city}>
              <input id="s-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="Pincode" htmlFor="s-pincode" required error={errors.pincode}>
              <input id="s-pincode" value={form.pincode} maxLength={6} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="State" htmlFor="s-state" error={errors.state} hint="Choosing a state sets its GST code.">
              <select id="s-state" value={form.state} onChange={(e) => onStateChange(e.target.value)}>
                <option value="">Select state</option>
                {GST_STATES.map((state) => (
                  <option key={state.code} value={state.name}>{state.name}</option>
                ))}
              </select>
            </Field>
            <Field label="State code" htmlFor="s-statecode" required error={errors.stateCode} hint={STATE_CODE_HINT}>
              <input
                id="s-statecode"
                value={form.stateCode}
                maxLength={2}
                onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
                onBlur={() => {
                  const code = form.stateCode.trim();
                  if (code && stateNameOf(code) && !form.state) setForm({ ...form, stateCode: code, state: stateNameOf(code) });
                }}
              />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Site in-charge name" htmlFor="s-incharge">
              <input id="s-incharge" value={form.siteInchargeName} onChange={(e) => setForm({ ...form, siteInchargeName: e.target.value })} />
            </Field>
            <Field label="Site in-charge phone" htmlFor="s-phone" error={errors.siteInchargePhone}>
              <input id="s-phone" value={form.siteInchargePhone} onChange={(e) => setForm({ ...form, siteInchargePhone: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Site in-charge email" htmlFor="s-email" error={errors.siteInchargeEmail}>
              <input id="s-email" value={form.siteInchargeEmail} onChange={(e) => setForm({ ...form, siteInchargeEmail: e.target.value })} />
            </Field>
            <div className="cmSwitchRow">
              <span className="cmFieldLabel">Active</span>
              <Switch id="s-active" checked={form.active} onChange={(next) => setForm({ ...form, active: next })} label={form.active ? "Active" : "Inactive"} />
            </div>
          </div>
          <Notice tone="warn">{STATE_CODE_HINT}</Notice>
        </div>
      </form>
    </Modal>
  );
}

function SiteDetailDialog({ siteId, onClose }) {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSite(siteId)
      .then((data) => { if (active) setSite(data); })
      .catch((err) => { if (active) setError(errorMessage(err, "The site could not be loaded.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [siteId]);

  return (
    <Modal
      title="Site details"
      description={`Site #${siteId}`}
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      {loading ? <LoadingState label="Loading site…" /> : error ? (
        <p className="actionError" role="alert">{error}</p>
      ) : site && (
        <div className="cmDetailGrid">
          <div className="cmDetailRow"><span className="cmDetailLabel">Site code</span><span className="cmDetailValue">{site.siteCode}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">Site name</span><span className="cmDetailValue">{site.siteName}</span></div>
          <div className="cmDetailRow cmDetailFull"><span className="cmDetailLabel">Address</span><span className="cmDetailValue">{[site.addressLine1, site.addressLine2].filter(Boolean).join(", ") || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">City</span><span className="cmDetailValue">{site.city || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">Pincode</span><span className="cmDetailValue">{site.pincode || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">State</span><span className="cmDetailValue">{site.state || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">State code</span><span className="cmDetailValue">{site.stateCode || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">In-charge</span><span className="cmDetailValue">{site.siteInchargeName || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">In-charge phone</span><span className="cmDetailValue">{site.siteInchargePhone || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">In-charge email</span><span className="cmDetailValue">{site.siteInchargeEmail || "—"}</span></div>
          <div className="cmDetailRow"><span className="cmDetailLabel">Status</span><span className="cmDetailValue">{site.active ? <Chip tone="success">Active</Chip> : <Chip tone="neutral">Inactive</Chip>}</span></div>
        </div>
      )}
    </Modal>
  );
}

export default function ClientSitesTab({ client, onChanged }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [formDialog, setFormDialog] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listClientSites(client.id);
      setSites(Array.isArray(list) ? list : []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Sites could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load(cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function toggleActive(site) {
    if (busyId) return;
    setBusyId(site.id);
    const next = !site.active;
    try {
      await setSiteActive(site.id, next);
      setSites((current) => current.map((item) => (item.id === site.id ? { ...item, active: next } : item)));
      if (typeof onChanged === "function") onChanged();
    } catch (err) {
      setError(errorMessage(err, "The site status could not be changed."));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteSite(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      if (typeof onChanged === "function") onChanged();
    } catch (err) {
      setError(errorMessage(err, "The site could not be deleted."));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="cmToolbar cmToolbarStart">
        <span className="cmCount">{sites.length} site{sites.length === 1 ? "" : "s"}</span>
        <button type="button" className="primaryButton cmBtn" onClick={() => setFormDialog({ site: null })}>
          <Plus size={15} /> Add site
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading sites…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : sites.length === 0 ? (
        <EmptyState icon={MapPin} title="No sites" message="Add the first site for this client." />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Site</th>
                <th>Address</th>
                <th>City / State</th>
                <th>Code</th>
                <th>In-charge</th>
                <th className="cmColCenter">Active</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  <td>
                    <div className="cmEntity">
                      <span className="cmIconTile"><MapPin size={16} /></span>
                      <span>
                        <strong>{site.siteName}</strong>
                        <small className="cmMuted cmBlock cmCode">{site.siteCode}</small>
                      </span>
                    </div>
                  </td>
                  <td className="cmMuted cmCellWrap">{[site.addressLine1, site.addressLine2].filter(Boolean).join(", ") || "—"}</td>
                  <td className="cmMuted">{[site.city, site.state].filter(Boolean).join(", ") || "—"}</td>
                  <td><Chip tone="info">{site.stateCode || "—"}</Chip></td>
                  <td className="cmMuted">
                    <span className="cmBlock">{site.siteInchargeName || "—"}</span>
                    <small>{site.siteInchargePhone || ""}</small>
                  </td>
                  <td className="cmColCenter">
                    <Switch
                      id={`site-active-${site.id}`}
                      checked={Boolean(site.active)}
                      disabled={busyId === site.id}
                      onChange={() => toggleActive(site)}
                    />
                  </td>
                  <td className="cmColActions">
                    <div className="cmRowActions">
                      <button type="button" className="cmIconButton" title="View site" aria-label="View site" onClick={() => setDetailId(site.id)}>
                        <MapPin size={15} />
                      </button>
                      <button type="button" className="cmIconButton" title="Edit site" aria-label="Edit site" onClick={() => setFormDialog({ site })}>
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="cmIconButton"
                        title={site.active ? "Deactivate site" : "Activate site"}
                        aria-label={site.active ? "Deactivate site" : "Activate site"}
                        disabled={busyId === site.id}
                        onClick={() => toggleActive(site)}
                      >
                        <Power size={15} />
                      </button>
                      <button
                        type="button"
                        className="cmIconButton cmIconDanger"
                        title="Delete site"
                        aria-label="Delete site"
                        onClick={() => setDeleteTarget(site)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formDialog && (
        <SiteFormDialog
          client={client}
          site={formDialog.site}
          onClose={() => setFormDialog(null)}
          onDone={(message) => {
            setFormDialog(null);
            if (typeof onChanged === "function") onChanged(message);
            load();
          }}
        />
      )}

      {detailId && <SiteDetailDialog siteId={detailId} onClose={() => setDetailId(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete site"
          message={`Delete “${deleteTarget.siteName}” (${deleteTarget.siteCode})? This is a soft delete and the site stays in historical payroll records. If the site has been used before, deactivating it is preferred.`}
          confirmLabel="Delete site"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}
