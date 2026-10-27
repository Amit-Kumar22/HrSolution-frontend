"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Download,
  FileText,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserMinus,
  Wallet,
} from "lucide-react";
import {
  Chip,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  Notice,
  formatDate,
  formatDateTime,
  useFlash,
} from "./admin-ui";
import {
  DEPLOYMENT_STATUS_TONES,
  DOCUMENT_VERIFICATION_TONES,
  deleteBankAccount,
  deleteWorker,
  deleteWorkerDocument,
  getWorker,
  listBankAccounts,
  listSalaryStructures,
  listWorkerDeployments,
  listWorkerDocuments,
  markWorkerSettled,
  policeStatusLabel,
  policeStatusTone,
  setBankAccountActive,
  setPrimaryBankAccount,
  workerDocumentTypeLabel,
  workerStatusLabel,
  workerStatusTone,
} from "../../lib/workerApi";
import { fetchDocumentBlob } from "../../lib/adminApi";
import {
  BankAccountModal,
  PoliceVerificationModal,
  SalaryStructureModal,
  SensitiveWorkerModal,
  WorkerDocumentUploadModal,
  WorkerDocumentVerifyModal,
  WorkerExitModal,
  WorkerFormModal,
} from "./worker-modals";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function useLazyList(fetcher, workerId, active, refreshKey) {
  const [state, setState] = useState({ items: [], loadedKey: null, error: "" });
  const seq = useRef(0);
  const requestKey = `${workerId ?? ""}:${refreshKey}`;

  useEffect(() => {
    if (!active || !workerId) return undefined;
    const current = ++seq.current;
    fetcher(workerId)
      .then((items) => {
        if (seq.current === current) setState({ items, loadedKey: requestKey, error: "" });
      })
      .catch((error) => {
        if (seq.current === current) {
          setState({
            items: [],
            loadedKey: requestKey,
            error: error instanceof Error ? error.message : "The records could not be loaded.",
          });
        }
      });
    return () => {
      seq.current += 1;
    };
  }, [fetcher, workerId, active, refreshKey, requestKey]);

  return {
    items: state.items,
    error: state.error,
    loading: Boolean(active && workerId) && state.loadedKey !== requestKey,
  };
}

function DetailRow({ label, value, full = false }) {
  return (
    <div className={`cmDetailRow${full ? " cmDetailFull" : ""}`}>
      <span className="cmDetailLabel">{label}</span>
      <span className="cmDetailValue">{value === null || value === undefined || value === "" ? "-" : value}</span>
    </div>
  );
}

export default function WorkerDetailDrawer({ workerId, capabilities, selfWorkerId = null, onClose, onChanged, inline = false }) {
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("overview");
  const [flash, showFlash] = useFlash();
  const [salaryRefresh, setSalaryRefresh] = useState(0);
  const [documentsRefresh, setDocumentsRefresh] = useState(0);
  const [bankRefresh, setBankRefresh] = useState(0);
  const [deploymentRefresh, setDeploymentRefresh] = useState(0);
  const [editing, setEditing] = useState(false);
  const [policeOpen, setPoliceOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [sensitiveOpen, setSensitiveOpen] = useState(false);
  const [deleteWorkerOpen, setDeleteWorkerOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [documentDeleteTarget, setDocumentDeleteTarget] = useState(null);
  const [bankDeleteTarget, setBankDeleteTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [documentBusy, setDocumentBusy] = useState(null);
  const seq = useRef(0);

  const forbidden = selfWorkerId != null && String(selfWorkerId) !== String(workerId);

  function retryLoad() {
    setLoadError("");
    setLoading(true);
    setReloadKey((value) => value + 1);
  }

  useEffect(() => {
    if (forbidden) return undefined;
    const current = ++seq.current;
    getWorker(workerId)
      .then((payload) => {
        if (seq.current === current) setWorker(payload);
      })
      .catch((error) => {
        if (seq.current === current) setLoadError(error instanceof Error ? error.message : "The worker could not be loaded.");
      })
      .finally(() => {
        if (seq.current === current) setLoading(false);
      });
    return () => {
      seq.current += 1;
    };
  }, [workerId, forbidden, reloadKey]);

  const salary = useLazyList(listSalaryStructures, workerId, tab === "salary" && Boolean(capabilities.canSalary), salaryRefresh);
  const documents = useLazyList(listWorkerDocuments, workerId, tab === "documents", documentsRefresh);
  const bank = useLazyList(listBankAccounts, workerId, tab === "bank", bankRefresh);
  const deployments = useLazyList(listWorkerDeployments, workerId, tab === "deployments", deploymentRefresh);

  function applyWorker(updated, message) {
    if (updated && typeof updated === "object" && updated.id != null) {
      setWorker((previous) => ({ ...previous, ...updated }));
    }
    if (message) showFlash("success", message);
    if (onChanged) onChanged();
  }

  function refreshWorker() {
    getWorker(workerId)
      .then((payload) => {
        setWorker(payload);
        if (onChanged) onChanged();
      })
      .catch(() => {});
  }

  async function handleSettle() {
    if (busyAction) return;
    setBusyAction("settle");
    try {
      const updated = await markWorkerSettled(workerId);
      applyWorker(updated, "Full and final settlement marked complete.");
      setSettleOpen(false);
    } catch (error) {
      setSettleOpen(false);
      showFlash("error", error instanceof Error ? error.message : "The settlement could not be marked.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteWorker() {
    if (busyAction) return;
    setBusyAction("delete");
    try {
      await deleteWorker(workerId);
      setDeleteWorkerOpen(false);
      if (onChanged) onChanged();
      onClose();
    } catch (error) {
      setDeleteWorkerOpen(false);
      showFlash("error", error instanceof Error ? error.message : "The worker could not be deleted.");
      setBusyAction("");
    }
  }

  async function handleDocumentDelete() {
    if (!documentDeleteTarget || busyAction) return;
    setBusyAction("doc-delete");
    try {
      await deleteWorkerDocument(documentDeleteTarget.id);
      setDocumentDeleteTarget(null);
      setDocumentsRefresh((value) => value + 1);
      refreshWorker();
      showFlash("success", "The document was removed.");
    } catch (error) {
      setDocumentDeleteTarget(null);
      showFlash("error", error instanceof Error ? error.message : "The document could not be removed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleBankDelete() {
    if (!bankDeleteTarget || busyAction) return;
    setBusyAction("bank-delete");
    try {
      await deleteBankAccount(bankDeleteTarget.id);
      setBankDeleteTarget(null);
      setBankRefresh((value) => value + 1);
      showFlash("success", "The bank account was removed.");
    } catch (error) {
      setBankDeleteTarget(null);
      showFlash("error", error instanceof Error ? error.message : "The bank account could not be removed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleToggleBank() {
    if (!toggleTarget || busyAction) return;
    setBusyAction("bank-toggle");
    try {
      await setBankAccountActive(toggleTarget.id, !toggleTarget.active);
      setBankRefresh((value) => value + 1);
      showFlash("success", toggleTarget.active ? "The account was deactivated." : "The account was activated.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The bank account could not be updated.");
    } finally {
      setToggleTarget(null);
      setBusyAction("");
    }
  }

  async function promoteBank(account) {
    if (busyAction) return;
    setBusyAction("bank-primary");
    try {
      await setPrimaryBankAccount(account.id);
      setBankRefresh((value) => value + 1);
      showFlash("success", "The primary account was changed.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The primary account could not be changed.");
    } finally {
      setBusyAction("");
    }
  }

  async function openDocument(document, download) {
    if (!document?.documentId) return;
    setDocumentBusy(document.id);
    try {
      const { blob, filename } = await fetchDocumentBlob(document.documentId);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      if (download) {
        anchor.download = filename || document.fileName || `worker-document-${document.id}`;
      } else {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The document could not be opened.");
    } finally {
      setDocumentBusy(null);
    }
  }

  const tabs = [
    { value: "overview", label: "Overview" },
    ...(capabilities.canSalary ? [{ value: "salary", label: "Salary" }] : []),
    ...(capabilities.canDocuments ? [{ value: "documents", label: `Documents${worker && worker.documentCount ? ` (${worker.documentCount})` : ""}` }] : []),
    ...(capabilities.canBank ? [{ value: "bank", label: "Bank" }] : []),
    ...(!capabilities.selfService ? [{ value: "deployments", label: "Deployments" }] : []),
  ];

  return (
    <>
      <Drawer
        size="lg"
        inline={inline}
        title="Worker profile"
        description={worker ? `${worker.fullName || "Worker"} - ${worker.employeeCode || `#${worker.id}`}` : `Worker #${workerId}`}
        onClose={onClose}
        footer={(
          <div className="cmStatusRow" style={{ justifyContent: "space-between", width: "100%" }}>
            <span className="cmPageInfo">Worker #{workerId}</span>
            <div className="cmStatusRow">
              {capabilities.canManage && worker && (
                <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> Edit
                </button>
              )}
              {capabilities.canManage && worker && (
                <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => setPoliceOpen(true)}>
                  <ShieldCheck size={14} /> Police verification
                </button>
              )}
              {capabilities.canManage && worker && worker.employed && (
                <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => setExitOpen(true)}>
                  <UserMinus size={14} /> Record exit
                </button>
              )}
              {capabilities.canSettle && worker && !worker.employed && !worker.fullAndFinalSettled && (
                <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => setSettleOpen(true)}>
                  <BadgeCheck size={14} /> Mark settled
                </button>
              )}
              {capabilities.canDelete && worker && (
                <button type="button" className="cmIconButton cmIconDanger" title="Delete worker" aria-label="Delete worker" onClick={() => setDeleteWorkerOpen(true)}>
                  <Trash2 size={15} />
                </button>
              )}
              {!inline && <button type="button" className="primaryButton cmBtn cmPageBtn" onClick={onClose}>Close</button>}
            </div>
          </div>
        )}
      >
        {forbidden ? (
          <ErrorState message="This profile does not belong to your account." />
        ) : loading ? (
          <LoadingState label="Loading worker..." />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={retryLoad} />
        ) : !worker ? (
          <EmptyState title="No worker data" message="The backend returned no record for this worker id." />
        ) : (
          <>
            <FlashBanner flash={flash} />
            <div className="cmStatusRow" style={{ marginBottom: 12 }}>
              <Chip tone={workerStatusTone(worker.status)}>{workerStatusLabel(worker.status)}</Chip>
              <Chip tone={policeStatusTone(worker.policeVerificationStatus)}>Police: {policeStatusLabel(worker.policeVerificationStatus)}</Chip>
              {worker.clearedForSecurityWork ? (
                <Chip tone="success">Cleared for security work</Chip>
              ) : (
                <Chip tone="warn">Not cleared for security work</Chip>
              )}
              <Chip tone={worker.employed ? "info" : "neutral"}>{worker.employed ? "Employed" : "Left"}</Chip>
              {!worker.employed && (
                <Chip tone={worker.fullAndFinalSettled ? "success" : "warn"}>
                  {worker.fullAndFinalSettled ? "Final settlement done" : "Settlement pending"}
                </Chip>
              )}
              {worker.documentCount != null && (
                <Chip tone={worker.documentsPendingVerification ? "warn" : "neutral"}>
                  {worker.documentCount} document{worker.documentCount === 1 ? "" : "s"}
                  {worker.documentsPendingVerification ? ` - ${worker.documentsPendingVerification} pending` : ""}
                </Chip>
              )}
            </div>

            <div className="cmTabs" role="tablist" aria-label="Worker sections">
              {tabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  className={tab === item.value ? "cmTab cmTabActive" : "cmTab"}
                  onClick={() => setTab(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <>
                <div className="cmDetailGrid">
                  <DetailRow label="Full name" value={worker.fullName} />
                  <DetailRow label="Employee code" value={worker.employeeCode} />
                  <DetailRow label="Father or husband" value={worker.fatherOrHusbandName} />
                  <DetailRow label="Gender" value={worker.gender ? worker.gender.charAt(0) + worker.gender.slice(1).toLowerCase() : ""} />
                  <DetailRow label="Date of birth" value={formatDate(worker.dateOfBirth)} />
                  <DetailRow label="Age" value={worker.age != null ? `${worker.age} years` : ""} />
                  <DetailRow label="Date of joining" value={formatDate(worker.dateOfJoining)} />
                  <DetailRow label="Service" value={worker.serviceMonths != null ? `${worker.serviceMonths} months` : ""} />
                  <DetailRow label="Phone" value={worker.phone} />
                  <DetailRow label="Email" value={worker.email} />
                  <DetailRow label="Current deployment" value={worker.currentDeploymentLabel} full />
                </div>

                <div className="cmDetailSection">
                  <h3>Address</h3>
                  <div className="cmDetailGrid">
                    <DetailRow label="Address line 1" value={worker.addressLine1} />
                    <DetailRow label="Address line 2" value={worker.addressLine2} />
                    <DetailRow label="City" value={worker.city} />
                    <DetailRow label="State" value={worker.state} />
                    <DetailRow label="Pincode" value={worker.pincode} />
                  </div>
                </div>

                <div className="cmDetailSection">
                  <div className="cmSectionHeadInline">
                    <h3>Statutory identifiers</h3>
                    {capabilities.canSensitive && (
                      <button type="button" className="secondaryButton cmBtn cmPageBtn" onClick={() => setSensitiveOpen(true)}>
                        <ShieldAlert size={14} /> View Aadhaar and PAN
                      </button>
                    )}
                  </div>
                  <div className="cmDetailGrid">
                    <DetailRow label="Aadhaar" value={worker.aadhaarMasked || (worker.aadhaarOnFile ? "On file" : "Not on file")} />
                    <DetailRow label="PAN" value={worker.panMasked || "Not on file"} />
                    <DetailRow label="UAN" value={worker.uan} />
                    <DetailRow label="ESIC IP number" value={worker.esicIpNumber} />
                  </div>
                </div>

                <div className="cmDetailSection">
                  <h3>Emergency contact</h3>
                  <div className="cmDetailGrid">
                    <DetailRow label="Name" value={worker.emergencyContactName} />
                    <DetailRow label="Phone" value={worker.emergencyContactPhone} />
                    <DetailRow label="Relation" value={worker.emergencyContactRelation} />
                  </div>
                </div>

                {!worker.employed && (
                  <div className="cmDetailSection">
                    <h3>Exit</h3>
                    <div className="cmDetailGrid">
                      <DetailRow label="Last working day" value={formatDate(worker.lastWorkingDay)} />
                      <DetailRow label="Reason" value={worker.exitReason} full />
                    </div>
                  </div>
                )}

                {!capabilities.selfService && worker.notes && (
                  <div className="cmDetailSection">
                    <h3>Internal notes</h3>
                    <p className="cmDetailMessage">{worker.notes}</p>
                  </div>
                )}
              </>
            )}

            {tab === "salary" && capabilities.canSalary && (
              <div>
                <div className="cmStatusRow" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="cmMuted">Dated history, newest first. Each revision closes the one before it.</span>
                  {capabilities.canSalary && worker.employed && (
                    <button type="button" className="primaryButton cmBtn" onClick={() => setSalaryOpen(true)}>
                      <Plus size={14} /> Add revision
                    </button>
                  )}
                </div>
                {salary.loading ? (
                  <LoadingState label="Loading wage history..." />
                ) : salary.error ? (
                  <ErrorState message={salary.error} onRetry={() => setSalaryRefresh((value) => value + 1)} />
                ) : !salary.items.length ? (
                  <EmptyState icon={Wallet} title="No wage structure" message="Add the first structure to start payroll." />
                ) : (
                  <div className="cmSalaryList">
                    {salary.items.map((entry) => (
                      <article className="cmSalaryCard" key={entry.id}>
                        <div className="cmSalaryHead">
                          <div>
                            <strong>{formatDate(entry.effectiveFrom)}</strong>
                            <span className="cmMuted">
                              {entry.effectiveTo ? ` to ${formatDate(entry.effectiveTo)}` : " onwards"}
                            </span>
                          </div>
                          <div className="cmStatusRow">
                            {entry.current && <Chip tone="success">Current</Chip>}
                            <strong className="cmSalaryGross">{formatMoney(entry.gross)}</strong>
                          </div>
                        </div>
                        <div className="cmSalaryGrid">
                          <SalaryItem label="Basic" value={entry.basic} />
                          <SalaryItem label="DA" value={entry.da} />
                          <SalaryItem label="HRA" value={entry.hra} />
                          <SalaryItem label="Conveyance" value={entry.conveyance} />
                          <SalaryItem label="Other" value={entry.otherAllowance} />
                          <SalaryItem label="PF base" value={entry.providentFundBase} />
                          <SalaryItem label="OT per hour" value={entry.otRatePerHour} />
                        </div>
                        {entry.notes && <p className="cmMuted">{entry.notes}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "documents" && (
              <div>
                <div className="cmStatusRow" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="cmMuted">Verified documents are compliance evidence and cannot be deleted.</span>
                  {capabilities.canDocuments && !capabilities.selfService && (
                    <button type="button" className="primaryButton cmBtn" onClick={() => setUploadOpen(true)}>
                      <Plus size={14} /> Upload document
                    </button>
                  )}
                </div>
                {documents.loading ? (
                  <LoadingState label="Loading documents..." />
                ) : documents.error ? (
                  <ErrorState message={documents.error} onRetry={() => setDocumentsRefresh((value) => value + 1)} />
                ) : !documents.items.length ? (
                  <EmptyState
                    icon={FileText}
                    title="No documents"
                    message={capabilities.selfService ? "No documents are on file for your profile." : "Upload identity, police verification and medical documents here."}
                  />
                ) : (
                  <div className="cmDocList">
                    {documents.items.map((document) => (
                      <article className="cmDocCard" key={document.id}>
                        <div className="cmDocMain">
                          <span className="cmDocIcon"><FileText size={17} /></span>
                          <div>
                            <strong>{document.documentTypeLabel || workerDocumentTypeLabel(document.documentType)}</strong>
                            <small>{document.fileName}{document.sizeBytes ? ` - ${formatBytes(document.sizeBytes)}` : ""}</small>
                            <small>
                              {document.referenceNumber ? `Ref ${document.referenceNumber}` : "No reference"}
                              {document.issuedOn ? ` - issued ${formatDate(document.issuedOn)}` : ""}
                              {document.expiresOn ? ` - expires ${formatDate(document.expiresOn)}` : ""}
                            </small>
                          </div>
                        </div>
                        <div className="cmDocMeta">
                          <Chip tone={DOCUMENT_VERIFICATION_TONES[document.verificationStatus] || "neutral"}>
                            {document.verificationStatus || "PENDING"}
                          </Chip>
                          {document.expired && <Chip tone="danger">Expired</Chip>}
                          {document.validEvidence && <Chip tone="success">Valid evidence</Chip>}
                          {document.missingExpectedExpiry && <Chip tone="warn">No expiry recorded</Chip>}
                          {document.verifiedByName && (
                            <span className="cmMuted">by {document.verifiedByName}{document.verifiedAt ? ` on ${formatDateTime(document.verifiedAt)}` : ""}</span>
                          )}
                          {document.rejectionReason && <span className="cmMuted">Reason: {document.rejectionReason}</span>}
                        </div>
                        <div className="cmRowActions">
                          <button
                            type="button"
                            className="cmIconButton"
                            title="Download document"
                            aria-label="Download document"
                            onClick={() => openDocument(document, true)}
                            disabled={documentBusy === document.id}
                          >
                            {documentBusy === document.id ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                          </button>
                          {capabilities.canManage && document.verificationStatus === "PENDING" && (
                            <button
                              type="button"
                              className="cmIconButton"
                              title="Verify or reject document"
                              aria-label="Verify or reject document"
                              onClick={() => setVerifyTarget(document)}
                            >
                              <ShieldCheck size={14} />
                            </button>
                          )}
                          {capabilities.canManage && document.verificationStatus !== "VERIFIED" && (
                              <button
                                type="button"
                                className="cmIconButton cmIconDanger"
                                title="Remove document"
                                aria-label="Remove document"
                                onClick={() => setDocumentDeleteTarget(document)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "bank" && (
              <div>
                <div className="cmStatusRow" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <span className="cmMuted">Account numbers are masked. The transfer file is built server-side.</span>
                  {capabilities.canBank && !capabilities.selfService && (
                    <button type="button" className="primaryButton cmBtn" onClick={() => setBankOpen(true)} disabled={bank.loading}>
                      <Plus size={14} /> Add account
                    </button>
                  )}
                </div>
                {bank.loading ? (
                  <LoadingState label="Loading bank accounts..." />
                ) : bank.error ? (
                  <ErrorState message={bank.error} onRetry={() => setBankRefresh((value) => value + 1)} />
                ) : !bank.items.length ? (
                  <EmptyState icon={Landmark} title="No bank account" message="Add the account wages should be paid into." />
                ) : (
                  <div className="cmBankList">
                    {bank.items.map((account) => (
                      <article className="cmBankCard" key={account.id}>
                        <div className="cmBankMain">
                          <span className="cmDocIcon"><Landmark size={17} /></span>
                          <div>
                            <strong>{account.displayLabel || account.accountNumberMasked}</strong>
                            <small>{account.accountHolderName || worker.fullName}{account.ifsc ? ` - IFSC ${account.ifsc}` : ""}</small>
                            <small>{[account.bankName, account.branch].filter(Boolean).join(", ")}</small>
                          </div>
                        </div>
                        <div className="cmStatusRow">
                          {account.primaryAccount && <Chip tone="success">Primary</Chip>}
                          <Chip tone={account.active ? "info" : "neutral"}>{account.active ? "Active" : "Inactive"}</Chip>
                        </div>
                        {capabilities.canBank && !capabilities.selfService && (
                          <div className="cmRowActions">
                            {!account.primaryAccount && account.active && (
                              <button
                                type="button"
                                className="secondaryButton cmBtn cmPageBtn"
                                onClick={() => promoteBank(account)}
                                disabled={Boolean(busyAction)}
                              >
                                Make primary
                              </button>
                            )}
                            <button
                              type="button"
                              className="secondaryButton cmBtn cmPageBtn"
                              onClick={() => setToggleTarget(account)}
                              disabled={Boolean(busyAction) || account.primaryAccount}
                              title={account.primaryAccount ? "Promote another account before deactivating the primary." : undefined}
                            >
                              {account.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              className="cmIconButton cmIconDanger"
                              title={
                                account.primaryAccount && bank.items.length > 1
                                  ? "Promote another account before removing the primary."
                                  : "Remove account"
                              }
                              aria-label="Remove account"
                              onClick={() => setBankDeleteTarget(account)}
                              disabled={Boolean(busyAction) || (account.primaryAccount && bank.items.length > 1)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "deployments" && (
              <div>
                {deployments.loading ? (
                  <LoadingState label="Loading deployment history..." />
                ) : deployments.error ? (
                  <ErrorState message={deployments.error} onRetry={() => setDeploymentRefresh((value) => value + 1)} />
                ) : !deployments.items.length ? (
                  <EmptyState icon={Building2} title="No deployments" message="This worker has not been posted to a client site yet." />
                ) : (
                  <div className="cmSalaryList">
                    {deployments.items.map((entry) => (
                      <article className="cmSalaryCard" key={entry.id}>
                        <div className="cmSalaryHead">
                          <div>
                            <strong>{entry.displayLabel || `${entry.clientName || "Client"} - ${entry.categoryName || "Posting"}`}</strong>
                            <span className="cmMuted">
                              {formatDate(entry.startDate)} to {entry.endDate ? formatDate(entry.endDate) : "open ended"}
                              {entry.shift ? ` - ${entry.shift.toLowerCase()} shift` : ""}
                            </span>
                          </div>
                          <div className="cmStatusRow">
                            {entry.inForceToday && <Chip tone="success">In force today</Chip>}
                            <Chip tone={DEPLOYMENT_STATUS_TONES[entry.status] || "neutral"}>{entry.status || "ACTIVE"}</Chip>
                          </div>
                        </div>
                        <div className="cmSalaryGrid">
                          <SalaryItem label="Client" value={entry.clientName} text />
                          <SalaryItem label="Site" value={entry.siteName || entry.siteCode} text />
                          <SalaryItem label="Role" value={entry.categoryName} text />
                          <SalaryItem label="Requisition" value={entry.requisitionNumber} text />
                          <SalaryItem label="Days served" value={entry.daysServed} text />
                          {capabilities.canSalary && <SalaryItem label="Monthly wage" value={entry.monthlyWage} money />}
                          {capabilities.canSalary && <SalaryItem label="Billing rate" value={entry.billingRate} money />}
                          {capabilities.canSalary && <SalaryItem label="Gross margin" value={entry.grossMarginPerMonth} money />}
                        </div>
                        {entry.releaseReason && <p className="cmMuted">Released: {entry.releaseReason}{entry.releasedOn ? ` on ${formatDate(entry.releasedOn)}` : ""}</p>}
                        {entry.notes && <p className="cmMuted">{entry.notes}</p>}
                        {capabilities.canSalary && entry.billingBelowWage && <Notice tone="warn">The client is billed less than the worker is paid on this posting.</Notice>}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>

      {editing && worker && (
        <WorkerFormModal
          mode="edit"
          worker={worker}
          capabilities={capabilities}
          layered
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            applyWorker(updated, "Worker details saved.");
          }}
        />
      )}
      {policeOpen && worker && (
        <PoliceVerificationModal
          worker={worker}
          onClose={() => setPoliceOpen(false)}
          onSaved={(updated) => {
            setPoliceOpen(false);
            applyWorker(updated, "Police verification recorded.");
          }}
        />
      )}
      {exitOpen && worker && (
        <WorkerExitModal
          worker={worker}
          onClose={() => setExitOpen(false)}
          onSaved={(updated) => {
            setExitOpen(false);
            applyWorker(updated, "Worker exit recorded.");
          }}
        />
      )}
      {salaryOpen && worker && (
        <SalaryStructureModal
          worker={worker}
          onClose={() => setSalaryOpen(false)}
          onSaved={() => {
            setSalaryOpen(false);
            setSalaryRefresh((value) => value + 1);
            showFlash("success", "Wage revision saved.");
          }}
        />
      )}
      {uploadOpen && worker && (
        <WorkerDocumentUploadModal
          worker={worker}
          onClose={() => setUploadOpen(false)}
          onSaved={() => {
            setUploadOpen(false);
            setDocumentsRefresh((value) => value + 1);
            refreshWorker();
            showFlash("success", "Document uploaded and pending verification.");
          }}
        />
      )}
      {verifyTarget && (
        <WorkerDocumentVerifyModal
          document={verifyTarget}
          onClose={() => setVerifyTarget(null)}
          onSaved={() => {
            setVerifyTarget(null);
            setDocumentsRefresh((value) => value + 1);
            refreshWorker();
            showFlash("success", "Document decision saved.");
          }}
        />
      )}
      {bankOpen && worker && (
        <BankAccountModal
          worker={worker}
          hasAccounts={bank.items.length > 0}
          onClose={() => setBankOpen(false)}
          onSaved={() => {
            setBankOpen(false);
            setBankRefresh((value) => value + 1);
            showFlash("success", "Bank account added.");
          }}
        />
      )}
      {sensitiveOpen && worker && (
        <SensitiveWorkerModal worker={worker} onClose={() => setSensitiveOpen(false)} />
      )}
      {deleteWorkerOpen && (
        <ConfirmDialog
          title="Delete worker"
          message="This is a soft delete and is refused when the worker has any deployment on record. Record an exit instead if they have worked on a site."
          confirmLabel="Delete worker"
          busy={busyAction === "delete"}
          onConfirm={handleDeleteWorker}
          onCancel={() => setDeleteWorkerOpen(false)}
        />
      )}
      {settleOpen && (
        <ConfirmDialog
          title="Mark final settlement done"
          message="Confirm that the full and final settlement has been completed for this worker."
          confirmLabel="Mark settled"
          confirmVariant="primary"
          busy={busyAction === "settle"}
          onConfirm={handleSettle}
          onCancel={() => setSettleOpen(false)}
        />
      )}
      {documentDeleteTarget && (
        <ConfirmDialog
          title="Remove document"
          message="The document will be soft deleted. Verified documents cannot be removed."
          confirmLabel="Remove document"
          busy={busyAction === "doc-delete"}
          onConfirm={handleDocumentDelete}
          onCancel={() => setDocumentDeleteTarget(null)}
        />
      )}
      {bankDeleteTarget && (
        <ConfirmDialog
          title="Remove bank account"
          message="The account will be soft deleted. A primary account cannot be removed while another account exists."
          confirmLabel="Remove account"
          busy={busyAction === "bank-delete"}
          onConfirm={handleBankDelete}
          onCancel={() => setBankDeleteTarget(null)}
        />
      )}
      {toggleTarget && (
        <ConfirmDialog
          title={toggleTarget.active ? "Deactivate account" : "Activate account"}
          message={toggleTarget.active ? "The primary account cannot be deactivated. Promote another account first." : "This account will become active again."}
          confirmLabel={toggleTarget.active ? "Deactivate" : "Activate"}
          confirmVariant={toggleTarget.active ? "danger" : "primary"}
          busy={busyAction === "bank-toggle"}
          onConfirm={handleToggleBank}
          onCancel={() => setToggleTarget(null)}
        />
      )}
    </>
  );
}

function SalaryItem({ label, value, text = false, money = false }) {
  const display = text ? value || "-" : money ? formatMoney(value) : value != null && value !== "" ? formatMoney(value) : "-";
  return (
    <div className="cmSalaryItem">
      <span>{label}</span>
      <strong>{display}</strong>
    </div>
  );
}
