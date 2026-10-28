"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, Plus } from "lucide-react";
import {
  Chip,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  Modal,
  Notice,
  SectionHead,
  formatDate,
  formatDateTime,
  useFlash,
} from "../admin/admin-ui";
import { WorkerDocumentUploadModal } from "../admin/worker-modals";
import { fetchDocumentBlob } from "../../lib/adminApi";
import {
  DOCUMENT_VERIFICATION_TONES,
  DOCUMENT_TYPES_WITH_EXPIRY,
  getWorker,
  listWorkerDocuments,
  workerDocumentTypeLabel,
} from "../../lib/workerApi";

function bytesOf(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function uploadedOn(document) {
  return document.uploadedOn || document.createdAt || document.issuedOn || null;
}

export default function WorkerDocumentsPanel({ session }) {
  const user = (session && session.user) || {};
  const workerId = user && user.id != null ? String(user.id) : null;
  const [worker, setWorker] = useState(null);
  const [workerKey, setWorkerKey] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentsError, setDocumentsError] = useState("");
  const [docsKey, setDocsKey] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(null);
  const [busyDownload, setBusyDownload] = useState(null);
  const [flash, showFlash] = useFlash();
  const requestKey = `${workerId ?? ""}:${refreshKey}`;

  const loading = useMemo(
    () => Boolean(workerId) && (workerKey !== requestKey || docsKey !== requestKey),
    [workerId, requestKey, workerKey, docsKey],
  );

  const reload = useCallback(() => {
    setDocumentsError("");
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!workerId) return undefined;
    const current = requestKey;
    getWorker(workerId)
      .then((payload) => {
        setWorker(payload);
        setWorkerKey(current);
      })
      .catch(() => {
        setWorkerKey(current);
      });
    listWorkerDocuments(workerId)
      .then((payload) => {
        setDocuments(Array.isArray(payload) ? payload : []);
        setDocumentsError("");
        setDocsKey(current);
      })
      .catch(() => {
        setDocumentsError("Your documents could not be loaded.");
        setDocsKey(current);
      });
  }, [workerId, requestKey]);

  function openDocument(document, download) {
    if (!document?.documentId) return;
    setBusyDownload(document.id);
    fetchDocumentBlob(document.documentId)
      .then(({ blob, filename }) => {
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
      })
      .catch((error) => {
        showFlash("error", error instanceof Error ? error.message : "The document could not be opened.");
      })
      .finally(() => {
        setBusyDownload(null);
      });
  }

  function handleUploadSaved() {
    setUploadOpen(false);
    reload();
    showFlash("success", "Document uploaded and pending verification.");
  }

  if (loading) return <LoadingState label="Loading your documents…" />;
  if (!workerId) return <ErrorState message="No worker account is linked to this session." />;
  if (documentsError) return <ErrorState message={documentsError} onRetry={reload} />;

  const workerForModal = worker || {
    id: workerId,
    fullName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Worker",
    employeeCode: workerId ? `#${workerId}` : undefined,
  };

  return (
    <div className="wdWorkerDocumentsPanel">
      <SectionHead
        title="My documents"
        description="Upload identity, police verification, medical and licence documents. Uploaded files are reviewed by your HR team and cannot be changed once verified."
        action={(
          <button type="button" className="primaryButton cmBtn" onClick={() => setUploadOpen(true)} disabled={!workerId}>
            <Plus size={15} /> Upload document
          </button>
        )}
      />

      <FlashBanner flash={flash} />

      {!documents.length ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          message={
            workerId
              ? "Upload your first document using the button above. PDF, PNG and JPEG files up to 10 MB are accepted."
              : "No worker account is linked to this session."
          }
        />
      ) : (
        <div className="wdDocList">
          {documents.map((document) => (
            <article className="wdDocCard" key={document.id}>
              <div className="wdDocMain">
                <span className="wdDocIcon"><FileText size={17} /></span>
                <div>
                  <strong>{document.documentTypeLabel || workerDocumentTypeLabel(document.documentType)}</strong>
                  <small>
                    {document.fileName}{document.sizeBytes ? ` - ${bytesOf(document.sizeBytes)}` : ""}
                  </small>
                  <small className="wdDocMetaLine">
                    {uploadedOn(document) ? `Uploaded ${formatDate(uploadedOn(document))}` : ""}
                    {document.referenceNumber ? ` · Ref ${document.referenceNumber}` : ""}
                    {document.issuedOn ? ` · issued ${formatDate(document.issuedOn)}` : ""}
                    {document.expiresOn ? ` · expires ${formatDate(document.expiresOn)}` : ""}
                  </small>
                </div>
              </div>
              <div className="wdDocMeta">
                <Chip tone={DOCUMENT_VERIFICATION_TONES[document.verificationStatus] || "neutral"}>
                  {document.verificationStatus || "PENDING"}
                </Chip>
                {document.expired && <Chip tone="danger">Expired</Chip>}
                {document.validEvidence && <Chip tone="success">Valid compliance evidence</Chip>}
                {DOCUMENT_TYPES_WITH_EXPIRY.includes(document.documentType) && !document.expiresOn && !document.expired && (
                  <Chip tone="warn">No expiry recorded</Chip>
                )}
                {document.verifiedByName && (
                  <span className="wdDocMuted">Verified by {document.verifiedByName}{document.verifiedAt ? ` on ${formatDateTime(document.verifiedAt)}` : ""}</span>
                )}
                {document.rejectionReason && (
                  <span className="wdDocMuted wdDocMuted--reject">Rejection reason: {document.rejectionReason}</span>
                )}
              </div>
              <div className="wdRowActions">
                <button
                  type="button"
                  className="wdIconButton"
                  title="Open document"
                  aria-label={`Open ${document.fileName || "document"}`}
                  onClick={() => openDocument(document, false)}
                  disabled={busyDownload === document.id}
                >
                  {busyDownload === document.id ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                </button>
                <button
                  type="button"
                  className="wdIconButton"
                  title="View document details"
                  aria-label="View document details"
                  onClick={() => setDetailOpen(document)}
                  disabled={Boolean(detailOpen)}
                >
                  <FileText size={14} />
                </button>
                <button
                  type="button"
                  className="wdIconButton"
                  title="Download document"
                  aria-label={`Download ${document.fileName || "document"}`}
                  onClick={() => openDocument(document, true)}
                  disabled={busyDownload === document.id}
                >
                  {busyDownload === document.id ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {uploadOpen && workerId && (
        <WorkerDocumentUploadModal
          worker={workerForModal}
          onClose={() => setUploadOpen(false)}
          onSaved={handleUploadSaved}
        />
      )}
      {detailOpen && (
        <Modal
          title="Document details"
          description={detailOpen.fileName || detailOpen.documentType || "Document"}
          onClose={() => setDetailOpen(null)}
          footer={(
            <div className="cmStatusRow" style={{ justifyContent: "space-between", width: "100%" }}>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setDetailOpen(null)}>Close</button>
              {detailOpen.documentId && (
                <button
                  type="button"
                  className="primaryButton cmBtn"
                  onClick={() => openDocument(detailOpen, true)}
                  disabled={busyDownload === detailOpen.id}
                >
                  {busyDownload === detailOpen.id ? <><Loader2 size={14} className="spin" /> Downloading…</> : <><Download size={15} /> Download file</>}
                </button>
              )}
            </div>
          )}
        >
          <div className="cmDetailGrid">
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Document type</span>
              <span className="cmDetailValue">{detailOpen.documentTypeLabel || workerDocumentTypeLabel(detailOpen.documentType)}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">File</span>
              <span className="cmDetailValue">{detailOpen.fileName || "—"}{detailOpen.sizeBytes ? ` (${bytesOf(detailOpen.sizeBytes)})` : ""}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Reference number</span>
              <span className="cmDetailValue">{detailOpen.referenceNumber || "—"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Issued on</span>
              <span className="cmDetailValue">{formatDate(detailOpen.issuedOn)}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Expires on</span>
              <span className="cmDetailValue">{detailOpen.expiresOn ? formatDate(detailOpen.expiresOn) : "—"}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Uploaded on</span>
              <span className="cmDetailValue">{formatDate(uploadedOn(detailOpen))}</span>
            </div>
            <div className="cmDetailRow">
              <span className="cmDetailLabel">Verification status</span>
              <span className="cmDetailValue"><Chip tone={DOCUMENT_VERIFICATION_TONES[detailOpen.verificationStatus] || "neutral"}>{detailOpen.verificationStatus || "PENDING"}</Chip></span>
            </div>
            {detailOpen.verifiedByName && (
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Verified by</span>
                <span className="cmDetailValue">{detailOpen.verifiedByName}{detailOpen.verifiedAt ? ` on ${formatDateTime(detailOpen.verifiedAt)}` : ""}</span>
              </div>
            )}
            {detailOpen.rejectionReason && (
              <div className="cmDetailRow cmDetailFull">
                <span className="cmDetailLabel">Rejection reason</span>
                <span className="cmDetailValue cmDetailMessage">{detailOpen.rejectionReason}</span>
              </div>
            )}
            {detailOpen.expired && (
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Compliance</span>
                <span className="cmDetailValue"><Chip tone="danger">Expired</Chip></span>
              </div>
            )}
            {detailOpen.validEvidence && (
              <div className="cmDetailRow">
                <span className="cmDetailLabel">Compliance</span>
                <span className="cmDetailValue"><Chip tone="success">Valid compliance evidence</Chip></span>
              </div>
            )}
            {DOCUMENT_TYPES_WITH_EXPIRY.includes(detailOpen.documentType) && !detailOpen.expiresOn && !detailOpen.expired && (
              <Notice tone="warn">This document type normally requires an expiry date. No expiry has been recorded, so it will not be tracked for renewal.</Notice>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
