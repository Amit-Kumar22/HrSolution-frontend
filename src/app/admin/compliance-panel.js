"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  createChallan,
  createLicence,
  generateComplianceReminders,
  getReport,
  listChallans,
  listClients,
  listComplianceReminders,
  listLicences,
  updateLicence,
} from "../../lib/adminApi";
import {
  canGenerateComplianceReminders,
  canManageCompliance,
  canViewComplianceReminders,
  canViewReports,
} from "../../lib/feature-access";
import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  SectionHead,
} from "./admin-ui";
import styles from "./compliance-panel.module.css";

const CHALLAN_TYPES = ["PF", "ESI", "PT", "LWF", "TDS"];
const LICENCE_TYPES = ["CONTRACT_LABOUR", "PSARA", "GST", "ESI", "SHOP_ESTABLISHMENT", "TRADE", "ISO"];
const LICENCE_STATUSES = ["ACTIVE", "EXPIRED", "UNDER_RENEWAL"];
const REMINDER_WINDOWS = [7, 15, 30, 60];
const PAGE_SIZES = [10, 20, 50];
const REPORT_OPTIONS = [
  { value: "payroll", label: "Payroll" },
  { value: "compliance", label: "Compliance" },
  { value: "billingAgeing", label: "Billing ageing" },
  { value: "attendance", label: "Attendance" },
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(amount);
}

function Pagination({ page, pageCount, totalElements, onPageChange, size, onSizeChange }) {
  return (
    <div className={`cmPagination ${styles.pagination}`}>
      <label className="cmSelect">
        Rows
        <select value={size} onChange={(event) => onSizeChange(Number(event.target.value))}>
          {PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <span className="cmPageInfo">
        {totalElements} record{totalElements === 1 ? "" : "s"} · Page {page + 1} of {Math.max(pageCount, 1)}
      </span>
      <button
        type="button"
        className="cmPageBtn"
        aria-label="Previous page"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={15} /> Previous
      </button>
      <button
        type="button"
        className="cmPageBtn"
        aria-label="Next page"
        disabled={page + 1 >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRight size={15} />
      </button>
    </div>
  );
}

function ChallanForm({ onClose, onCreated }) {
  const [values, setValues] = useState({
    challanType: "PF",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    amount: "",
    paidOn: "",
    challanNumber: "",
    documentPath: "",
    returnFiled: false,
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [saving, setSaving] = useState(false);

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const validation = {};
    const amount = Number(values.amount);
    const month = Number(values.month);
    const year = Number(values.year);
    if (!CHALLAN_TYPES.includes(values.challanType)) validation.challanType = "Choose a supported challan type.";
    if (!Number.isInteger(month) || month < 1 || month > 12) validation.month = "Choose a valid month.";
    if (!Number.isInteger(year) || year < 1900 || year > 9999) validation.year = "Enter a valid year.";
    if (!Number.isFinite(amount) || amount <= 0) validation.amount = "Amount must be greater than zero.";
    if (values.paidOn && Number.isNaN(Date.parse(values.paidOn))) validation.paidOn = "Enter a valid payment date.";
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }

    setSaving(true);
    setRequestError("");
    try {
      await createChallan({
        challanType: values.challanType,
        month,
        year,
        amount,
        paidOn: values.paidOn || undefined,
        challanNumber: values.challanNumber.trim() || undefined,
        documentPath: values.documentPath.trim() || undefined,
        returnFiled: values.returnFiled,
        notes: values.notes.trim() || undefined,
      });
      onCreated();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The challan could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create challan" description="Record a statutory payment using the supported challan fields." onClose={onClose} wide>
      {requestError && <p className="actionError" role="alert">{requestError}</p>}
      <form className={`cmForm ${styles.form}`} onSubmit={submit}>
        <Field label="Challan type" htmlFor="challan-type" required error={errors.challanType}>
          <select id="challan-type" value={values.challanType} onChange={(event) => setField("challanType", event.target.value)}>
            {CHALLAN_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </Field>
        <Field label="Month" htmlFor="challan-month" required error={errors.month}>
          <select id="challan-month" value={values.month} onChange={(event) => setField("month", event.target.value)}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Date(2020, index, 1).toLocaleString(undefined, { month: "long" })}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year" htmlFor="challan-year" required error={errors.year}>
          <input id="challan-year" type="number" min="1900" max="9999" value={values.year} onChange={(event) => setField("year", event.target.value)} />
        </Field>
        <Field label="Amount" htmlFor="challan-amount" required error={errors.amount}>
          <input id="challan-amount" type="number" min="0.01" step="0.01" value={values.amount} onChange={(event) => setField("amount", event.target.value)} />
        </Field>
        <Field label="Payment date" htmlFor="challan-paid-on" error={errors.paidOn}>
          <input id="challan-paid-on" type="date" value={values.paidOn} onChange={(event) => setField("paidOn", event.target.value)} />
        </Field>
        <Field label="Challan number" htmlFor="challan-number">
          <input id="challan-number" value={values.challanNumber} onChange={(event) => setField("challanNumber", event.target.value)} maxLength={120} />
        </Field>
        <Field label="Document path" htmlFor="challan-document">
          <input id="challan-document" value={values.documentPath} onChange={(event) => setField("documentPath", event.target.value)} maxLength={500} />
        </Field>
        <Field label="Notes" htmlFor="challan-notes">
          <textarea id="challan-notes" rows="3" value={values.notes} onChange={(event) => setField("notes", event.target.value)} maxLength={2000} />
        </Field>
        <label className={styles.checkboxField}>
          <input type="checkbox" checked={values.returnFiled} onChange={(event) => setField("returnFiled", event.target.checked)} />
          Return filed
        </label>
        <div className={`cmModalFooter ${styles.formActions}`}>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>{saving ? "Creating…" : "Create challan"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ChallansView({ session }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState("year,DESC");
  const [rows, setRows] = useState([]);
  const [pageInfo, setPageInfo] = useState({ totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const canManage = canManageCompliance(session);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    listChallans({ page, size, sort: [sort] })
      .then((result) => {
        if (!active) return;
        setRows(result.content);
        setPageInfo(result);
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Challans could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, size, sort, reloadKey]);

  function created() {
    setFormOpen(false);
    setSuccess("Challan created successfully.");
    setPage(0);
    reload();
  }

  if (!canManage) return <AccessDenied />;

  return (
    <section className={`cmChallansPanel ${styles.panel}`}>
      <SectionHead
        title="Challans"
        description="Review statutory payment records and create challans."
        action={(
          <div className={styles.actions}>
            <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Refresh</button>
            <button type="button" className="primaryButton cmBtn" onClick={() => { setSuccess(""); setFormOpen(true); }}><FilePlus2 size={14} /> Create challan</button>
          </div>
        )}
      />
      {success && <p className="actionSuccess" role="status">{success}</p>}
      <div className={`cmToolbar ${styles.toolbar}`}>
        <label className="cmSelect">
          Sort by
          <select value={sort} onChange={(event) => { setPage(0); setSort(event.target.value); }}>
            <option value="year,DESC">Year (newest)</option>
            <option value="paidOn,DESC">Payment date (newest)</option>
            <option value="challanType,ASC">Type (A–Z)</option>
          </select>
        </label>
      </div>
      {loading ? <LoadingState label="Loading challans…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !rows.length ? (
        <EmptyState icon={FilePlus2} title="No challans yet" message="Create a challan to start recording statutory payments." />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead><tr><th>Type</th><th>Period</th><th>Amount</th><th>Payment date</th><th>Challan number</th><th>Return filed</th><th>Document</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><Chip tone="info">{row.challanType || "—"}</Chip></td>
                    <td>{row.month ? `${new Date(2020, Number(row.month) - 1, 1).toLocaleString(undefined, { month: "short" })} ${row.year || ""}` : row.year || "—"}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td>{formatDate(row.paidOn)}</td>
                    <td>{row.challanNumber || "—"}</td>
                    <td><Chip tone={row.returnFiled ? "success" : "neutral"}>{row.returnFiled ? "Filed" : "Not filed"}</Chip></td>
                    <td>{row.documentPath ? <a href={row.documentPath} target="_blank" rel="noreferrer">View document</a> : "—"}</td>
                    <td className="cmCellWrap">{row.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={pageInfo.page ?? page} pageCount={pageInfo.totalPages ?? 0} totalElements={pageInfo.totalElements ?? rows.length} onPageChange={setPage} size={size} onSizeChange={(value) => { setPage(0); setSize(value); }} />
        </>
      )}
      {formOpen && <ChallanForm onClose={() => setFormOpen(false)} onCreated={created} />}
    </section>
  );
}

const EMPTY_LICENCE = {
  licenceType: "CONTRACT_LABOUR",
  licenceNumber: "",
  clientId: "",
  issueDate: "",
  expiryDate: "",
  documentPath: "",
  status: "ACTIVE",
  issuingAuthority: "",
  notes: "",
};

function LicenceForm({ licence, clients, onClose, onSaved }) {
  const [values, setValues] = useState(() => licence ? {
    ...EMPTY_LICENCE,
    ...licence,
    clientId: licence.clientId == null ? "" : String(licence.clientId),
    issueDate: licence.issueDate || "",
    expiryDate: licence.expiryDate || "",
  } : { ...EMPTY_LICENCE });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [saving, setSaving] = useState(false);

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const validation = {};
    if (!LICENCE_TYPES.includes(values.licenceType)) validation.licenceType = "Choose a supported licence type.";
    if (!values.licenceNumber.trim()) validation.licenceNumber = "Licence number is required.";
    if (values.issueDate && Number.isNaN(Date.parse(values.issueDate))) validation.issueDate = "Enter a valid issue date.";
    if (values.expiryDate && Number.isNaN(Date.parse(values.expiryDate))) validation.expiryDate = "Enter a valid expiry date.";
    if (values.issueDate && values.expiryDate && values.expiryDate < values.issueDate) validation.expiryDate = "Expiry date cannot be earlier than the issue date.";
    if (values.clientId && !clients.some((client) => String(client.id) === values.clientId)) validation.clientId = "Choose a client from the loaded client list.";
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }

    setSaving(true);
    setRequestError("");
    const body = {
      licenceType: values.licenceType,
      licenceNumber: values.licenceNumber.trim(),
      clientId: values.clientId ? Number(values.clientId) : undefined,
      issueDate: values.issueDate || undefined,
      expiryDate: values.expiryDate || undefined,
      documentPath: values.documentPath.trim() || undefined,
      status: values.status,
      issuingAuthority: values.issuingAuthority.trim() || undefined,
      notes: values.notes.trim() || undefined,
    };
    try {
      if (licence) await updateLicence(licence.id, body);
      else await createLicence(body);
      onSaved(licence ? "Licence updated successfully." : "Licence created successfully.");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The licence could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={licence ? "Edit licence" : "Create licence"}
      description="Choose a client from the existing client list. Client names are supplied by the backend."
      onClose={onClose}
      wide
    >
      {requestError && <p className="actionError" role="alert">{requestError}</p>}
      <form className={`cmForm ${styles.form}`} onSubmit={submit}>
        <Field label="Licence type" htmlFor="licence-type" required error={errors.licenceType}>
          <select id="licence-type" value={values.licenceType} onChange={(event) => setField("licenceType", event.target.value)}>
            {LICENCE_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Licence number" htmlFor="licence-number" required error={errors.licenceNumber}>
          <input id="licence-number" value={values.licenceNumber} onChange={(event) => setField("licenceNumber", event.target.value)} maxLength={120} />
        </Field>
        <Field label="Client" htmlFor="licence-client" error={errors.clientId}>
          <select id="licence-client" value={values.clientId} onChange={(event) => setField("clientId", event.target.value)}>
            <option value="">No client selected</option>
            {clients.map((client) => <option key={client.id} value={String(client.id)}>{client.legalName || client.name || `Client #${client.id}`}</option>)}
          </select>
        </Field>
        <Field label="Status" htmlFor="licence-status">
          <select id="licence-status" value={values.status} onChange={(event) => setField("status", event.target.value)}>
            {LICENCE_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Issue date" htmlFor="licence-issue-date" error={errors.issueDate}>
          <input id="licence-issue-date" type="date" value={values.issueDate} onChange={(event) => setField("issueDate", event.target.value)} />
        </Field>
        <Field label="Expiry date" htmlFor="licence-expiry-date" error={errors.expiryDate}>
          <input id="licence-expiry-date" type="date" value={values.expiryDate} onChange={(event) => setField("expiryDate", event.target.value)} />
        </Field>
        <Field label="Document path" htmlFor="licence-document">
          <input id="licence-document" value={values.documentPath} onChange={(event) => setField("documentPath", event.target.value)} maxLength={500} />
        </Field>
        <Field label="Issuing authority" htmlFor="licence-authority">
          <input id="licence-authority" value={values.issuingAuthority} onChange={(event) => setField("issuingAuthority", event.target.value)} maxLength={200} />
        </Field>
        <Field label="Notes" htmlFor="licence-notes">
          <textarea id="licence-notes" rows="3" value={values.notes} onChange={(event) => setField("notes", event.target.value)} maxLength={2000} />
        </Field>
        <div className={`cmModalFooter ${styles.formActions}`}>
          <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primaryButton cmBtn" disabled={saving}>{saving ? "Saving…" : licence ? "Save changes" : "Create licence"}</button>
        </div>
      </form>
    </Modal>
  );
}

function LicencesView({ session }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState("expiryDate,ASC");
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [pageInfo, setPageInfo] = useState({ totalElements: 0, totalPages: 0 });
  const [clients, setClients] = useState([]);
  const [clientError, setClientError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const canManage = canManageCompliance(session);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    listLicences({ clientId: clientId || undefined, page, size, sort: [sort] })
      .then((result) => {
        if (!active) return;
        setRows(result.content);
        setPageInfo(result);
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Licences could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [clientId, page, size, sort, reloadKey]);

  useEffect(() => {
    if (!canManage) return undefined;
    let active = true;
    listClients({ page: 0, size: 100 })
      .then((result) => {
        if (active) {
          setClients(result.content);
          setClientError("");
        }
      })
      .catch((requestError) => {
        if (active) setClientError(requestError instanceof Error ? requestError.message : "Client options could not be loaded.");
      });
    return () => { active = false; };
  }, [canManage]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rows;
    return rows.filter((licence) => [
      licence.licenceType,
      licence.licenceNumber,
      licence.clientName,
      licence.issuingAuthority,
      licence.status,
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query)));
  }, [rows, search]);

  function saved(message) {
    setFormOpen(false);
    setEditing(null);
    setSuccess(message);
    setPage(0);
    reload();
  }

  if (!canManage) return <AccessDenied />;

  return (
    <section className={`cmLicencesPanel ${styles.panel}`}>
      <SectionHead
        title="Licences"
        description="Search, review, create, and update client licences."
        action={(
          <div className={styles.actions}>
            <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Refresh</button>
            <button type="button" className="primaryButton cmBtn" onClick={() => { setEditing(null); setSuccess(""); setFormOpen(true); }}><FilePlus2 size={14} /> Create licence</button>
          </div>
        )}
      />
      {success && <p className="actionSuccess" role="status">{success}</p>}
      {clientError && <ErrorState message={clientError} onRetry={() => {
        setClientError("");
        listClients({ page: 0, size: 100 })
          .then((result) => setClients(result.content))
          .catch((requestError) => setClientError(requestError instanceof Error ? requestError.message : "Client options could not be loaded."));
      }} />}
      <div className={`cmToolbar ${styles.toolbar}`}>
        <label className={`cmSearchBox ${styles.searchBox}`}>
          <Search size={16} />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page…" aria-label="Search licences on this page" />
        </label>
        <div className="cmToolbarControls">
          <label className="cmSelect">
            Client
            <select value={clientId} onChange={(event) => { setPage(0); setClientId(event.target.value); }}>
              <option value="">All clients</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.legalName || client.name || `Client #${client.id}`}</option>)}
            </select>
          </label>
          <label className="cmSelect">
            Sort by
            <select value={sort} onChange={(event) => { setPage(0); setSort(event.target.value); }}>
              <option value="expiryDate,ASC">Expiry date (soonest)</option>
              <option value="expiryDate,DESC">Expiry date (latest)</option>
              <option value="licenceType,ASC">Type (A–Z)</option>
            </select>
          </label>
        </div>
      </div>
      {loading ? <LoadingState label="Loading licences…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !visibleRows.length ? (
        <EmptyState icon={ShieldCheck} title={search ? "No matching licences on this page" : "No licences found"} message={search ? "Try another search term or move to a different page." : "Create a licence to record its issue and expiry details."} />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead><tr><th>Licence</th><th>Client</th><th>Issue date</th><th>Expiry date</th><th>Status</th><th>Expiry alert</th><th>Authority</th><th>Document</th>{canManage && <th className="cmColActions">Actions</th>}</tr></thead>
              <tbody>
                {visibleRows.map((licence) => {
                  const days = Number(licence.daysUntilExpiry);
                  const expired = Number.isFinite(days) && days <= 0;
                  return (
                    <tr key={licence.id}>
                      <td><strong>{licence.licenceNumber || "—"}</strong><small className={styles.secondaryText}>{String(licence.licenceType || "—").replaceAll("_", " ")}</small></td>
                      <td>{licence.clientName || "—"}</td>
                      <td>{formatDate(licence.issueDate)}</td>
                      <td>{formatDate(licence.expiryDate)}</td>
                      <td><Chip tone={licence.status === "ACTIVE" ? "success" : licence.status === "EXPIRED" ? "danger" : "warn"}>{licence.status || "—"}</Chip></td>
                      <td>
                        {expired
                          ? <Chip tone="danger">Expired</Chip>
                          : licence.expiringSoon
                            ? <Chip tone="warn">{Number.isFinite(days) ? `${days} days left` : "Expiring soon"}</Chip>
                            : Number.isFinite(days)
                              ? <Chip tone="neutral">{days} days left</Chip>
                              : "—"}
                      </td>
                      <td>{licence.issuingAuthority || "—"}</td>
                      <td>{licence.documentPath ? <a href={licence.documentPath} target="_blank" rel="noreferrer">View document</a> : "—"}</td>
                      {canManage && <td className="cmColActions"><button type="button" className="cmIconButton" aria-label={`Edit licence ${licence.licenceNumber || licence.id}`} onClick={() => { setEditing(licence); setFormOpen(true); }}><Pencil size={14} /></button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.searchHint}>Search is limited to the currently loaded page; the API does not provide a search parameter.</p>
          <Pagination page={pageInfo.page ?? page} pageCount={pageInfo.totalPages ?? 0} totalElements={pageInfo.totalElements ?? rows.length} onPageChange={setPage} size={size} onSizeChange={(value) => { setPage(0); setSize(value); }} />
        </>
      )}
      {formOpen && (
        <LicenceForm
          licence={editing}
          clients={clients}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={saved}
        />
      )}
    </section>
  );
}

function RemindersView({ session }) {
  const canView = canViewComplianceReminders(session);
  const canGenerate = canGenerateComplianceReminders(session);
  const [withinDays, setWithinDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!canView) return undefined;
    let active = true;
    listComplianceReminders(withinDays)
      .then((result) => {
        if (active) {
          setRows(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Compliance reminders could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [canView, withinDays, reloadKey]);

  async function generate() {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setSuccess("");
    setError("");
    try {
      await generateComplianceReminders();
      setSuccess("Reminder generation was accepted by the service.");
      reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Reminders could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  if (!canView) return <AccessDenied />;

  return (
    <section className={`cmRemindersPanel ${styles.panel}`}>
      <SectionHead
        title="Compliance reminders"
        description={`Licences expiring or expired within the selected ${withinDays}-day window.`}
        action={(
          <div className={styles.actions}>
            {canGenerate && <button type="button" className="primaryButton cmBtn" onClick={generate} disabled={generating}><CalendarDays size={14} />{generating ? "Generating…" : "Generate reminders"}</button>}
            <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          </div>
        )}
      />
      {success && <p className="actionSuccess" role="status">{success}</p>}
      <div className={`cmToolbar ${styles.toolbar}`}>
        <label className="cmSelect">
          <CalendarDays size={14} />
          Expiry window
          <select value={withinDays} onChange={(event) => setWithinDays(Number(event.target.value))}>
            {REMINDER_WINDOWS.map((days) => <option key={days} value={days}>{days} days</option>)}
          </select>
        </label>
      </div>
      {loading ? <LoadingState label="Loading reminders…" /> : error ? <ErrorState message={error} onRetry={reload} /> : !rows.length ? (
        <EmptyState icon={Check} title="No compliance reminders" message={`No matching licence reminders were returned for the next ${withinDays} days.`} />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead><tr><th>Licence type</th><th>Licence number</th><th>Client</th><th>Expiry date</th><th>Days until expiry</th><th>Reminder level</th></tr></thead>
            <tbody>
              {rows.map((item) => {
                const days = Number(item.daysUntilExpiry);
                const expired = Number.isFinite(days) && days <= 0;
                return (
                  <tr key={item.licenceId}>
                    <td>{String(item.licenceType || "—").replaceAll("_", " ")}</td>
                    <td>{item.licenceNumber || "—"}</td>
                    <td>{item.clientName || "—"}</td>
                    <td>{formatDate(item.expiryDate)}</td>
                    <td><Chip tone={expired ? "danger" : days <= 7 ? "warn" : "neutral"}>{expired ? "Expired" : Number.isFinite(days) ? `${days} days` : "—"}</Chip></td>
                    <td><Chip tone={expired ? "danger" : days <= 7 ? "warn" : "info"}>{item.reminderLevel || "—"}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function printable(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function reportValue(key, value) {
  const label = String(key).toLowerCase();
  const text = printable(value);
  if (value == null || value === "") return text;
  if (label.includes("date") && typeof value === "string") return formatDate(value);
  if (typeof value === "number" && /(amount|salary|earning|deduction|outstanding|balance|payable|billing|gross|net|total)/.test(label)) {
    return formatCurrency(value);
  }
  if (/(status|state|verification|approval|payment)/.test(label)) {
    const normalized = String(value).toLowerCase();
    const tone = /(expired|rejected|failed|overdue|blocked|cancelled)/.test(normalized)
      ? "danger"
      : /(pending|under|due|review)/.test(normalized)
        ? "warn"
        : /(verified|approved|active|paid|completed|clear)/.test(normalized)
          ? "success"
          : "neutral";
    return <Chip tone={tone}>{text.replaceAll("_", " ")}</Chip>;
  }
  return text;
}

function reportLabel(key) {
  return String(key)
    .replaceAll(/([A-Z])/g, " $1")
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function reportSections(data) {
  if (Array.isArray(data)) return { summary: [], sections: [{ key: "Records", rows: data }] };
  if (!data || typeof data !== "object") return { summary: [], sections: [] };
  const summary = [];
  const sections = [];
  const visit = (value, prefix = "") => {
    if (Array.isArray(value)) {
      sections.push({ key: prefix || "Records", rows: value });
      return;
    }
    if (!value || typeof value !== "object") {
      summary.push({ key: prefix || "Value", value });
      return;
    }
    Object.entries(value).forEach(([key, entry]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(entry)) sections.push({ key, rows: entry });
      else if (entry && typeof entry === "object") visit(entry, path);
      else summary.push({ key: path, value: entry });
    });
  };
  visit(data);
  return { summary, sections };
}

function ReportTable({ rows }) {
  const pageSize = 25;
  const [page, setPage] = useState(0);
  if (!rows.length) return <EmptyState icon={AlertCircle} title="No report data" message="The selected report returned no records." />;
  const objectRows = rows.every((row) => row && typeof row === "object" && !Array.isArray(row));
  if (!objectRows) {
    return (
      <ul className={styles.reportList}>
        {rows.map((row, index) => <li key={index}>{printable(row)}</li>)}
      </ul>
    );
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const pageCount = Math.ceil(rows.length / pageSize);
  const safePage = Math.min(page, Math.max(pageCount - 1, 0));
  const visibleRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  return (
    <>
      <div className="cmTableWrap">
        <table className="cmTable">
          <thead><tr>{columns.map((key) => <th key={key}>{reportLabel(key)}</th>)}</tr></thead>
          <tbody>
            {visibleRows.map((row, index) => <tr key={row.id ?? row.workerId ?? row.employeeId ?? index}>{columns.map((key) => <td key={key}>{reportValue(key, row[key])}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="cmPagination">
          <span className="cmPageInfo">{rows.length} records · Page {safePage + 1} of {pageCount}</span>
          <button type="button" className="cmPageBtn" disabled={safePage === 0} onClick={() => setPage((value) => value - 1)}>
            <ChevronLeft size={15} /> Previous
          </button>
          <button type="button" className="cmPageBtn" disabled={safePage + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </>
  );
}

function ReportPayload({ data }) {
  const { summary, sections } = reportSections(data);
  if (!summary.length && !sections.length) {
    return <EmptyState icon={AlertCircle} title="No report data" message="The selected report returned no records." />;
  }
  return (
    <div className={styles.reportPayload}>
      {summary.length > 0 && (
        <dl className={styles.reportSummary}>
          {summary.map(({ key, value }) => <div key={key}><dt>{reportLabel(key)}</dt><dd>{reportValue(key, value)}</dd></div>)}
        </dl>
      )}
      {sections.map(({ key, rows }) => (
        <section key={key}>
          <h2>{reportLabel(key)}</h2>
          <ReportTable rows={rows} />
        </section>
      ))}
    </div>
  );
}

export function ReportsView({ session }) {
  const canView = canViewReports(session);
  const [report, setReport] = useState("compliance");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const needsPeriod = report === "payroll" || report === "attendance";
  const validPeriod = !needsPeriod || (Number(month) >= 1 && Number(month) <= 12 && Number(year) >= 2000);
  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!canView || !validPeriod) return undefined;
    let active = true;
    const filters = needsPeriod ? { month: Number(month), year: Number(year) } : {};
    getReport(report, filters)
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setData(null);
          setError(requestError instanceof Error ? requestError.message : "The report could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [canView, month, needsPeriod, report, reloadKey, validPeriod, year]);

  if (!canView) return <AccessDenied />;

  return (
    <section className={`cmReportsPanel ${styles.panel}`}>
      <SectionHead
        title="Reports"
        description="Live reports returned by the reports API. Client requests rely on the authenticated session; no client ID can be supplied here."
        action={<button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}><RefreshCw size={14} /> Refresh</button>}
      />
      <div className={`cmToolbar ${styles.toolbar}`}>
        <label className="cmSelect">
          Report
          <select value={report} onChange={(event) => setReport(event.target.value)}>
            {REPORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {needsPeriod && (
          <>
            <label className="cmSelect">
              Month
              <select value={month} onChange={(event) => setMonth(event.target.value)}>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {new Date(2020, index, 1).toLocaleString(undefined, { month: "long" })}
                  </option>
                ))}
              </select>
            </label>
            <label className="cmSelect">
              Year
              <input type="number" min="2000" max="9999" value={year} onChange={(event) => setYear(event.target.value)} />
            </label>
          </>
        )}
        {needsPeriod && !validPeriod && <span className="cmFieldError">Enter a valid month and year.</span>}
        {needsPeriod && (
          <button type="button" className="primaryButton cmBtn" onClick={reload} disabled={loading || !validPeriod}>
            Apply
          </button>
        )}
      </div>
      {loading ? <LoadingState label="Loading report…" /> : error ? <ErrorState message={error} onRetry={reload} /> : <ReportPayload data={data} />}
    </section>
  );
}

function AccessDenied() {
  return (
    <div className={styles.denied} role="alert">
      <TriangleAlert size={18} />
      <div><strong>Access restricted</strong><p>Your role does not have permission to access this module.</p></div>
    </div>
  );
}

export default function CompliancePanel({ view, session }) {
  if (view === "challans") return <ChallansView session={session} />;
  if (view === "licences") return <LicencesView session={session} />;
  if (view === "reminders") return <RemindersView session={session} />;
  if (view === "reports") return <ReportsView session={session} />;
  return <AccessDenied />;
}
