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
import { listPayrollRuns } from "../../lib/payrollApi";
import {
  cancelInvoice,
  createCreditNote,
  generateInvoiceFromPayroll,
  getInvoice,
  issueInvoice,
  listInvoices,
  recordInvoicePayment,
  invoiceCapabilities,
  invoiceStatusLabel,
  invoiceStatusTone,
  INVOICE_STATUSES,
  paymentModeLabel,
  PAYMENT_MODES,
} from "../../lib/invoiceApi";

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

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function todayDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function InvoicePanel({ session }) {
  const capabilities = invoiceCapabilities(session);
  const user = (session && session.user) || {};
  const clientIdFromSession = user && user.clientId != null ? String(user.clientId) : null;

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [filters, setFilters] = useState({ clientId: "", status: "" });
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({ content: [], page: 0, totalPages: 0, totalElements: 0, last: true });
  const [listError, setListError] = useState("");
  const [listLoadedKey, setListLoadedKey] = useState(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ payrollRunId: "", invoiceDate: todayDate(), dueDate: todayDate() });
  const [generateErrors, setGenerateErrors] = useState({});
  const [generateError, setGenerateError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [payrollRunsLoading, setPayrollRunsLoading] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [busyInvoiceId, setBusyInvoiceId] = useState(null);
  const [issueOpen, setIssueOpen] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(null);
  const [creditNoteOpen, setCreditNoteOpen] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [paymentForm, setPaymentForm] = useState({ paymentDate: todayDate(), amount: "", mode: "NEFT", referenceNumber: "", tdsDeducted: "", remarks: "" });
  const [paymentErrors, setPaymentErrors] = useState({});
  const [paymentError, setPaymentError] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [creditNoteForm, setCreditNoteForm] = useState({ issueDate: todayDate(), amount: "", reason: "" });
  const [creditNoteErrors, setCreditNoteErrors] = useState({});
  const [creditNoteError, setCreditNoteError] = useState("");
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);
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

  const listRequestKey = `${capabilities.clientViewOnly ? clientIdFromSession : filters.clientId}|${filters.status}|${page}|${refreshKey}`;
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
      status: filters.status || undefined,
      page,
      size: 20,
      sort: ["invoiceDate,DESC"],
    };
    listInvoices(query)
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
        setListError(error instanceof Error ? error.message : "Invoices could not be loaded.");
        setData({ content: [], page: 0, totalPages: 0, totalElements: 0, last: true });
        setListLoadedKey(listRequestKey);
      });
    return () => {
      seq.current += 1;
    };
  }, [capabilities.enabled, capabilities.clientViewOnly, clientIdFromSession, filters.clientId, filters.status, page, refreshKey, listRequestKey]);

  function applyFilters() {
    setListError("");
    setPage(0);
    setRefreshKey((value) => value + 1);
  }

  function clearFilters() {
    setListError("");
    setFilters({ clientId: "", status: "" });
    setPage(0);
    setRefreshKey((value) => value + 1);
  }

  function changePage(step) {
    setListError("");
    setPage((value) => Math.max(0, value + step));
  }

  async function loadEligiblePayrollRuns() {
    setPayrollRunsLoading(true);
    try {
      const payload = await listPayrollRuns({ page: 0, size: 200, sort: ["month,DESC", "year,DESC"] });
      setPayrollRuns(Array.isArray(payload.content) ? payload.content : []);
    } catch {
      setPayrollRuns([]);
    } finally {
      setPayrollRunsLoading(false);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (generating) return;
    const found = {};
    if (!generateForm.payrollRunId) found.payrollRunId = "Select a payroll run.";
    if (!generateForm.invoiceDate) found.invoiceDate = "Invoice date is required.";
    if (!generateForm.dueDate) found.dueDate = "Due date is required.";
    if (generateForm.dueDate && generateForm.invoiceDate && generateForm.dueDate < generateForm.invoiceDate) {
      found.dueDate = "Due date cannot be before the invoice date.";
    }
    setGenerateErrors(found);
    setGenerateError("");
    if (Object.keys(found).length) return;

    setGenerating(true);
    try {
      await generateInvoiceFromPayroll({
        payrollRunId: Number(generateForm.payrollRunId),
        invoiceDate: generateForm.invoiceDate,
        dueDate: generateForm.dueDate,
      });
      setGenerateOpen(false);
      setGenerateForm({ payrollRunId: "", invoiceDate: todayDate(), dueDate: todayDate() });
      setGenerateErrors({});
      reload();
      showFlash("success", "Invoice generated from payroll successfully.");
    } catch (error) {
      setGenerateErrors(error.fields || {});
      setGenerateError(error instanceof Error ? error.message : "The invoice could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  async function runAction(invoiceId, action, label, successMessage) {
    if (busyAction) return;
    setBusyAction(action);
    setBusyInvoiceId(invoiceId);
    const fn = {
      issue: issueInvoice,
      cancel: (id) => cancelInvoice(id, cancelReason),
    }[action];
    try {
      await fn(invoiceId);
      if (action === "cancel") setCancelReason("");
      showFlash("success", successMessage || `Invoice ${label}.`);
      reload();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : `The invoice could not be ${label}.`);
    } finally {
      setBusyAction("");
      setBusyInvoiceId(null);
    }
  }

  async function handleRecordPayment(invoiceId) {
    if (recordingPayment) return;
    const found = {};
    if (!paymentForm.paymentDate) found.paymentDate = "Payment date is required.";
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) found.amount = "Enter a valid payment amount.";
    if (!paymentForm.mode) found.mode = "Select a payment mode.";
    if (!paymentForm.referenceNumber.trim()) found.referenceNumber = "Reference number is required.";
    setPaymentErrors(found);
    setPaymentError("");
    if (Object.keys(found).length) return;

    setRecordingPayment(true);
    try {
      await recordInvoicePayment(invoiceId, {
        paymentDate: paymentForm.paymentDate,
        amount: Number(paymentForm.amount),
        mode: paymentForm.mode,
        referenceNumber: paymentForm.referenceNumber.trim(),
        tdsDeducted: paymentForm.tdsDeducted ? Number(paymentForm.tdsDeducted) : undefined,
        remarks: paymentForm.remarks.trim() || undefined,
      });
      setPaymentOpen(null);
      setPaymentForm({ paymentDate: todayDate(), amount: "", mode: "NEFT", referenceNumber: "", tdsDeducted: "", remarks: "" });
      setPaymentErrors({});
      reload();
      showFlash("success", "Payment recorded successfully.");
    } catch (error) {
      setPaymentErrors(error.fields || {});
      setPaymentError(error instanceof Error ? error.message : "The payment could not be recorded.");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function handleCreateCreditNote(invoiceId) {
    if (creatingCreditNote) return;
    const found = {};
    if (!creditNoteForm.issueDate) found.issueDate = "Issue date is required.";
    if (!creditNoteForm.amount || Number(creditNoteForm.amount) <= 0) found.amount = "Enter a valid credit note amount.";
    if (!creditNoteForm.reason.trim()) found.reason = "A reason is required.";
    setCreditNoteErrors(found);
    setCreditNoteError("");
    if (Object.keys(found).length) return;

    setCreatingCreditNote(true);
    try {
      await createCreditNote(invoiceId, {
        issueDate: creditNoteForm.issueDate,
        amount: Number(creditNoteForm.amount),
        reason: creditNoteForm.reason.trim(),
      });
      setCreditNoteOpen(null);
      setCreditNoteForm({ issueDate: todayDate(), amount: "", reason: "" });
      setCreditNoteErrors({});
      reload();
      showFlash("success", "Credit note created successfully.");
    } catch (error) {
      setCreditNoteErrors(error.fields || {});
      setCreditNoteError(error instanceof Error ? error.message : "The credit note could not be created.");
    } finally {
      setCreatingCreditNote(false);
    }
  }

  function openDetail(invoice) {
    setDetailError("");
    setDetailLoading(true);
    setDetailInvoice(invoice);
  }

  function closeDetail() {
    setDetailInvoice(null);
  }

  if (!capabilities.enabled) {
    return (
      <EmptyState
        icon={Wallet}
        title="Invoices are not available"
        message="Your role does not include invoice access. Ask the Super Admin to review your permissions."
      />
    );
  }

  return (
    <div className="invInvoicePanel">
      <SectionHead
        title="Invoices"
        description="Generate, issue, and track client invoices. Actions are limited to the invoice workflow state and your role permissions."
        action={
          capabilities.canGenerate && (
            <button type="button" className="primaryButton cmBtn" onClick={() => { loadEligiblePayrollRuns(); setGenerateOpen(true); }} disabled={generating}>
              <Plus size={15} /> Generate invoice
            </button>
          )
        }
      />

      <FlashBanner flash={flash} />

      {loading ? (
        <LoadingState label="Loading invoices…" />
      ) : listError ? (
        <ErrorState message={listError} onRetry={reload} />
      ) : capabilities.clientViewOnly && !clientIdFromSession ? (
        <EmptyState
          icon={Wallet}
          title="No client account linked"
          message="Your client account is not linked to this session. Invoices cannot be displayed."
        />
      ) : !data.content.length ? (
        <EmptyState
          icon={FileText}
          title="No invoices"
          message={
            filters.clientId || filters.status
              ? "No invoices match these filters. Try a different selection or clear the filters."
              : "No invoices have been generated yet."
          }
        />
      ) : (
        <>
          <div className="invToolbar">
            <form className="invFilterForm" onSubmit={(event) => { event.preventDefault(); applyFilters(); }} noValidate>
              <div className="invFilterField">
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
              <div className="invFilterField">
                <label>Status</label>
                <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="">All statuses</option>
                  {INVOICE_STATUSES.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="secondaryButton cmBtn" disabled={loading}>
                <Search size={14} /> Filter
              </button>
              {(filters.clientId || filters.status) && (
                <button type="button" className="secondaryButton cmBtn" onClick={clearFilters} disabled={loading}>
                  Clear
                </button>
              )}
            </form>
            <div className="invToolbarRight">
              <span className="invCount">
                {data.totalElements} invoice{data.totalElements === 1 ? "" : "s"}
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
                  <th>Invoice number</th>
                  <th>Client</th>
                  <th>Client ID</th>
                  <th>Invoice date</th>
                  <th>Due date</th>
                  <th>Amount</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((invoice) => {
                  const statusTone = invoiceStatusTone(invoice.status);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <div className="invCell">
                          <strong>{invoice.invoiceNumber || invoice.invoiceId || invoice.id || "—"}</strong>
                        </div>
                      </td>
                      <td className="cmMuted">{invoice.clientName || invoice.clientCode || "—"}</td>
                      <td className="cmMuted">{invoice.clientId != null ? invoice.clientId : "—"}</td>
                      <td className="cmMuted">{invoice.invoiceDate ? formatDate(invoice.invoiceDate) : "—"}</td>
                      <td className="cmMuted">{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</td>
                      <td className="cmMuted">{currency(invoice.totalAmount)}</td>
                      <td className="cmMuted">{invoice.outstandingBalance != null ? currency(invoice.outstandingBalance) : "—"}</td>
                      <td><Chip tone={statusTone}>{invoiceStatusLabel(invoice.status)}</Chip></td>
                      <td className="cmColActions">
                        <div className="cmRowActions">
                          <button
                            type="button"
                            className="cmIconButton"
                            title="View invoice details"
                            aria-label={`View invoice #${invoice.id}`}
                            onClick={() => openDetail(invoice)}
                            disabled={detailLoading}
                          >
                            <FileText size={14} />
                          </button>
                          {capabilities.canIssue && invoice.status === "DRAFT" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction"
                              title="Issue invoice"
                              aria-label={`Issue invoice #${invoice.id}`}
                              onClick={() => { setIssueOpen(invoice.id); }}
                              disabled={busyInvoiceId === invoice.id}
                            >
                              {busyInvoiceId === invoice.id ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                            </button>
                          )}
                          {capabilities.canRecordPayment && invoice.status !== "CANCELLED" && invoice.status !== "DRAFT" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction"
                              title="Record payment"
                              aria-label={`Record payment for invoice #${invoice.id}`}
                              onClick={() => { setPaymentOpen(invoice.id); }}
                              disabled={busyInvoiceId === invoice.id}
                            >
                              {busyInvoiceId === invoice.id ? <Loader2 size={14} className="spin" /> : <Wallet size={14} />}
                            </button>
                          )}
                          {capabilities.canCreateCreditNote && invoice.status === "ISSUED" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction"
                              title="Create credit note"
                              aria-label={`Create credit note for invoice #${invoice.id}`}
                              onClick={() => { setCreditNoteOpen(invoice.id); }}
                              disabled={busyInvoiceId === invoice.id}
                            >
                              {busyInvoiceId === invoice.id ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
                            </button>
                          )}
                          {capabilities.canCancel && invoice.status === "DRAFT" && (
                            <button
                              type="button"
                              className="cmIconButton cmIconAction cmIconCancel"
                              title="Cancel invoice"
                              aria-label={`Cancel invoice #${invoice.id}`}
                              onClick={() => { setCancelOpen(invoice.id); setCancelReason(""); }}
                              disabled={busyInvoiceId === invoice.id}
                            >
                              {busyInvoiceId === invoice.id ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
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
            <span className="invCount">
              Page {page + 1} of {Math.max(1, data.totalPages)} - {data.totalElements} invoice{data.totalElements === 1 ? "" : "s"}
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
          title="Generate invoice from payroll"
          description="Create an invoice from an eligible processed or approved payroll run. Select the payroll run, invoice date and due date."
          onClose={() => { if (!generating) setGenerateOpen(false); }}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setGenerateOpen(false)} disabled={generating}>Cancel</button>
              <button type="submit" form="generate-invoice-form" className="primaryButton cmBtn" disabled={generating}>
                {generating ? <><Loader2 size={15} className="spin" /> Generating...</> : "Generate invoice"}
              </button>
            </>
          )}
        >
          <form id="generate-invoice-form" className="cmForm" onSubmit={handleGenerate} noValidate>
            {generateError && <p className="actionError" role="alert">{generateError}</p>}
            <Field label="Payroll run" htmlFor="inv-payroll" required error={generateErrors.payrollRunId}>
              <select id="inv-payroll" value={generateForm.payrollRunId} onChange={(event) => setGenerateForm((prev) => ({ ...prev, payrollRunId: event.target.value }))}>
                <option value="">Select payroll run</option>
                {payrollRunsLoading ? (
                  <option disabled>Loading payroll runs…</option>
                ) : payrollRuns.length === 0 ? (
                  <option disabled>No eligible payroll runs available</option>
                ) : (
                  payrollRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      #{run.id} · {run.clientName || run.clientCode || "Client"} · {run.month && run.year ? `${run.month}/${run.year}` : ""}
                    </option>
                  ))
                )}
              </select>
            </Field>
            <div className="cmFormRow">
              <Field label="Invoice date" htmlFor="inv-date" required error={generateErrors.invoiceDate}>
                <input id="inv-date" type="date" value={generateForm.invoiceDate} onChange={(event) => setGenerateForm((prev) => ({ ...prev, invoiceDate: event.target.value }))} />
              </Field>
              <Field label="Due date" htmlFor="inv-due" required error={generateErrors.dueDate}>
                <input id="inv-due" type="date" value={generateForm.dueDate} onChange={(event) => setGenerateForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
              </Field>
            </div>
            <Notice tone="info">
              The backend accepts invoices generated from eligible processed or approved payroll runs only.
            </Notice>
          </form>
        </Modal>
      )}

      {issueOpen && (
        <ConfirmDialog
          title="Issue invoice"
          message={`Issue invoice #${issueOpen}? This will change the status from Draft to Issued and the invoice can no longer be edited.`}
          confirmLabel="Issue invoice"
          confirmVariant="primary"
          busy={busyAction === "issue" && busyInvoiceId === issueOpen}
          onConfirm={() => runAction(issueOpen, "issue", "issued", "The invoice was issued.")}
          onCancel={() => setIssueOpen(null)}
        />
      )}

      {paymentOpen && (
        <Modal
          title={`Record payment — Invoice #${paymentOpen}`}
          description="Enter the payment details received against this invoice."
          onClose={() => { if (!recordingPayment) setPaymentOpen(null); }}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setPaymentOpen(null)} disabled={recordingPayment}>Cancel</button>
              <button type="submit" form="record-payment-form" className="primaryButton cmBtn" disabled={recordingPayment}>
                {recordingPayment ? <><Loader2 size={15} className="spin" /> Recording...</> : "Record payment"}
              </button>
            </>
          )}
        >
          <form id="record-payment-form" className="cmForm" onSubmit={(event) => { event.preventDefault(); handleRecordPayment(paymentOpen); }} noValidate>
            {paymentError && <p className="actionError" role="alert">{paymentError}</p>}
            <div className="cmFormRow">
              <Field label="Payment date" htmlFor="pay-date" required error={paymentErrors.paymentDate}>
                <input id="pay-date" type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))} />
              </Field>
              <Field label="Amount" htmlFor="pay-amount" required error={paymentErrors.amount} hint="Amount paid against this invoice.">
                <input id="pay-amount" type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} />
              </Field>
            </div>
            <div className="cmFormRow">
              <Field label="Payment mode" htmlFor="pay-mode" required error={paymentErrors.mode}>
                <select id="pay-mode" value={paymentForm.mode} onChange={(event) => setPaymentForm((prev) => ({ ...prev, mode: event.target.value }))}>
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>{paymentModeLabel(mode.value)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Reference number" htmlFor="pay-ref" required error={paymentErrors.referenceNumber} hint="Cheque number, transaction reference or UTR.">
                <input id="pay-ref" type="text" maxLength={100} value={paymentForm.referenceNumber} onChange={(event) => setPaymentForm((prev) => ({ ...prev, referenceNumber: event.target.value }))} />
              </Field>
            </div>
            <div className="cmFormRow">
              <Field label="TDS deducted" htmlFor="pay-tds" error={paymentErrors.tdsDeducted} hint="Tax deducted at source, if any.">
                <input id="pay-tds" type="number" min="0" step="0.01" value={paymentForm.tdsDeducted} onChange={(event) => setPaymentForm((prev) => ({ ...prev, tdsDeducted: event.target.value }))} />
              </Field>
              <Field label="Remarks" htmlFor="pay-remarks" error={paymentErrors.remarks} hint="Optional notes about this payment.">
                <textarea id="pay-remarks" rows={2} maxLength={500} value={paymentForm.remarks} onChange={(event) => setPaymentForm((prev) => ({ ...prev, remarks: event.target.value }))} />
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {creditNoteOpen && (
        <Modal
          title={`Create credit note — Invoice #${creditNoteOpen}`}
          description="Create a credit note against this issued invoice."
          onClose={() => { if (!creatingCreditNote) setCreditNoteOpen(null); }}
          footer={(
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setCreditNoteOpen(null)} disabled={creatingCreditNote}>Cancel</button>
              <button type="submit" form="create-credit-note-form" className="primaryButton cmBtn" disabled={creatingCreditNote}>
                {creatingCreditNote ? <><Loader2 size={15} className="spin" /> Creating...</> : "Create credit note"}
              </button>
            </>
          )}
        >
          <form id="create-credit-note-form" className="cmForm" onSubmit={(event) => { event.preventDefault(); handleCreateCreditNote(creditNoteOpen); }} noValidate>
            {creditNoteError && <p className="actionError" role="alert">{creditNoteError}</p>}
            <div className="cmFormRow">
              <Field label="Issue date" htmlFor="cn-date" required error={creditNoteErrors.issueDate}>
                <input id="cn-date" type="date" value={creditNoteForm.issueDate} onChange={(event) => setCreditNoteForm((prev) => ({ ...prev, issueDate: event.target.value }))} />
              </Field>
              <Field label="Amount" htmlFor="cn-amount" required error={creditNoteErrors.amount} hint="Credit note amount.">
                <input id="cn-amount" type="number" min="0" step="0.01" value={creditNoteForm.amount} onChange={(event) => setCreditNoteForm((prev) => ({ ...prev, amount: event.target.value }))} />
              </Field>
            </div>
            <Field label="Reason" htmlFor="cn-reason" required error={creditNoteErrors.reason} hint="Reason for issuing the credit note.">
              <textarea id="cn-reason" rows={3} maxLength={1000} value={creditNoteForm.reason} onChange={(event) => setCreditNoteForm((prev) => ({ ...prev, reason: event.target.value }))} />
            </Field>
          </form>
        </Modal>
      )}

      {cancelOpen && (
        <ConfirmDialog
          title="Cancel invoice"
          message={`Cancel draft invoice #${cancelOpen}? This action cannot be undone.`}
          confirmLabel="Cancel invoice"
          confirmVariant="danger"
          busy={busyAction === "cancel" && busyInvoiceId === cancelOpen}
          onConfirm={() => runAction(cancelOpen, "cancel", "cancelled", "The invoice was cancelled.")}
          onCancel={() => { setCancelOpen(null); setCancelReason(""); }}
        >
          <Field label="Cancellation reason" htmlFor="cancel-reason" required>
            <textarea id="cancel-reason" rows={3} maxLength={1000} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </Field>
        </ConfirmDialog>
      )}

      {detailInvoice && (
        <Modal
          title={`Invoice #${detailInvoice.id}`}
          description={`${detailInvoice.clientName || "Client"} · ${detailInvoice.invoiceDate ? formatDate(detailInvoice.invoiceDate) : ""}`}
          onClose={closeDetail}
          footer={<button type="button" className="secondaryButton cmBtn" onClick={closeDetail}>Close</button>}
        >
          {detailLoading ? (
            <LoadingState label="Loading invoice details…" />
          ) : detailError ? (
            <ErrorState message={detailError} onRetry={() => { setDetailError(""); setDetailLoading(true); }} />
          ) : !detailInvoice ? (
            <EmptyState title="No invoice" message="The backend returned no record for this invoice." />
          ) : (
            <div className="cmDetailGrid">
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Invoice number</span>
                <span className="cmDetailValue">{detailInvoice.invoiceNumber || detailInvoice.invoiceId || detailInvoice.id || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Client</span>
                <span className="cmDetailValue">{detailInvoice.clientName || detailInvoice.clientCode || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Client ID</span>
                <span className="cmDetailValue">{detailInvoice.clientId != null ? detailInvoice.clientId : "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Invoice date</span>
                <span className="cmDetailValue">{formatDate(detailInvoice.invoiceDate) || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Due date</span>
                <span className="cmDetailValue">{formatDate(detailInvoice.dueDate) || "—"}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Status</span>
                <span className="cmDetailValue"><Chip tone={invoiceStatusTone(detailInvoice.status)}>{invoiceStatusLabel(detailInvoice.status)}</Chip></span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Total amount</span>
                <span className="cmDetailValue">{currency(detailInvoice.totalAmount)}</span>
              </div>
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Outstanding balance</span>
                <span className="cmDetailValue">{detailInvoice.outstandingBalance != null ? currency(detailInvoice.outstandingBalance) : "—"}</span>
              </div>
              {detailInvoice.payments && detailInvoice.payments.length > 0 && (
                <>
                  <div className="cmDetailRow cmDetailFull">
                    <span className="cmDetailLabel">Payment history</span>
                    <div className="cmDetailValue">
                      <table className="cmTable" style={{ width: "100%", fontSize: "12px", marginTop: 6 }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Mode</th>
                            <th>Reference</th>
                            <th>TDS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailInvoice.payments.map((payment) => (
                            <tr key={payment.id || payment.paymentDate}>
                              <td className="cmMuted">{formatDate(payment.paymentDate) || "—"}</td>
                              <td className="cmMuted">{currency(payment.amount)}</td>
                              <td className="cmMuted">{paymentModeLabel(payment.mode)}</td>
                              <td className="cmMuted">{payment.referenceNumber || "—"}</td>
                              <td className="cmMuted">{payment.tdsDeducted != null ? currency(payment.tdsDeducted) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {detailInvoice.creditNotes && detailInvoice.creditNotes.length > 0 && (
                    <div className="cmDetailRow cmDetailFull">
                      <span className="cmDetailLabel">Credit notes</span>
                      <div className="cmDetailValue">
                        {detailInvoice.creditNotes.map((cn) => (
                          <div key={cn.id || cn.issueDate} className="cmMuted" style={{ marginBottom: 4 }}>
                            {cn.issueDate ? formatDate(cn.issueDate) : "—"} · {cn.amount != null ? currency(cn.amount) : "—"} · {cn.reason || "—"}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {detailInvoice.notes && (
                <div className="cmDetailRow cmDetailFull">
                  <span className="cmDetailLabel">Notes</span>
                  <span className="cmDetailValue cmDetailMessage">{detailInvoice.notes}</span>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
