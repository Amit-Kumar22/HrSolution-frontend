"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Eye,
  FileSignature,
  FileText,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  activateContract,
  createClientContract,
  deleteContract,
  getClientContractInForce,
  getContract,
  listClientContracts,
  listClients,
  terminateContract,
  updateContract,
  uploadContractDocument,
} from "@/lib/adminApi";
import { getAuthSession, isInternalRole } from "@/lib/auth";
import {
  EMPTY_CONTRACT_FORM,
  SERVICE_CHARGE_TYPES,
  contractFormToPayload,
  contractStatusLabel,
  contractStatusTone,
  contractToForm,
  formatContractPeriod,
  isActiveContract,
  isDraftContract,
  serviceChargeLabel,
  serviceChargeTypeLabel,
  todayDateString,
  validateContractDocument,
  validateContractForm,
} from "@/lib/contract-forms";
import {
  Chip,
  ConfirmDialog,
  Drawer,
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
} from "./admin-ui";

function errorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function payloadErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") return error.fields;
  return {};
}

function ContractStatusChip({ contract }) {
  return <Chip tone={contractStatusTone(contract && contract.status)}>{contractStatusLabel(contract && contract.status)}</Chip>;
}

function DetailRow({ label, value, wide = false }) {
  return (
    <div className={`cmDetailRow${wide ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

function ContractFormDialog({ client, contract, onClose, onDone }) {
  const [form, setForm] = useState(() => (contract ? contractToForm(contract) : { ...EMPTY_CONTRACT_FORM, startDate: todayDateString() }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = validateContractForm(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      const payload = contractFormToPayload(form);
      if (contract) {
        await updateContract(contract.id, payload);
        onDone("Contract updated.");
      } else {
        await createClientContract(client.id, payload);
        onDone("Contract drafted. Activate it when the terms are agreed.");
      }
    } catch (error) {
      setErrors(payloadErrors(error));
      setFormError(errorMessage(error, contract ? "The contract could not be updated." : "The contract could not be created."));
      setSaving(false);
    }
  }

  const isPercentage = form.serviceChargeType === "PERCENTAGE";

  return (
    <Modal
      title={contract ? "Edit contract" : "Draft a contract"}
      description={
        contract
          ? `Correcting the terms of draft contract ${contract.contractNumber}.`
          : `New contracts are created as drafts. Activating a contract makes its terms binding and freezes them.`
      }
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="contract-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? "Saving…" : contract ? "Save changes" : "Create draft"}
          </button>
        </>
      )}
    >
      <form id="contract-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <div className="cmFormGrid">
          <div className="cmFormRow">
            <Field label="Contract number" htmlFor="ct-number" required error={errors.contractNumber} hint="Unique reference, e.g. BT/HRS/2026-27/01.">
              <input id="ct-number" type="text" maxLength={60} value={form.contractNumber} placeholder="BT/HRS/2026-27/01" onChange={(event) => update("contractNumber", event.target.value)} />
            </Field>
            <Field label="Title" htmlFor="ct-title" error={errors.title} hint="Optional short description of the engagement.">
              <input id="ct-title" type="text" maxLength={200} value={form.title} placeholder="Manpower supply - Pune and Nagpur plants" onChange={(event) => update("title", event.target.value)} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Start date" htmlFor="ct-start" required error={errors.startDate}>
              <input id="ct-start" type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
            </Field>
            <Field label="End date" htmlFor="ct-end" error={errors.endDate} hint="Leave empty for an open-ended contract. An open-ended active contract blocks any later one.">
              <input id="ct-end" type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Service charge type" htmlFor="ct-charge-type" required error={errors.serviceChargeType}>
              <select id="ct-charge-type" value={form.serviceChargeType} onChange={(event) => update("serviceChargeType", event.target.value)}>
                {SERVICE_CHARGE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </Field>
            <Field
              label={isPercentage ? "Service charge (%)" : "Service charge (₹ per worker)"}
              htmlFor="ct-charge"
              required
              error={errors.serviceChargeValue}
              hint={isPercentage ? "Percentage of wages billed to the client, e.g. 8.5." : "Rupees per deployed worker per month."}
            >
              <input id="ct-charge" type="number" min="0" step="0.01" value={form.serviceChargeValue} placeholder={isPercentage ? "8.5" : "1200"} onChange={(event) => update("serviceChargeValue", event.target.value)} />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Payment terms (days)" htmlFor="ct-terms" error={errors.paymentTermsDays} hint={`Optional. Overrides the client's default credit period${client && client.paymentTermsDays != null ? ` (${client.paymentTermsDays} days)` : ""}.`}>
              <input id="ct-terms" type="number" min="0" max="365" step="1" value={form.paymentTermsDays} placeholder="e.g. 45" onChange={(event) => update("paymentTermsDays", event.target.value)} />
            </Field>
            <div />
          </div>
          <Field label="Notes" htmlFor="ct-notes" error={errors.notes}>
            <textarea id="ct-notes" rows={3} maxLength={2000} value={form.notes} placeholder="Optional notes for this contract" onChange={(event) => update("notes", event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function TerminateDialog({ contract, onClose, onDone }) {
  const [terminatedOn, setTerminatedOn] = useState(todayDateString());
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const found = {};
    if (!terminatedOn) found.terminatedOn = "Choose a termination date.";
    else if (contract.startDate && terminatedOn < contract.startDate) found.terminatedOn = `Cannot be before the contract start date of ${contract.startDate}.`;
    if (!reason.trim()) found.reason = "A reason is required.";
    else if (reason.trim().length > 500) found.reason = "Reason must be 500 characters or fewer.";
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) {
      setFormError("Please correct the highlighted fields and try again.");
      return;
    }
    setSaving(true);
    try {
      await terminateContract(contract.id, { terminatedOn, reason: reason.trim() });
      onDone("Contract terminated. Billing after the termination date will find no contract in force.");
    } catch (error) {
      setErrors(payloadErrors(error));
      setFormError(errorMessage(error, "The contract could not be terminated."));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Terminate contract"
      description={`Terminate ${contract.contractNumber}${contract.title ? ` — ${contract.title}` : ""}. The termination date becomes the effective end date.`}
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="terminate-form" className="cmDangerButton cmBtn" disabled={saving}>
            {saving ? "Terminating…" : "Terminate contract"}
          </button>
        </>
      )}
    >
      <form id="terminate-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <Notice tone="warn">Once terminated a contract cannot be reactivated. Raise a successor contract for any continuing engagement.</Notice>
        <div className="cmFormGrid" style={{ marginTop: 12 }}>
          <Field label="Termination date" htmlFor="ct-term-date" required error={errors.terminatedOn}>
            <input id="ct-term-date" type="date" value={terminatedOn} onChange={(event) => setTerminatedOn(event.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="ct-term-reason" required error={errors.reason} hint="Recorded on the contract and in the audit log.">
            <textarea id="ct-term-reason" rows={3} maxLength={500} value={reason} placeholder="Why is this contract ending early?" onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function InForceDialog({ client, onClose }) {
  const [onDate, setOnDate] = useState(todayDateString());
  const [result, setResult] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  async function handleResolve(event) {
    event.preventDefault();
    if (resolving) return;
    setResolving(true);
    setError("");
    setResult(null);
    try {
      const data = await getClientContractInForce(client.id, onDate);
      setResult(data);
    } catch (err) {
      setError(errorMessage(err, "The in-force contract could not be resolved."));
    } finally {
      setResolving(false);
    }
  }

  return (
    <Modal
      wide
      title="Contract in force"
      description={`Find the single contract that applies to ${client.legalName || client.displayName || "this client"} on a chosen date. The backend decides; this screen shows its answer.`}
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      <form className="cmForm" onSubmit={handleResolve} noValidate>
        <div className="cmFormRow">
          <Field label="On date" htmlFor="ct-inforce-date" required hint="Defaults to today.">
            <input id="ct-inforce-date" type="date" value={onDate} onChange={(event) => setOnDate(event.target.value)} />
          </Field>
          <div className="cmSwitchRow" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="primaryButton cmBtn" disabled={resolving}>
              <CalendarCheck size={15} /> {resolving ? "Resolving…" : "Resolve contract"}
            </button>
          </div>
        </div>
      </form>

      {error && <p className="actionError" role="alert" style={{ marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <Notice tone="success">One contract is in force on the selected date.</Notice>
          <div className="cmDetailGrid" style={{ marginTop: 14 }}>
            <DetailRow label="Contract" value={result.contractNumber} />
            <DetailRow label="Title" value={result.title} />
            <DetailRow label="Period" value={formatContractPeriod(result)} />
            <DetailRow label="Service charge" value={serviceChargeLabel(result)} />
            <DetailRow label="Payment terms" value={`${result.effectivePaymentTermsDays} days`} />
            <DetailRow label="Status" value={<ContractStatusChip contract={result} />} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function ContractDetailDialog({ contractId, onClose, onChanged, canWrite }) {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [file, setFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    getContract(contractId)
      .then((data) => { if (active) { setContract(data); setError(""); } })
      .catch((err) => { if (active) setError(errorMessage(err, "The contract could not be loaded.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contractId, reloadToken]);

  async function handleUpload() {
    if (uploading) return;
    const found = validateContractDocument(file);
    if (found) {
      setUploadError(found);
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const updated = await uploadContractDocument(contractId, file);
      setContract(updated);
      setFile(null);
      setUploadSuccess("Document uploaded.");
      if (typeof onChanged === "function") onChanged();
    } catch (err) {
      setUploadError(errorMessage(err, "The document could not be uploaded."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Drawer
      size="lg"
      title="Contract details"
      description={contract ? `${contract.contractNumber}${contract.title ? ` — ${contract.title}` : ""}` : `Contract #${contractId}`}
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <LoadingState label="Loading contract…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); setReloadToken((token) => token + 1); }} />
      ) : contract ? (
        <>
          <div className="cmStatusRow" style={{ marginBottom: 12 }}>
            <ContractStatusChip contract={contract} />
            {contract.inForceToday ? <Chip tone="accent">In force today</Chip> : null}
            {contract.endDate ? null : <Chip tone="info">Open-ended</Chip>}
            <Chip tone="neutral">{contract.documentCount} document{contract.documentCount === 1 ? "" : "s"}</Chip>
          </div>

          <div className="cmDetailGrid">
            <DetailRow label="Client" value={contract.clientName} />
            <DetailRow label="Contract number" value={<span className="cmCode">{contract.contractNumber}</span>} />
            <DetailRow label="Title" value={contract.title} />
            <DetailRow label="Start date" value={formatDate(contract.startDate)} />
            <DetailRow label="End date" value={contract.endDate ? formatDate(contract.endDate) : "Ongoing (open-ended)"} />
            <DetailRow label="Service charge type" value={serviceChargeTypeLabel(contract.serviceChargeType)} />
            <DetailRow label="Service charge value" value={contract.serviceChargeValue} />
            <DetailRow label="Service charge" value={serviceChargeLabel(contract)} />
            <DetailRow label="Payment terms" value={contract.paymentTermsDays != null ? `${contract.paymentTermsDays} days` : "Client default"} />
            <DetailRow label="Effective payment terms" value={`${contract.effectivePaymentTermsDays} days`} />
            <DetailRow label="Days until expiry" value={contract.daysUntilExpiry != null ? `${contract.daysUntilExpiry} days` : contract.endDate ? "—" : "Open-ended"} />
            {contract.terminatedOn && <DetailRow label="Terminated on" value={formatDate(contract.terminatedOn)} />}
            {contract.terminationReason && <DetailRow label="Termination reason" value={contract.terminationReason} wide />}
            {contract.notes && <DetailRow label="Notes" value={contract.notes} wide />}
          </div>

          {contract.status === "ACTIVE" && (
            <div style={{ marginTop: 14 }}>
              <Notice tone="info">Terms are frozen while the contract is active. To change them, terminate this contract and raise a successor.</Notice>
            </div>
          )}

          <div className="cmDetailSection">
            <h3>Contract document</h3>
            <p className="cmMuted" style={{ marginTop: 0 }}>
              Attach the signed contract. PDF or image, up to 10 MB. Validated by content, and stored privately.
            </p>
            {canWrite ? (
              <div className="cmForm" style={{ marginTop: 8 }}>
                {uploadError && <p className="actionError" role="alert">{uploadError}</p>}
                {uploadSuccess && <p className="actionSuccess" role="status">{uploadSuccess}</p>}
                <Field label="Choose a file" htmlFor="ct-document" hint="PDF, PNG, JPEG or GIF. Up to 10 MB.">
                  <input id="ct-document" type="file" accept="application/pdf,image/*" onChange={(event) => { setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null); setUploadError(""); setUploadSuccess(""); }} />
                </Field>
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="primaryButton cmBtn" onClick={handleUpload} disabled={uploading || !file}>
                    <Upload size={15} /> {uploading ? "Uploading…" : "Upload document"}
                  </button>
                </div>
              </div>
            ) : (
              <Notice tone="info">{contract.documentCount} document{contract.documentCount === 1 ? "" : "s"} attached to this contract.</Notice>
            )}
          </div>
        </>
      ) : null}
    </Drawer>
  );
}

export default function ContractsPanel({ client = null, onChanged, embedded = false }) {
  const canWrite = isInternalRole(getAuthSession());

  const [clients, setClients] = useState([]);
  const [clientLoading, setClientLoading] = useState(!client);
  const [selectedClientId, setSelectedClientId] = useState(client ? String(client.id) : "");

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [flash, showFlash] = useFlash();

  const [formDialog, setFormDialog] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [inForceOpen, setInForceOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState(null);
  const [activateBusy, setActivateBusy] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [terminateTarget, setTerminateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const selectedClient = client || clients.find((entry) => String(entry.id) === selectedClientId) || null;
  const activeClientId = client ? client.id : selectedClientId;

  useEffect(() => {
    if (client) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const page = await listClients({ size: 100, sort: ["legalName,ASC"] });
        if (cancelled) return;
        setClients(Array.isArray(page && page.content) ? page.content : []);
      } catch {
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setClientLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client]);

  useEffect(() => {
    if (!activeClientId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await listClientContracts(activeClientId);
        if (cancelled) return;
        setContracts(data);
        setError("");
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, "Contracts could not be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeClientId, reloadToken]);

  function reload(message) {
    setLoading(true);
    setReloadToken((token) => token + 1);
    setContracts([]);
    setError("");
    if (typeof onChanged === "function") onChanged(message);
  }

  function handleClientChange(event) {
    const id = event.target.value;
    setSelectedClientId(id);
    setContracts([]);
    setError("");
    setSearch("");
    setStatusFilter("");
    setLoading(Boolean(id));
  }

  const stats = useMemo(() => {
    let draft = 0;
    let active = 0;
    let ended = 0;
    for (const contract of contracts) {
      if (contract.status === "DRAFT") draft += 1;
      else if (contract.status === "ACTIVE") active += 1;
      else ended += 1;
    }
    return { draft, active, ended };
  }, [contracts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (statusFilter && contract.status !== statusFilter) return false;
      if (!query) return true;
      return [contract.contractNumber, contract.title, contract.clientName, contract.serviceChargeLabel, contract.notes].some((value) =>
        String(value || "").toLowerCase().includes(query),
      );
    });
  }, [contracts, search, statusFilter]);

  async function confirmActivate() {
    if (!activateTarget || activateBusy) return;
    setActivateBusy(true);
    setActivateError("");
    try {
      await activateContract(activateTarget.id);
      setActivateTarget(null);
      showFlash("success", `Contract ${activateTarget.contractNumber} activated.`);
      reload();
    } catch (err) {
      setActivateError(errorMessage(err, "The contract could not be activated."));
    } finally {
      setActivateBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteContract(deleteTarget.id);
      setDeleteTarget(null);
      showFlash("success", "Contract deleted.");
      reload();
    } catch (err) {
      const message = errorMessage(err, "The contract could not be deleted.");
      setDeleteError(message);
      if (err && err.status === 422) setDeleteTarget(null);
      showFlash("error", message);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="cmContractsPanel">
      {embedded ? null : (
        <SectionHead
          title="Contracts & commercial terms"
          description="Draft, activate and terminate client contracts, and look up the contract in force on any date."
        />
      )}

      <FlashBanner flash={flash} />

      <div className="cmToolbar" style={{ marginTop: embedded ? 8 : 0 }}>
        {embedded ? null : (
          <label className="cmSelect cmClientSelect">
            <Building2 size={14} />
            <select value={selectedClientId} onChange={handleClientChange} disabled={clientLoading} aria-label="Select client">
              <option value="">{clientLoading ? "Loading clients…" : "Select a client"}</option>
              {clients.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.legalName || entry.displayName || `Client #${entry.id}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="cmSearchBox">
          <Search size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search number, title or notes"
            aria-label="Search contracts"
            disabled={!activeClientId}
          />
        </label>
        <div className="cmToolbarControls">
          <label className="cmSelect">
            <ListFilter size={14} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={!activeClientId}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </label>
          {activeClientId && selectedClient ? (
            <button type="button" className="secondaryButton cmBtn" onClick={() => setInForceOpen(true)}>
              <CalendarCheck size={15} /> In-force lookup
            </button>
          ) : null}
          <button type="button" className="secondaryButton cmBtn" onClick={() => reload()} disabled={loading || !activeClientId}>
            <RefreshCw size={15} /> Refresh
          </button>
          {canWrite && activeClientId && selectedClient ? (
            <button type="button" className="primaryButton cmBtn" onClick={() => setFormDialog({ contract: null })}>
              <Plus size={15} /> Add contract
            </button>
          ) : null}
        </div>
      </div>

      {!activeClientId ? (
        <EmptyState icon={Building2} title="Select a client" message="Choose a client to view and manage their contracts." />
      ) : loading ? (
        <LoadingState label="Loading contracts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No contracts yet"
          message={canWrite ? "Draft the first contract to capture the commercial terms for this client." : "This client has no contracts yet."}
        />
      ) : (
        <>
          <div className="cmStatusRow" style={{ marginTop: 12 }}>
            <Chip tone="info">{stats.draft} draft</Chip>
            <Chip tone="success">{stats.active} active</Chip>
            <Chip tone="neutral">{stats.ended} ended</Chip>
            <Chip tone="neutral">{contracts.length} total</Chip>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={FileSignature} title="No contracts match your filters" message="Adjust the search or status filter to see contracts." />
          ) : (
            <div className="cmTableWrap" style={{ marginTop: 12 }}>
              <table className="cmTable">
                <thead>
                  <tr>
                    <th>Contract</th>
                    {embedded ? null : <th>Client</th>}
                    <th>Period</th>
                    <th>Service charge</th>
                    <th>Payment terms</th>
                    <th className="cmColCenter">Status</th>
                    <th className="cmColCenter">Docs</th>
                    <th className="cmColActions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contract) => {
                    const draft = isDraftContract(contract);
                    const active = isActiveContract(contract);
                    return (
                      <tr key={contract.id}>
                        <td>
                          <div className="cmEntity">
                            <span className="cmIconTile"><FileSignature size={16} /></span>
                            <span>
                              <strong>{contract.contractNumber}</strong>
                              {contract.title && <small className="cmMuted cmBlock">{contract.title}</small>}
                            </span>
                          </div>
                        </td>
                        {embedded ? null : <td className="cmMuted">{contract.clientName || "—"}</td>}
                        <td className="cmMuted">
                          <span className="cmBlock">{formatContractPeriod(contract)}</span>
                          {contract.endDate && contract.daysUntilExpiry != null && contract.daysUntilExpiry >= 0 && (
                            <small>{contract.daysUntilExpiry} days left</small>
                          )}
                        </td>
                        <td className="cmMuted">
                          <span className="cmBlock">{contract.serviceChargeValue}</span>
                          <small>{serviceChargeLabel(contract)}</small>
                        </td>
                        <td className="cmMuted">
                          <span className="cmBlock">{contract.effectivePaymentTermsDays} days</span>
                          {contract.paymentTermsDays == null && <small>client default</small>}
                        </td>
                        <td className="cmColCenter">
                          <ContractStatusChip contract={contract} />
                          {contract.inForceToday && <span className="cmBlock" style={{ marginTop: 4 }}><Chip tone="accent">In force</Chip></span>}
                          {contract.terminatedOn && <small className="cmMuted cmBlock">on {formatDate(contract.terminatedOn)}</small>}
                        </td>
                        <td className="cmColCenter">{contract.documentCount}</td>
                        <td className="cmColActions">
                          <div className="cmRowActions">
                            <button type="button" className="cmIconButton" title="View details" aria-label="View contract details" onClick={() => setDetailId(contract.id)}>
                              <Eye size={15} />
                            </button>
                            {canWrite && draft && (
                              <button type="button" className="cmIconButton" title="Edit draft contract" aria-label="Edit contract" onClick={() => setFormDialog({ contract })}>
                                <Pencil size={15} />
                              </button>
                            )}
                            {canWrite && draft && (
                              <button type="button" className="cmIconButton" title="Activate contract" aria-label="Activate contract" onClick={() => { setActivateError(""); setActivateTarget(contract); }}>
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            {canWrite && active && (
                              <button type="button" className="cmIconButton" title="Terminate contract" aria-label="Terminate contract" onClick={() => setTerminateTarget(contract)}>
                                <Ban size={15} />
                              </button>
                            )}
                            {canWrite && !active && (
                              <button type="button" className="cmIconButton cmIconDanger" title="Delete contract" aria-label="Delete contract" onClick={() => { setDeleteError(""); setDeleteTarget(contract); }}>
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {formDialog && selectedClient && (
        <ContractFormDialog
          client={selectedClient}
          contract={formDialog.contract}
          onClose={() => setFormDialog(null)}
          onDone={(message) => {
            setFormDialog(null);
            showFlash("success", message);
            reload();
          }}
        />
      )}

      {detailId && (
        <ContractDetailDialog
          contractId={detailId}
          canWrite={canWrite}
          onClose={() => setDetailId(null)}
          onChanged={() => reload()}
        />
      )}

      {inForceOpen && selectedClient && (
        <InForceDialog client={selectedClient} onClose={() => setInForceOpen(false)} />
      )}

      {activateTarget && (
        <ConfirmDialog
          title="Activate contract"
          message={`Activate ${activateTarget.contractNumber}? Its terms become binding and can no longer be edited. Activation is refused if another active contract overlaps these dates.`}
          confirmLabel="Activate contract"
          busy={activateBusy}
          onConfirm={confirmActivate}
          onCancel={() => { if (!activateBusy) { setActivateTarget(null); setActivateError(""); } }}
        >
          {activateError && <p className="actionError" role="alert">{activateError}</p>}
        </ConfirmDialog>
      )}

      {terminateTarget && (
        <TerminateDialog
          contract={terminateTarget}
          onClose={() => setTerminateTarget(null)}
          onDone={(message) => {
            setTerminateTarget(null);
            showFlash("success", message);
            reload();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete contract"
          message={`Delete contract ${deleteTarget.contractNumber}? This is a soft delete — history is preserved. Active contracts must be terminated before they can be deleted.`}
          confirmLabel="Delete contract"
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteError(""); } }}
        >
          {deleteError && <p className="actionError" role="alert">{deleteError}</p>}
        </ConfirmDialog>
      )}

      {!embedded && !activeClientId && (
        <p className="cmMuted" style={{ marginTop: 16 }}>
          <FileText size={14} /> Contracts are managed per client. Select a client above to begin.
        </p>
      )}
    </div>
  );
}
