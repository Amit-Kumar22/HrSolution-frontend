"use client";

import { useEffect, useRef, useState } from "react";
import { Filter, Fingerprint, Pencil, Plus, RefreshCw, Search, UsersRound } from "lucide-react";
import {
  Chip,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  SectionHead,
  formatDate,
  useFlash,
} from "./admin-ui";
import {
  POLICE_VERIFICATION_STATUSES,
  WORKER_STATUSES,
  listWorkers,
  policeStatusLabel,
  policeStatusTone,
  workerCapabilities,
  workerStatusLabel,
  workerStatusTone,
} from "../../lib/workerApi";
import WorkerDetailDrawer from "./worker-detail";
import { WorkerFormModal, WorkerLookupModal } from "./worker-modals";

const PAGE_SIZE = 20;

function initialsOf(worker) {
  const source = worker.fullName || [worker.firstName, worker.lastName].filter(Boolean).join(" ") || "W";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function WorkerPanel({ session, capabilities: suppliedCapabilities = null }) {
  const capabilities = suppliedCapabilities || workerCapabilities(session);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", policeVerification: "" });
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({ content: [], page: 0, totalPages: 0, totalElements: 0, last: true });
  const [loading, setLoading] = useState(capabilities.canList);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [flash, showFlash] = useFlash();
  const seq = useRef(0);

  useEffect(() => {
    if (!capabilities.canList) return undefined;
    const current = ++seq.current;
    listWorkers({
      search: filters.search || undefined,
      status: filters.status || undefined,
      policeVerification: filters.policeVerification || undefined,
      page,
      size: PAGE_SIZE,
      sort: ["firstName,ASC"],
    })
      .then((payload) => {
        if (seq.current !== current) return;
        setData(payload);
        if (payload.totalPages > 0 && page >= payload.totalPages) {
          setPage(Math.max(0, payload.totalPages - 1));
        }
      })
      .catch((err) => {
        if (seq.current !== current) return;
        setError(err instanceof Error ? err.message : "Workers could not be loaded.");
        setData({ content: [], page: 0, totalPages: 0, totalElements: 0, last: true });
      })
      .finally(() => {
        if (seq.current === current) setLoading(false);
      });
    return () => {
      seq.current += 1;
    };
  }, [capabilities.canList, filters.search, filters.status, filters.policeVerification, page, refreshKey]);

  function beginLoad() {
    setLoading(true);
    setError("");
  }

  function applySearch(event) {
    event.preventDefault();
    beginLoad();
    setPage(0);
    setFilters((previous) => ({ ...previous, search: searchInput.trim() }));
    setRefreshKey((value) => value + 1);
  }

  function changeFilter(key, value) {
    beginLoad();
    setPage(0);
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function changePage(step) {
    beginLoad();
    setPage((value) => Math.max(0, value + step));
  }

  function clearFilters() {
    beginLoad();
    setSearchInput("");
    setPage(0);
    setFilters({ search: "", status: "", policeVerification: "" });
  }

  function reload(message) {
    beginLoad();
    setRefreshKey((value) => value + 1);
    if (message) showFlash("success", message);
  }

  if (!capabilities.canList) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Worker access is not available"
        message="Your role does not include worker management. Ask the Super Admin to review your access."
      />
    );
  }

  return (
    <div className="cmWorkersPanel">
      <SectionHead
        title="Workers"
        description="Onboard, verify and maintain the workforce. Aadhaar and PAN stay masked everywhere except the audit-logged sensitive view."
        action={(
          <div className="cmStatusRow">
            {capabilities.canLookup && (
              <button type="button" className="secondaryButton cmBtn" onClick={() => setLookupOpen(true)}>
                <Fingerprint size={15} /> Find by Aadhaar
              </button>
            )}
            {capabilities.canManage && (
              <button type="button" className="primaryButton cmBtn" onClick={() => setCreateOpen(true)}>
                <Plus size={15} /> Onboard worker
              </button>
            )}
          </div>
        )}
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar">
        <form className="cmToolbarControls" onSubmit={applySearch}>
          <div className="cmSearchBox">
            <Search size={15} />
            <input
              type="search"
              value={searchInput}
              placeholder="Search by name, code, phone or UAN"
              aria-label="Search workers"
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <button type="submit" className="secondaryButton cmBtn" disabled={loading}>Search</button>
          <label className="cmSelect">
            <Filter size={14} />
            <select
              value={filters.status}
              aria-label="Filter by worker status"
              onChange={(event) => changeFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {WORKER_STATUSES.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <Filter size={14} />
            <select
              value={filters.policeVerification}
              aria-label="Filter by police verification"
              onChange={(event) => changeFilter("policeVerification", event.target.value)}
            >
              <option value="">All police verification</option>
              {POLICE_VERIFICATION_STATUSES.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>
          {(filters.search || filters.status || filters.policeVerification) && (
            <button type="button" className="secondaryButton cmBtn" onClick={clearFilters}>Clear</button>
          )}
        </form>
        <div className="cmToolbarControls">
          <span className="cmCount">
            {data.totalElements} worker{data.totalElements === 1 ? "" : "s"}
          </span>
          <button type="button" className="secondaryButton cmBtn" onClick={() => reload()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading workers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => reload()} />
      ) : !data.content.length ? (
        <EmptyState
          icon={UsersRound}
          title={filters.search || filters.status || filters.policeVerification ? "No workers match these filters" : "No workers onboarded yet"}
          message={
            filters.search || filters.status || filters.policeVerification
              ? "Try a different search or clear the filters."
              : "Onboard the first worker, or convert a joined application from the Applications screen."
          }
        />
      ) : (
        <>
          <div className="cmTableWrap">
            <table className="cmTable">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Police verification</th>
                  <th>Joined</th>
                  <th>Current deployment</th>
                  <th className="cmColActions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((worker) => (
                  <tr key={worker.id}>
                    <td>
                      <div className="cmWorkerCell">
                        <span className="cmWorkerAvatar" aria-hidden="true">{initialsOf(worker)}</span>
                        <span>
                          <strong>{worker.fullName || "Unnamed worker"}</strong>
                          <small>{worker.employeeCode || `#${worker.id}`}</small>
                        </span>
                      </div>
                    </td>
                    <td className="cmMuted">{worker.phone || "-"}</td>
                    <td><Chip tone={workerStatusTone(worker.status)}>{workerStatusLabel(worker.status)}</Chip></td>
                    <td><Chip tone={policeStatusTone(worker.policeVerificationStatus)}>{policeStatusLabel(worker.policeVerificationStatus)}</Chip></td>
                    <td className="cmMuted">{worker.dateOfJoining ? formatDate(worker.dateOfJoining) : "-"}</td>
                    <td className="cmMuted">{worker.currentDeploymentLabel || "On bench"}</td>
                    <td className="cmColActions">
                      <div className="cmRowActions">
                        <button
                          type="button"
                          className="cmIconButton"
                          title="View worker"
                          aria-label={`View ${worker.fullName || `worker ${worker.id}`}`}
                          onClick={() => setDetailId(worker.id)}
                        >
                          <UsersRound size={14} />
                        </button>
                        {capabilities.canManage && (
                          <button
                            type="button"
                            className="cmIconButton"
                            title="Open and edit worker"
                            aria-label={`Edit ${worker.fullName || `worker ${worker.id}`}`}
                            onClick={() => setDetailId(worker.id)}
                          >
                            <Pencil size={14} />
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
            <span className="cmPageInfo">
              Page {page + 1} of {Math.max(1, data.totalPages)} - {data.totalElements} worker{data.totalElements === 1 ? "" : "s"}
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

      {createOpen && (
        <WorkerFormModal
          mode="create"
          capabilities={capabilities}
          onClose={() => setCreateOpen(false)}
          onSaved={(created) => {
            setCreateOpen(false);
            reload("Worker onboarded and placed on the bench.");
            if (created && created.id != null) setDetailId(created.id);
          }}
        />
      )}

      {lookupOpen && (
        <WorkerLookupModal
          onClose={() => setLookupOpen(false)}
          onOpenWorker={(id) => {
            setLookupOpen(false);
            setDetailId(id);
          }}
        />
      )}

      {detailId != null && (
        <WorkerDetailDrawer
          key={detailId}
          workerId={detailId}
          capabilities={capabilities}
          onClose={() => setDetailId(null)}
          onChanged={() => reload()}
        />
      )}
    </div>
  );
}
