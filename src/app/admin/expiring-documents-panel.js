"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Loader2, RefreshCw, TriangleAlert, UsersRound } from "lucide-react";
import {
  Chip,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  Notice,
  SectionHead,
  formatDate,
  useFlash,
} from "./admin-ui";
import { listExpiringWorkerDocuments, workerCapabilities, workerDocumentTypeLabel, DOCUMENT_VERIFICATION_TONES } from "../../lib/workerApi";
import WorkerDetailDrawer from "./worker-detail";

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

export default function ExpiringDocumentsPanel({ session }) {
  const capabilities = workerCapabilities(session);
  const [withinDays, setWithinDays] = useState(30);
  const [documents, setDocuments] = useState([]);
  const [documentsError, setDocumentsError] = useState("");
  const [docsKey, setDocsKey] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailId, setDetailId] = useState(null);
  const [flash, showFlash] = useFlash();
  const requestKey = `${withinDays}:${refreshKey}`;

  const loading = useMemo(() => capabilities.canList && docsKey !== requestKey, [capabilities.canList, docsKey, requestKey]);

  const reload = useCallback(() => {
    setDocumentsError("");
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!capabilities.canList) return undefined;
    const current = requestKey;
    listExpiringWorkerDocuments(withinDays)
      .then((payload) => {
        setDocuments(Array.isArray(payload) ? payload : []);
        setDocumentsError("");
        setDocsKey(current);
      })
      .catch((error) => {
        setDocumentsError(error instanceof Error ? error.message : "Expiring documents could not be loaded.");
        setDocsKey(current);
      });
  }, [capabilities.canList, withinDays, requestKey]);

  const expiredCount = useMemo(
    () => documents.filter((item) => Boolean(item.expired)).length,
    [documents],
  );
  const approachingCount = useMemo(
    () =>
      documents.filter(
        (item) => !Boolean(item.expired) && Number.isFinite(Number(item.daysUntilExpiry)) && Number(item.daysUntilExpiry) <= 7,
      ).length,
    [documents],
  );

  function daysLabel(item) {
    if (Boolean(item.expired)) return "Expired";
    if (Number.isFinite(Number(item.daysUntilExpiry))) {
      const days = Number(item.daysUntilExpiry);
      return days <= 0 ? "Expired" : `${days} day${days === 1 ? "" : "s"} until expiry`;
    }
    return "—";
  }

  if (!capabilities.canList) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Document compliance is not available"
        message="Your role does not include document oversight. Ask the Super Admin to review your access."
      />
    );
  }

  if (loading) return <LoadingState label="Loading expiring documents…" />;
  if (documentsError) return <ErrorState message={documentsError} onRetry={reload} />;

  return (
    <div className="edExpiryPanel">
      <SectionHead
        title="Expiring documents"
        description={`Verified worker documents with an expiry date within the next ${withinDays} day${withinDays === 1 ? "" : "s"}. Pending and rejected documents are not compliance evidence.`}
        action={(
          <div className="cmStatusRow" style={{ gap: 8 }}>
            <label className="cmSelect" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, margin: 0 }}>
              <CalendarDays size={13} />
              <select
                value={String(withinDays)}
                aria-label="Expiry look-ahead window"
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (Number.isFinite(parsed) && parsed > 0) {
                    setWithinDays(parsed);
                    reload();
                  }
                }}
              >
                {DAYS_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} day{days === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="secondaryButton cmBtn" onClick={reload} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        )}
      />

      <FlashBanner flash={flash} />

      <div className="edSummaryRow" style={{ marginTop: 8, gap: 16, display: "flex", flexWrap: "wrap" }}>
        <div className="edSummaryItem">
          <strong>{documents.length}</strong>
          <span>Verified documents expiring</span>
        </div>
        {expiredCount > 0 && (
          <div className="edSummaryItem edSummaryItem--expired">
            <strong>{expiredCount}</strong>
            <span>Already expired</span>
          </div>
        )}
        {approachingCount > 0 && (
          <div className="edSummaryItem edSummaryItem--approaching">
            <strong>{approachingCount}</strong>
            <span>Expiring within 7 days</span>
          </div>
        )}
      </div>

      {!documents.length ? (
        <EmptyState
          icon={TriangleAlert}
          title="No expiring documents"
          message={`No verified documents expire within the next ${withinDays} day${withinDays === 1 ? "" : "s"}.`}
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Document type</th>
                <th>Reference number</th>
                <th>Status</th>
                <th>Expires on</th>
                <th>Days until expiry</th>
                <th className="cmColActions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                const expired = Boolean(document.expired);
                const days = Number(document.daysUntilExpiry);
                const approaching = !expired && Number.isFinite(days) && days <= 7;
                return (
                  <tr key={document.id ?? document.documentId ?? `${document.workerId}-${document.referenceNumber}`}>
                    <td>
                      <div className="edWorkerCell">
                        <span className="edWorkerAvatar" aria-hidden="true">
                          {String(document.workerId ?? "").charAt(0) || "W"}
                        </span>
                        <span>
                          <strong>#{document.workerId ?? "—"}</strong>
                        </span>
                      </div>
                    </td>
                    <td className="cmMuted">{workerDocumentTypeLabel(document.documentType)}</td>
                    <td className="cmMuted">{document.referenceNumber || "—"}</td>
                    <td>
                      <Chip tone={DOCUMENT_VERIFICATION_TONES[document.verificationStatus] || "neutral"}>
                        {document.verificationStatus || "VERIFIED"}
                      </Chip>
                    </td>
                    <td className="cmMuted">{formatDate(document.expiresOn) || "—"}</td>
                    <td>
                      <Chip tone={expired ? "danger" : approaching ? "warn" : "neutral"}>{daysLabel(document)}</Chip>
                    </td>
                    <td className="cmColActions">
                      <button
                        type="button"
                        className="cmIconButton"
                        title="Open worker profile"
                        aria-label={`Open profile of worker #${document.workerId}`}
                        onClick={() => setDetailId(document.workerId)}
                      >
                        <UsersRound size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expiredCount > 0 && (
        <Notice tone="error">
          <TriangleAlert size={13} /> {expiredCount} verified document{expiredCount === 1 ? "" : "s"} already expired. Open the worker profile to
          review or upload a replacement.
        </Notice>
      )}
      {approachingCount > 0 && expiredCount === 0 && (
        <Notice tone="warn">
          <Clock size={13} /> {approachingCount} document{approachingCount === 1 ? "" : "s"} expiring within 7 days.
        </Notice>
      )}

      {detailId != null && (
        <WorkerDetailDrawer
          key={detailId}
          workerId={detailId}
          capabilities={capabilities}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
