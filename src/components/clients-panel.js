"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Eye,
  Filter,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { createClient, listClients, updateClient } from "@/lib/adminApi";
import {
  CLIENT_STATUS_OPTIONS,
  clientFormToPayload,
  clientToForm,
  emptyClientForm,
  statusLabel,
  statusTone,
  validateClientForm,
} from "@/lib/client-forms";
import { GST_STATES, stateCodeOf, stateNameOf } from "@/lib/gst-states";
import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  Notice,
  SectionHead,
  formatDate,
  useFlash,
} from "../app/admin/admin-ui";

const PAGE_SIZES = [10, 20, 50];

function toStateOptions() {
  return GST_STATES
    .map((state) => ({ value: state.code, label: `${state.code} · ${state.name}` }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

function messageOf(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function mapPayloadErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") return error.fields;
  return {};
}

function StatusChip({ status }) {
  return <Chip tone={statusTone(status)}>{statusLabel(status)}</Chip>;
}

function SortHeader({ property, sort, onSort, children }) {
  const active = sort.property === property;
  const Icon = !active ? ArrowUpDown : sort.direction === "ASC" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      className={`saSort${active ? " saSortActive" : ""}`}
      onClick={() => onSort(property)}
      title={`Sort by ${children}`}
    >
      {children} <Icon size={12} />
    </button>
  );
}

function DetailRow({ label, value, wide = false }) {
  return (
    <div className={`cmDetailRow${wide ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit client (POST /clients, PUT /clients/{id})                */
/* ------------------------------------------------------------------ */

function ClientFormDialog({ client, onClose, onDone }) {
  const isEdit = Boolean(client && client.id);
  const [form, setForm] = useState(() => (client ? clientToForm(client) : emptyClientForm()));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
      const payload = clientFormToPayload(form);
      if (isEdit) {
        await updateClient(client.id, payload);
        onDone("Client updated.");
      } else {
        await createClient(payload);
        onDone("Client created and set active.");
      }
    } catch (error) {
      setErrors(mapPayloadErrors(error));
      setFormError(messageOf(error, isEdit ? "The client could not be updated." : "The client could not be created."));
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={isEdit ? "Edit client" : "Add client"}
      description={
        isEdit
          ? `${client?.legalName || ""}${client?.clientCode ? ` · ${client.clientCode}` : ""}`
          : "Created as ACTIVE, since staff adding a client directly have already vetted it."
      }
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="client-form-dialog" className="primaryButton cmBtn" disabled={saving}>
            {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create client"}
          </button>
        </>
      )}
    >
      <form id="client-form-dialog" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        {!isEdit && (
          <Notice tone="info">
            GSTIN is optional now, but it is required before an invoice can be issued. Billing state code decides
            CGST+SGST versus IGST on every invoice.
          </Notice>
        )}
        <div className="cmFormGrid" style={!isEdit ? { marginTop: 14 } : undefined}>
          <div className="cmFormRow">
            <Field label="Legal name" htmlFor="oc-legal" required error={errors.legalName}>
              <input id="oc-legal" value={form.legalName} maxLength={200} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </Field>
            <Field label="Trade name" htmlFor="oc-trade" error={errors.tradeName}>
              <input id="oc-trade" value={form.tradeName} maxLength={200} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="GSTIN" htmlFor="oc-gstin" error={errors.gstin} hint="15 characters, optional">
              <input id="oc-gstin" value={form.gstin} maxLength={15} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="PAN" htmlFor="oc-pan" error={errors.pan}>
              <input id="oc-pan" value={form.pan} maxLength={10} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="CIN" htmlFor="oc-cin" error={errors.cin} hint="21 characters">
              <input id="oc-cin" value={form.cin} maxLength={21} onChange={(e) => setForm({ ...form, cin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Industry ID" htmlFor="oc-industry" hint="Optional numeric industry identifier">
              <input
                id="oc-industry"
                type="number"
                min="0"
                value={form.industryId}
                onChange={(e) => setForm({ ...form, industryId: e.target.value })}
              />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Payment terms (days)" htmlFor="oc-terms" required error={errors.paymentTermsDays} hint="0–365, default 30">
              <input
                id="oc-terms"
                type="number"
                min="0"
                max="365"
                value={form.paymentTermsDays}
                onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
              />
            </Field>
            <Field label="Billing country" htmlFor="oc-country">
              <input id="oc-country" value={form.billingCountry} maxLength={100} onChange={(e) => setForm({ ...form, billingCountry: e.target.value })} />
            </Field>
          </div>
          <Field label="Billing address line 1" htmlFor="oc-addr1">
            <input id="oc-addr1" value={form.billingAddressLine1} maxLength={200} onChange={(e) => setForm({ ...form, billingAddressLine1: e.target.value })} />
          </Field>
          <Field label="Billing address line 2" htmlFor="oc-addr2">
            <input id="oc-addr2" value={form.billingAddressLine2} maxLength={200} onChange={(e) => setForm({ ...form, billingAddressLine2: e.target.value })} />
          </Field>
          <div className="cmFormRow">
            <Field label="Billing city" htmlFor="oc-city">
              <input id="oc-city" value={form.billingCity} maxLength={100} onChange={(e) => setForm({ ...form, billingCity: e.target.value })} />
            </Field>
            <Field label="Billing pincode" htmlFor="oc-pin" error={errors.billingPincode}>
              <input id="oc-pin" value={form.billingPincode} maxLength={6} onChange={(e) => setForm({ ...form, billingPincode: e.target.value })} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Billing state" htmlFor="oc-state" hint="Choosing a state sets its GST code.">
              <select id="oc-state" value={form.billingState} onChange={(e) => onStateNameChange(e.target.value)}>
                <option value="">Select state</option>
                {GST_STATES.map((state) => (
                  <option key={state.code} value={state.name}>{state.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Billing state code" htmlFor="oc-statecode" error={errors.billingStateCode} hint="2-digit GST state code">
              <input
                id="oc-statecode"
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
          <Field label="Notes" htmlFor="oc-notes" hint="Optional, up to 2000 characters">
            <textarea id="oc-notes" rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* View client (from the list response only)                           */
/* ------------------------------------------------------------------ */

function ViewClientDialog({ client, onClose }) {
  return (
    <Modal
      title={client.legalName || "Client details"}
      description={`${client.clientCode ? `Client code ${client.clientCode} · ` : ""}${client.status || ""}`}
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      <div className="cmStatusRow" style={{ marginBottom: 14 }}>
        <StatusChip status={client.status} />
        {client.gstin && <Chip tone="info">{client.gstin}</Chip>}
      </div>
      <div className="cmDetailGrid">
        <DetailRow label="Client code" value={<span className="cmCode">{client.clientCode || "—"}</span>} />
        <DetailRow label="Legal name" value={client.legalName} />
        <DetailRow label="Display name" value={client.displayName} />
        <DetailRow label="GSTIN" value={client.gstin} />
        <DetailRow label="Billing city" value={client.billingCity} />
        <DetailRow label="Billing state" value={client.billingState} />
        <DetailRow label="Status" value={<StatusChip status={client.status} />} />
        <DetailRow label="GST treatment" value={client.gstTreatment} />
        <DetailRow label="Onboarded date" value={formatDate(client.onboardedOn)} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Clients panel (manage for Operator, read-only for HR)               */
/* ------------------------------------------------------------------ */

export default function ClientsPanel({ readOnly = false }) {
  const [pageData, setPageData] = useState({
    content: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
    empty: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flash, showFlash] = useFlash();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateCodeFilter, setStateCodeFilter] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [sort, setSort] = useState({ property: "legalName", direction: "ASC" });

  const [reloadToken, setReloadToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);

  const stateOptions = useMemo(() => toStateOptions(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listClients({
          search: search || undefined,
          status: statusFilter || undefined,
          stateCode: stateCodeFilter || undefined,
          page,
          size,
          sort: [`${sort.property},${sort.direction}`],
        });
        if (cancelled) return;
        setPageData(data);
        setLoadError("");
      } catch (error) {
        if (!cancelled) setLoadError(messageOf(error, "Clients could not be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, stateCodeFilter, page, size, sort, reloadToken]);

  function reload() {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }

  function toggleSort(property) {
    setPage(0);
    setSort((current) => (
      current.property === property
        ? { property, direction: current.direction === "ASC" ? "DESC" : "ASC" }
        : { property, direction: "ASC" }
    ));
  }

  const totalPages = pageData.totalPages || 0;
  const current = Math.min(page + 1, Math.max(totalPages, 1));

  return (
    <div>
      <SectionHead
        title={readOnly ? "Clients" : "Client management"}
        description={
          readOnly
            ? "Browse and search client companies. This is a read-only view."
            : "Search, review and maintain client companies. Add a new client or update an existing one."
        }
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar">
        <label className="cmSearchBox">
          <Search size={16} />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); setPage(0); }}
            placeholder="Search legal name, trade name, GSTIN, city"
          />
        </label>
        <div className="cmToolbarControls">
          <span className="cmCount">{pageData.totalElements} client{pageData.totalElements === 1 ? "" : "s"}</span>
          <label className="cmSelect">
            <ListFilter size={14} />
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
              <option value="">All statuses</option>
              {CLIENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <Filter size={14} />
            <select value={stateCodeFilter} onChange={(event) => { setStateCodeFilter(event.target.value); setPage(0); }}>
              <option value="">All states</option>
              {stateOptions.map((state) => (
                <option key={state.value} value={state.value}>{state.label}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <span>Per page</span>
            <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
          {!readOnly && (
            <button type="button" className="primaryButton cmBtn" onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> Add client
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading clients…" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : pageData.content.length === 0 ? (
        <EmptyState icon={Building2} title="No clients found" message="Adjust your search or filters to see clients." />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <th><SortHeader property="legalName" sort={sort} onSort={toggleSort}>Client</SortHeader></th>
                  <th><SortHeader property="clientCode" sort={sort} onSort={toggleSort}>Client code</SortHeader></th>
                  <th>GSTIN</th>
                  <th>Billing city</th>
                  <th>Billing state</th>
                  <th>Status</th>
                  <th>GST treatment</th>
                  <th><SortHeader property="onboardedOn" sort={sort} onSort={toggleSort}>Onboarded</SortHeader></th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageData.content.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="cmEntity">
                        <span className="cmIconTile"><Building2 size={16} /></span>
                        <span>
                          <strong>{client.legalName || client.displayName || "—"}</strong>
                          {client.displayName && client.displayName !== client.legalName && (
                            <small className="cmMuted cmBlock">{client.displayName}</small>
                          )}
                        </span>
                      </div>
                    </td>
                    <td><span className="cmCode">{client.clientCode || "—"}</span></td>
                    <td className="cmMuted">{client.gstin || "—"}</td>
                    <td className="cmMuted">{client.billingCity || "—"}</td>
                    <td className="cmMuted">{client.billingState || "—"}</td>
                    <td><StatusChip status={client.status} /></td>
                    <td className="cmMuted">{client.gstTreatment || "—"}</td>
                    <td className="cmMuted">{formatDate(client.onboardedOn)}</td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button type="button" className="cmIconButton" title="View client" aria-label="View client" onClick={() => setViewTarget(client)}>
                          <Eye size={15} />
                        </button>
                        {!readOnly && (
                          <button type="button" className="cmIconButton" title="Edit client" aria-label="Edit client" onClick={() => setEditTarget(client)}>
                            <Pencil size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cmPagination">
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page <= 0}
            >
              Previous
            </button>
            <span className="cmPageInfo">Page {current} of {Math.max(totalPages, 1)}</span>
            <button
              type="button"
              className="secondaryButton cmBtn cmPageBtn"
              onClick={() => setPage((value) => (value + 1 < totalPages ? value + 1 : value))}
              disabled={page + 1 >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}

      {viewTarget && <ViewClientDialog client={viewTarget} onClose={() => setViewTarget(null)} />}

      {!readOnly && createOpen && (
        <ClientFormDialog
          client={null}
          onClose={() => setCreateOpen(false)}
          onDone={(message) => {
            setCreateOpen(false);
            showFlash("success", message || "Client created.");
            reload();
          }}
        />
      )}

      {!readOnly && editTarget && (
        <ClientFormDialog
          client={editTarget}
          onClose={() => setEditTarget(null)}
          onDone={(message) => {
            setEditTarget(null);
            showFlash("success", message || "Client updated.");
            reload();
          }}
        />
      )}
    </div>
  );
}
