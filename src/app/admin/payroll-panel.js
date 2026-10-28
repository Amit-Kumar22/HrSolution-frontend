"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  FileText,
  Lock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  Chip,
  ConfirmDialog,
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
import { listClients } from "../../lib/adminApi";
import {
  approvePayroll,
  generatePayroll,
  getPayrollRun,
  listPayrollRuns,
  lockPayroll,
  payPayroll,
  processPayroll,
  monthLabel,
  payrollCapabilities,
  payrollStatusLabel,
  payrollStatusTone,
  PAYROLL_STATUSES,
} from "../../lib/payrollApi";

const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function currency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function initialsOf(value) {
  const source = String(value || "");
  return source
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";
}

export default function PayrollPanel({ session }) {
  const capabilities = payrollCapabilities(session);
  const user = (session && session.user) || {};
  const clientIdFromSession = user && user.clientId != null ? String(user.clientId) : null;

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [filters, setFilters] = useState({ clientId: "", month: "", year: "", status: "" });
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({ content: [], page: 0, totalPages: 0, totalElements: 0, last: true });
  const [listError, setListError] = useState("");
  const [listLoadedKey, setListLoadedKey] = useState(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ clientId: "", month: "", year: "" });
  const [generateErrors, setGenerateErrors] = useState({});
  const [generateError, setGenerateError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [detailRun, setDetailRun] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [busyRunId, setBusyRunId] = useState(null);
  const [flash, showFlash] = useFlash();
  const seq = useRef(0);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: String(client.id || ""),
        label: client.legalName || client.displayName || `Client #${client.id}`,
      })),
    [clients],
  );

  const listRequestKey = `${capabilities.clientViewOnly ? clientIdFromSession : filters.clientId}|${filters.month}|${filters.year}|${filters.status}|${page}|${refreshKey}`;
  const loading = capabilities.enabled && listLoadedKey !== listRequestKey;

  const reload = useCallback(() => {
    setListError("");
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!capabilities.enabled) return undefined;
    listClients({ page: 0, size: 200, sort: ["legalName,ASC"] })
      .then((payload) => {
        setClients(Array.isArray(payload.content) ? payload.content : []);
        setClientsLoading(false);
      })
      .catch(() => {
        setClients([]);
        setClientsLoading(false);
      });
  }, [capabilities.enabled]);

  useEffect(() => {
    if (!capabilities.enabled) return undefined;
    const current = ++seq.current;
    const query = {
      ...(capabilities.clientViewOnly && clientIdFromSession ? { clientId: clientIdFromSession } : {}),
      clientId: capabilities.clientViewOnly ? clientIdFromSession : filters.clientId || undefined,
      month: filters.month || undefined,
      year: filters.year || undefined,
      status: filters.status || undefined,
      page,
      size: 20,
      sort: ["month,DESC", "year,DESC"],
    };
    listPayrollRuns(query)
      .then((payload) => {
        if (seq.current !== current) return;
        setData(payload);
        if (payload.totalPages > 0 && page >= payload.totalPages) {
          setPage(Math.max(0, payload.totalPages - 1));
        }
        setListError("");
        setListLoadedKey(listRequestKey);
      })
      .catch((error) => {
        if (seq.current !== current) return;
        setListError(error instanceof Error ? error.message : "Payroll runs could not be loaded.");
        setData({ content: [], page: 0, totalPages: 0, totalElements: 0, last: true });
        setListLoadedKey(listRequestKey);
      });
    return () => {
      seq.current += 1;
    };
  }, [capabilities.enabled, capabilities.clientViewOnly, clientIdFromSession, filters.clientId, filters.month, filters.year, filters.status, page, refreshKey, listRequestKey]);

  function applyFilters() {
    setListError("");
    setPage(0);
    setRefreshKey((value) => value + 1);
  }

  function clearFilters() {
    setListError("");
    setFilters({ clientId: "", month: "", year: "", status: "" });
    setPage(0);
    setRefreshKey((value) => value + 1);
  }

  function changePage(step) {
    setListError("");
    setPage((value) => Math.max(0, value + step));
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (generating) return;
    const found = {};
    if (!generateForm.clientId) found.clientId = "Select a client.";
    if (!generateForm.month) found.month = "Select a month.";
    if (!generateForm.year || !/^\d{4}$/.test(String(generateForm.year))) {
      found.year = "Enter a valid four-digit year.";
    }
    setGenerateErrors(found);
    setGenerateError("");
    if (Object.keys(found).length) return;

    setGenerating(true);
    try {
      await generatePayroll({
        clientId: Number(generateForm.clientId),
        month: Number(generateForm.month),
        year: Number(generateForm.year),
      });
      setGenerateOpen(false);
      setGenerateForm({ clientId: "", month: "", year: "" });
      setGenerateErrors({});
      reload();
      showFlash("success", "Payroll run generated successfully.");
    } catch (error) {
      setGenerateErrors(error.fields || {});
      setGenerateError(error instanceof Error ? error.message : "The payroll run could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  async function runAction(runId, action, label, successMessage) {
    if (busyAction) return;
    setBusyAction(action);
    setBusyRunId(runId);
    const fn = {
      process: processPayroll,
      approve: approvePayroll,
      lock: lockPayroll,
      pay: payPayroll,
    }[action];
    try {
      await fn(runId);
      showFlash("success", successMessage || `Payroll run ${label}.`);
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : `The payroll run could not be ${label}.`);
    } finally {
      setBusyAction("");
      setBusyRunId(null);
    }
  }

  function openDetail(run) {
    setDetailError("");
    setDetailLoading(true);
    setDetailRun(run);
  }

  function closeDetail() {
    setDetailRun(null);
  }

  if (!capabilities.enabled) {
    return (
      <EmptyState
        icon={Wallet}
        title="Payroll is not available"
        message="Your role does not include payroll access. Ask the Super Admin to review your permissions."
      />
    );
  }

  return (
    <div className="pyPayrollPanel">
      <SectionHead
        title="Payroll"
        description="Generate, process and track monthly payroll runs. Actions are limited to the payroll workflow state and your role permissions."
        action={
          capabilities.canGenerate && (
            <button type="button" className="primaryButton cmBtn" onClick={() => setGenerateOpen(true)} disabled={generating}>
              <Plus size={15} /> Generate payroll
            </button>
          )
        }
      />

      <FlashBanner flash={flash} />

      {loading ? (
        <LoadingState label="Loading payroll runs…" />
      ) : listError ? (
        <ErrorState message={listError} onRetry={reload} />
      ) : capabilities.clientViewOnly && !clientIdFromSession ? (
        <EmptyState
          icon={Wallet}
          title="No client account linked"
          message="Your client account is not linked to this session. Payroll records cannot be displayed."
        />
      ) : !data.content.length ? (
        <EmptyState
          icon={FileText}
          title="No payroll runs"
          message={
            filters.clientId || filters.month || filters.year || filters.status
              ? "No payroll runs match these filters. Try a different selection or clear the filters."
              : "No payroll runs have been generated yet."
          }
        />
      ) : (
        <>
          <div className="pyToolbar">
            <form className="pyFilterForm" onSubmit={(event) => { event.preventDefault(); applyFilters(); }} noValidate>
              <div className="pyFilterField">
                <label>Client</label>
                <select
                  value={filters.clientId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, clientId: event.target.value }))}
                >
                  <option value="">All clients</option>
                  {clientOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pyFilterField">
                <label>Month</label>
                <select value={filters.month} onChange={(event) => setFilters((prev) => ({ ...prev, month: event.target.value }))}>
                  <option value="">All months</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div className="pyFilterField">
                <label>Year</label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={filters.year}
                  onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}
                />
              </div>
              <div className="pyFilterField">
                <label>Status</label>
                <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="">All statuses</option>
                  {PAYROLL_STATUSES.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="secondaryButton cmBtn" disabled={loading}>
                <Search size={14} /> Filter
              </button>
              {(filters.clientId || filters.month || filters.year || filters.status) && (
                <button type="button" className="secondaryButton cmBtn" onClick={clearFilters} disabled={loading}>
                  Clear
                </button>
              )}
            </form>
            <div className="pyToolbarRight">
              <span className="pyCount">
                {data.totalElements} payroll run{data.totalElements === 1 ? "" : "s"}
              </span>
              <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
          </div>

          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Items</th>
                  <th>Processed</th>
                  <th>Approved</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((run) => {
                  const statusTone = payrollStatusTone(run.status);
                  return (
                    <tr key={run.id}>
                      <td>
                        <div className="pyClientCell">
                          <span className="pyClientAvatar" aria-hidden="true">
                            {initialsOf(run.clientName || run.clientCode)}
                          </span>
                          <span>
                            <strong>{run.clientName || run.clientCode || "—"}</strong>
                            <small className="cmMuted">{run.clientCode ? `· ${run.clientCode}` : ""}</small>
                          </span>
                        </div>
                      </td>
                      <td className="cmMuted">
                        {run.month && run.year ? `${monthLabel(run.month)} ${run.year}` : "—"}
                      </td>
                      <td><Chip tone={statusTone}>{payrollStatusLabel(run.status)}</Chip></td>
                      <td className="cmMuted">{currency(run.totalGross)}</td>
                      <td className="cmMuted">{currency(run.totalNet)}</td>
                      <td className="cmMuted">{run.itemCount != null ? run.itemCount : "—"}</td>
                      <td className="cmMuted">{run.processedAt ? formatDate(run.processedAt) : "—"}</td>
                      <td className="cmMuted">{run.approvedAt ? formatDate(run.approvedAt) : "—"}</td>
                      <td className="cmColActions">
                        <div className="cmRowActions">
                          <button
                            type="button"
                            className="cmIconButton"
                            title="View payroll run details"
                            aria-label={`View payroll run #${run.id}`}
                            onClick={() => openDetail(run)}
                            disabled={detailLoading}
                          >
                            <FileText size={14} />
                          </button>
                          {capabilities.canProcess && run.status === "DRAFT" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction"
                              title="Process payroll"
                              aria-label={`Process payroll run #${run.id}`}
                              onClick={() => runAction(run.id, "process", "processed", "The payroll run was processed.")}
                              disabled={busyRunId === run.id}
                            >
                              {busyRunId === run.id ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                            </button>
                          )}
                          {capabilities.canApprove && run.status === "PROCESSED" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction"
                              title="Approve payroll"
                              aria-label={`Approve payroll run #${run.id}`}
                              onClick={() => runAction(run.id, "approve", "approved", "The payroll run was approved.")}
                              disabled={busyRunId === run.id}
                            >
                              {busyRunId === run.id ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} fill="none" strokeWidth={2} />}
                            </button>
                          )}
                          {capabilities.canLock && run.status === "APPROVED" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction cmIconLock"
                              title="Lock payroll"
                              aria-label={`Lock payroll run #${run.id}`}
                              onClick={() => runAction(run.id, "lock", "locked", "The payroll run was locked.")}
                              disabled={busyRunId === run.id}
                            >
                              {busyRunId === run.id ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
                            </button>
                          )}
                          {capabilities.canPay && run.status === "LOCKED" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction cmIconPay"
                              title="Mark as paid"
                              aria-label={`Mark payroll run #${run.id} as paid`}
                              onClick={() => runAction(run.id, "pay", "paid", "The payroll run was marked as paid.")}
                              disabled={busyRunId === run.id}
                            >
                              {busyRunId === run.id ? <Loader2 size={14} className="spin" /> : <Wallet size={14} />}
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

          <div className="cmPagination">
            <span className="cmPageInfo">
              Page {page + 1} of {Math.max(1, data.totalPages)} - {data.totalElements} payroll run{data.totalElements === 1 ? "" : "s"}
            </span>
            <div className="cmRowActions">
              <button type="button" className="secondaryButton cmBtn" disabled={page === 0 || loading} onClick={() => changePage(-1)}>
                Previous
              </button>
              <button type="button" className="secondaryButton cmBtn" disabled={page + 1 >= data.totalPages || loading} onClick={() => changePage(1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {generateOpen && capabilities.canGenerate && (
        <Modal
          title="Generate payroll"
          description="Create a new payroll run for the selected client, month and year. The attendance sheet must be locked before payroll can be generated."
          onClose={() => { if (!generating) setGenerateOpen(false); }}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setGenerateOpen(false)} disabled={generating}>Cancel</button>
              <button type="submit" form="generate-payroll-form" className="primaryButton cmBtn" disabled={generating}>
                {generating ? <><Loader2 size={15} className="spin" /> Generating...</> : "Generate payroll"}
              </button>
            </>
          )}
        >
          <form id="generate-payroll-form" className="cmForm" onSubmit={handleGenerate} noValidate>
            {generateError && <p className="actionError" role="alert">{generateError}</p>}
            <div className="cmFormRow">
              <Field label="Client" htmlFor="py-client" required error={generateErrors.clientId}>
                <select id="py-client" value={generateForm.clientId} onChange={(event) => setGenerateForm((prev) => ({ ...prev, clientId: event.target.value }))}>
                  <option value="">Select client</option>
                  {clientOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Month" htmlFor="py-month" required error={generateErrors.month}>
                <select id="py-month" value={generateForm.month} onChange={(event) => setGenerateForm((prev) => ({ ...prev, month: event.target.value }))}>
                  <option value="">Select month</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Year" htmlFor="py-year" required error={generateErrors.year} hint="For example, 2025.">
              <input id="py-year" type="number" min="2000" max="2100" value={generateForm.year} onChange={(event) => setGenerateForm((prev) => ({ ...prev, year: event.target.value }))} />
            </Field>
            <Notice tone="info">
              Payroll generation is refused unless the attendance sheet for the selected client, month and year is locked.
            </Notice>
          </form>
        </Modal>
      )}

      {detailRun && (
        <Modal
          title={`Payroll run #${detailRun.id}`}
          description={`${detailRun.clientName || "Client"} · ${detailRun.month && detailRun.year ? monthLabel(detailRun.month) + " " + detailRun.year : ""}`}
          onClose={closeDetail}
          footer={<button type="button" className="secondaryButton cmBtn" onClick={closeDetail}>Close</button>}
        >
          {detailLoading ? (
            <LoadingState label="Loading payroll run details…" />
          ) : detailError ? (
            <ErrorState message={detailError} onRetry={() => { setDetailError(""); setDetailLoading(true); }} />
          ) : !detailRun ? (
            <EmptyState title="No payroll run" message="The backend returned no record for this payroll run." />
          ) : (
            <div className="cmDetailGrid">
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Client</span>
                <span className="cmDetailValue">{detailRun.clientName || detailRun.clientCode || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Period</span>
                <span className="cmDetailValue">
                  {detailRun.month && detailRun.year ? `${monthLabel(detailRun.month)} ${detailRun.year}` : "—"}
                </span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Status</span>
                <span className="cmDetailValue"><Chip tone={payrollStatusTone(detailRun.status)}>{payrollStatusLabel(detailRun.status)}</Chip></span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Total gross</span>
                <span className="cmDetailValue">{currency(detailRun.totalGross)}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Total net</span>
                <span className="cmDetailValue">{currency(detailRun.totalNet)}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Items</span>
                <span className="cmDetailValue">{detailRun.itemCount != null ? detailRun.itemCount : "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Processed on</span>
                <span className="cmDetailValue">{formatDate(detailRun.processedAt) || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Approved on</span>
                <span className="cmDetailValue">{formatDate(detailRun.approvedAt) || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Locked on</span>
                <span className="cmDetailValue">{formatDate(detailRun.lockedAt) || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Paid on</span>
                <span className="cmDetailValue">{formatDate(detailRun.paidAt) || "—"}</span>
              </div>
              {detailRun.notes && (
                <div className="cmDetailRow cmDetailFull">
                  <span className="cmDetailLabel">Notes</span>
                  <span className="cmDetailValue cmDetailMessage">{detailRun.notes}</span>
                </div>
              )}
              <div className="cmDetailRow cmDetailFull">
                <span className="cmDetailLabel">Payslips</span>
                <span className="cmDetailValue">
                  <Notice tone="info">Individual payslips are generated per worker from this payroll run. Use the worker portal or the payslip endpoint to view and download payslips.</Notice>
                </span>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
