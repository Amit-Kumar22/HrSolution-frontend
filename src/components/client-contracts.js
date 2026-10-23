"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Eye,
  FileSignature,
  FileText,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  ClientApiError,
  canCreateClientContracts,
  createMyContract,
  getMyContract,
  getMyContractInForce,
  listMyContracts,
} from "@/lib/clientApi";
import {
  EMPTY_CONTRACT_FORM,
  SERVICE_CHARGE_TYPES,
  contractFormToPayload,
  contractStatusLabel,
  contractStatusTone,
  serviceChargeLabel,
  serviceChargeTypeLabel,
  todayDateString,
  validateContractForm,
} from "@/lib/contract-forms";
import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  Notice,
  formatDate,
  useFlash,
} from "@/app/admin/admin-ui";

function errorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function fieldErrors(error) {
  if (error && typeof error === "object" && error.fields && typeof error.fields === "object") {
    return error.fields;
  }
  return {};
}

function ContractStatusChip({ contract }) {
  return (
    <Chip tone={contractStatusTone(contract && contract.status)}>
      {contractStatusLabel(contract && contract.status)}
    </Chip>
  );
}

function DetailRow({ label, value, wide = false }) {
  return (
    <div className={`cmDetailRow${wide ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">
        {value === null || value === undefined || value === "" ? "—" : value}
      </span>
    </div>
  );
}

function expiryText(contract) {
  if (!contract) return "—";
  if (contract.daysUntilExpiry !== null && contract.daysUntilExpiry !== undefined) {
    return `${contract.daysUntilExpiry} day${Number(contract.daysUntilExpiry) === 1 ? "" : "s"}`;
  }
  return contract.endDate ? "—" : "Open-ended";
}

function ContractDetailDialog({ contractId, onClose }) {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    getMyContract(contractId)
      .then((data) => {
        if (active) {
          setContract(data);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, "The contract details could not be loaded."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contractId, reloadToken]);

  return (
    <Modal
      wide
      title="Contract details"
      description={
        contract
          ? `${contract.contractNumber || `Contract #${contractId}`}${contract.title ? ` — ${contract.title}` : ""}`
          : `Contract #${contractId}`
      }
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <LoadingState label="Loading contract…" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : contract ? (
        <>
          <div className="cmStatusRow" style={{ marginBottom: 14 }}>
            <ContractStatusChip contract={contract} />
            <Chip tone={contract.inForceToday ? "success" : "neutral"}>
              {contract.inForceToday ? "In force today" : "Not in force today"}
            </Chip>
            {contract.endDate ? null : <Chip tone="info">Open-ended</Chip>}
            <Chip tone="neutral">
              {contract.documentCount ?? 0} document{(contract.documentCount ?? 0) === 1 ? "" : "s"}
            </Chip>
          </div>

          <div className="cmDetailGrid">
            <DetailRow label="Contract ID" value={<span className="cmCode">{contract.id}</span>} />
            <DetailRow label="Client name" value={contract.clientName} />
            <DetailRow label="Contract number" value={<span className="cmCode">{contract.contractNumber}</span>} />
            <DetailRow label="Title" value={contract.title} />
            <DetailRow label="Start date" value={formatDate(contract.startDate)} />
            <DetailRow label="End date" value={contract.endDate ? formatDate(contract.endDate) : "Ongoing (open-ended)"} />
            <DetailRow label="Service charge type" value={serviceChargeTypeLabel(contract.serviceChargeType)} />
            <DetailRow label="Service charge value" value={contract.serviceChargeValue} />
            <DetailRow label="Service charge" value={serviceChargeLabel(contract)} />
            <DetailRow
              label="Payment terms"
              value={contract.paymentTermsDays != null ? `${contract.paymentTermsDays} days` : "Client default"}
            />
            <DetailRow
              label="Effective payment terms"
              value={contract.effectivePaymentTermsDays != null ? `${contract.effectivePaymentTermsDays} days` : "—"}
            />
            <DetailRow label="Contract status" value={<ContractStatusChip contract={contract} />} />
            <DetailRow label="In force today" value={contract.inForceToday ? "Yes" : "No"} />
            <DetailRow label="Days until expiry" value={expiryText(contract)} />
            <DetailRow label="Document count" value={contract.documentCount ?? 0} />
            {contract.terminatedOn && <DetailRow label="Termination date" value={formatDate(contract.terminatedOn)} />}
            {contract.terminationReason && (
              <DetailRow label="Termination reason" value={contract.terminationReason} wide />
            )}
            {contract.notes && <DetailRow label="Notes" value={contract.notes} wide />}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

function InForceDialog({ clientId, onClose, onViewContract }) {
  const [onDate, setOnDate] = useState(todayDateString());
  const [result, setResult] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  async function handleResolve(event) {
    event.preventDefault();
    if (resolving || !onDate) return;
    setResolving(true);
    setError("");
    setResult(null);
    try {
      const data = await getMyContractInForce(clientId, onDate);
      setResult(data);
    } catch (err) {
      if (err instanceof ClientApiError && (err.status === 404 || err.code === "RESOURCE_NOT_FOUND")) {
        setError("No active contract covers the selected date.");
      } else {
        setError(errorMessage(err, "The contract in force could not be resolved."));
      }
    } finally {
      setResolving(false);
    }
  }

  return (
    <Modal
      wide
      title="Contract in force"
      description="Find the single active contract that applies to your company on a chosen date."
      onClose={onClose}
      footer={<button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>}
    >
      <form className="cmForm" onSubmit={handleResolve} noValidate>
        <div className="cmFormRow">
          <Field label="On date" htmlFor="client-inforce-date" required hint="Defaults to today.">
            <input
              id="client-inforce-date"
              type="date"
              value={onDate}
              onChange={(event) => {
                setOnDate(event.target.value);
                setError("");
                setResult(null);
              }}
            />
          </Field>
          <div className="cmSwitchRow" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="primaryButton cmBtn" disabled={resolving || !onDate}>
              <CalendarCheck size={15} /> {resolving ? "Resolving…" : "Resolve contract"}
            </button>
          </div>
        </div>
      </form>

      {error && <p className="actionError" role="alert" style={{ marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <Notice tone="success">One contract is in force on the selected date.</Notice>
          <div className="cmStatusRow" style={{ marginTop: 12 }}>
            <ContractStatusChip contract={result} />
            <Chip tone="neutral">
              {result.documentCount ?? 0} document{(result.documentCount ?? 0) === 1 ? "" : "s"}
            </Chip>
          </div>
          <div className="cmDetailGrid" style={{ marginTop: 14 }}>
            <DetailRow label="Contract number" value={result.contractNumber} />
            <DetailRow label="Title" value={result.title} />
            <DetailRow label="Start date" value={formatDate(result.startDate)} />
            <DetailRow label="End date" value={result.endDate ? formatDate(result.endDate) : "Ongoing (open-ended)"} />
            <DetailRow label="Service charge" value={serviceChargeLabel(result)} />
            <DetailRow
              label="Effective payment terms"
              value={result.effectivePaymentTermsDays != null ? `${result.effectivePaymentTermsDays} days` : "—"}
            />
            <DetailRow label="Days until expiry" value={expiryText(result)} />
          </div>
          {result.id && (
            <div className="cmDetailActions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="secondaryButton cmBtn"
                onClick={() => {
                  onClose();
                  onViewContract(result.id);
                }}
              >
                <Eye size={15} /> View full details
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function CreateContractDialog({ client, onClose, onDone }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_CONTRACT_FORM, startDate: todayDateString() }));
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
      await createMyContract(client.id, contractFormToPayload(form));
      onDone("Draft contract created. It stays in draft until Shakti Manpower activates it.");
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error, "The contract could not be created."));
      setSaving(false);
    }
  }

  const isPercentage = form.serviceChargeType === "PERCENTAGE";

  return (
    <Modal
      wide
      title="Draft a contract"
      description="New contracts are created as drafts. Activation is a separate step performed by Shakti Manpower."
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={(
        <>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="client-contract-form" className="primaryButton cmBtn" disabled={saving}>
            {saving ? "Saving…" : "Create draft"}
          </button>
        </>
      )}
    >
      <form id="client-contract-form" className="cmForm" onSubmit={handleSubmit} noValidate>
        {formError && <p className="actionError" role="alert">{formError}</p>}
        <div className="cmFormGrid">
          <div className="cmFormRow">
            <Field
              label="Contract number"
              htmlFor="client-ct-number"
              required
              error={errors.contractNumber}
              hint="Unique reference, e.g. BT/HRS/2026-27/01."
            >
              <input
                id="client-ct-number"
                type="text"
                maxLength={60}
                value={form.contractNumber}
                placeholder="BT/HRS/2026-27/01"
                onChange={(event) => update("contractNumber", event.target.value)}
              />
            </Field>
            <Field label="Title" htmlFor="client-ct-title" error={errors.title} hint="Optional short description.">
              <input
                id="client-ct-title"
                type="text"
                maxLength={200}
                value={form.title}
                placeholder="Manpower supply - Pune and Nagpur plants"
                onChange={(event) => update("title", event.target.value)}
              />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Start date" htmlFor="client-ct-start" required error={errors.startDate}>
              <input
                id="client-ct-start"
                type="date"
                value={form.startDate}
                onChange={(event) => update("startDate", event.target.value)}
              />
            </Field>
            <Field
              label="End date"
              htmlFor="client-ct-end"
              error={errors.endDate}
              hint="Leave empty for an open-ended contract."
            >
              <input
                id="client-ct-end"
                type="date"
                value={form.endDate}
                onChange={(event) => update("endDate", event.target.value)}
              />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field label="Service charge type" htmlFor="client-ct-charge-type" required error={errors.serviceChargeType}>
              <select
                id="client-ct-charge-type"
                value={form.serviceChargeType}
                onChange={(event) => update("serviceChargeType", event.target.value)}
              >
                {SERVICE_CHARGE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </Field>
            <Field
              label={isPercentage ? "Service charge (%)" : "Service charge (₹ per worker)"}
              htmlFor="client-ct-charge"
              required
              error={errors.serviceChargeValue}
              hint={isPercentage ? "Percentage of wages billed to the client, e.g. 8.5." : "Rupees per deployed worker per month."}
            >
              <input
                id="client-ct-charge"
                type="number"
                min="0"
                step="0.01"
                value={form.serviceChargeValue}
                placeholder={isPercentage ? "8.5" : "1200"}
                onChange={(event) => update("serviceChargeValue", event.target.value)}
              />
            </Field>
          </div>
          <div className="cmFormRow">
            <Field
              label="Payment terms (days)"
              htmlFor="client-ct-terms"
              error={errors.paymentTermsDays}
              hint="Optional. Overrides your company's default credit period."
            >
              <input
                id="client-ct-terms"
                type="number"
                min="0"
                max="365"
                step="1"
                value={form.paymentTermsDays}
                placeholder="e.g. 45"
                onChange={(event) => update("paymentTermsDays", event.target.value)}
              />
            </Field>
            <div />
          </div>
          <Field label="Notes" htmlFor="client-ct-notes" error={errors.notes}>
            <textarea
              id="client-ct-notes"
              rows={3}
              maxLength={2000}
              value={form.notes}
              placeholder="Optional notes for this contract"
              onChange={(event) => update("notes", event.target.value)}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export default function ClientContracts({
  company = null,
  companyLoading = false,
  companyError = "",
  session = null,
}) {
  const clientId = company && company.id != null ? company.id : null;
  const canCreate = canCreateClientContracts(session);

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState("");

  const [flash, showFlash] = useFlash();
  const [detailId, setDetailId] = useState(null);
  const [inForceOpen, setInForceOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    listMyContracts(clientId)
      .then((data) => {
        if (cancelled) return;
        setContracts(data);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setContracts([]);
        setError(errorMessage(err, "Your contracts could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  function reload() {
    setLoading(true);
    setError("");
    setReloadToken((token) => token + 1);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contracts;
    return contracts.filter((contract) =>
      [contract.contractNumber, contract.title].some((value) =>
        String(value || "").toLowerCase().includes(query),
      ),
    );
  }, [contracts, search]);

  return (
    <section className="clPanel cmContractsPanel clientContractsPanel" aria-label="My contracts">
      <FlashBanner flash={flash} />

      {companyError ? (
        <div className="cmError" role="alert">
          <FileSignature size={18} />
          <p>{companyError}</p>
          <Link className="secondaryButton cmBtn" href="/#contact">Contact support</Link>
        </div>
      ) : companyLoading || !clientId ? (
        <LoadingState label="Loading your company…" />
      ) : (
        <>
          <div className="cmToolbar">
            <label className="cmSearchBox">
              <Search size={15} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search contract number or title"
                aria-label="Search your contracts"
              />
            </label>
            <div className="cmToolbarControls">
              <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
                <RefreshCw size={15} /> Refresh
              </button>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setInForceOpen(true)}>
                <CalendarCheck size={15} /> In-force lookup
              </button>
              {canCreate ? (
                <button type="button" className="primaryButton cmBtn" onClick={() => setCreateOpen(true)}>
                  <Plus size={15} /> New draft
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <LoadingState label="Loading your contracts…" />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : contracts.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No contracts yet"
              message="When Shakti Manpower issues a contract for your company, it will appear here."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No contracts match your search"
              message="Try a different contract number or title."
            />
          ) : (
            <div className="cmTableWrap">
              <table className="cmTable clientContractsTable">
                <thead>
                  <tr>
                    <th>Contract number</th>
                    <th>Contract title</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Service charge</th>
                    <th>Payment terms</th>
                    <th className="cmColCenter">Status</th>
                    <th className="cmColCenter">In force today</th>
                    <th className="cmColCenter">Days until expiry</th>
                    <th className="cmColCenter">Documents</th>
                    <th className="cmColActions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contract) => (
                    <tr key={contract.id ?? contract.contractNumber}>
                      <td>
                        <span className="cmCode">{contract.contractNumber || "—"}</span>
                      </td>
                      <td>
                        <span className="clientContractTitle" title={contract.title || ""}>
                          {contract.title || "—"}
                        </span>
                      </td>
                      <td className="cmMuted">{formatDate(contract.startDate)}</td>
                      <td className="cmMuted">
                        {contract.endDate ? formatDate(contract.endDate) : "Open-ended"}
                      </td>
                      <td>{serviceChargeLabel(contract)}</td>
                      <td className="cmMuted">
                        <span className="cmBlock">
                          {contract.effectivePaymentTermsDays != null
                            ? `${contract.effectivePaymentTermsDays} days`
                            : "—"}
                        </span>
                        {contract.paymentTermsDays == null && <small>client default</small>}
                      </td>
                      <td className="cmColCenter">
                        <ContractStatusChip contract={contract} />
                      </td>
                      <td className="cmColCenter">
                        <Chip tone={contract.inForceToday ? "success" : "neutral"}>
                          {contract.inForceToday ? "Yes" : "No"}
                        </Chip>
                      </td>
                      <td className="cmColCenter cmMuted">{expiryText(contract)}</td>
                      <td className="cmColCenter">
                        <span className="clientContractDocCount">
                          <FileText size={13} /> {contract.documentCount ?? 0}
                        </span>
                      </td>
                      <td className="cmColActions">
                        <div className="cmRowActions">
                          <button
                            type="button"
                            className="secondaryButton cmBtn clientContractViewButton"
                            title="View details"
                            onClick={() => setDetailId(contract.id)}
                          >
                            <Eye size={14} /> View details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {detailId && <ContractDetailDialog contractId={detailId} onClose={() => setDetailId(null)} />}

      {inForceOpen && clientId && (
        <InForceDialog
          clientId={clientId}
          onClose={() => setInForceOpen(false)}
          onViewContract={(contractId) => setDetailId(contractId)}
        />
      )}

      {createOpen && company && (
        <CreateContractDialog
          client={company}
          onClose={() => setCreateOpen(false)}
          onDone={(message) => {
            setCreateOpen(false);
            showFlash("success", message);
            reload();
          }}
        />
      )}
    </section>
  );
}
