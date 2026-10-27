"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Filter, Plus, Search } from "lucide-react";
import {
  Chip,
  EmptyState,
  ErrorState,
  FlashBanner,
  LoadingState,
  SectionHead,
  formatDate,
  useFlash,
} from "@/app/admin/admin-ui";
import {
  createDeployment,
  getDeployment,
  getWorkerDeploymentHistory,
  listDeployments,
  releaseDeployment,
  transferDeployment,
} from "@/lib/deploymentApi";
import { listWorkers } from "@/lib/workerApi";
import { listClientSites, listManpowerCategories } from "@/lib/adminApi";
import { listRequisitions } from "@/lib/requisitionApi";
import { getAuthSession } from "@/lib/auth";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRANSFERRED", label: "Transferred" },
  { value: "RELEASED", label: "Released" },
  { value: "COMPLETED", label: "Completed" },
];

function statusTone(status) {
  if (status === "ACTIVE") return "success";
  if (status === "COMPLETED") return "info";
  if (status === "RELEASED") return "warn";
  if (status === "TRANSFERRED") return "neutral";
  return "neutral";
}

export default function ClientDeploymentsPanel({ session: propSession } = {}) {
  const session = propSession || getAuthSession();
  const user = (session && session.user) || {};
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isClient = roles.includes("CLIENT");
  const canRead = permissions.includes("DEPLOYMENT_READ") || isClient || roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r));
  const canManage = false; // client should not manage per requirements

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", siteId: "", workerId: "", status: "" });
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({ content: [], page: 0, size: PAGE_SIZE, totalPages: 0, totalElements: 0, first: true, last: true, empty: true });
  const [loading, setLoading] = useState(canRead);
  const [error, setError] = useState("");
  const [sites, setSites] = useState([]);
  const [flash, showFlash] = useFlash();
  const [detail, setDetail] = useState(null);
  const [historyWorker, setHistoryWorker] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    (async () => {
      try { const s = await listClientSites(); setSites(Array.isArray(s) ? s : s?.content || []); } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!canRead) return undefined;
    const current = ++seq.current;
    setLoading(true); setError("");
    listDeployments({
      siteId: filters.siteId || undefined,
      workerId: filters.workerId || undefined,
      status: filters.status || undefined,
      page,
      size: PAGE_SIZE,
      sort: ["id,desc"],
    })
      .then((payload) => {
        if (seq.current !== current) return;
        if (payload && Array.isArray(payload.content)) setData(payload);
        else if (Array.isArray(payload)) setData({ content: payload, page, size: PAGE_SIZE, totalPages: 1, totalElements: payload.length, first: true, last: true, empty: payload.length === 0 });
        else setData({ content: [], page: 0, size: PAGE_SIZE, totalPages: 0, totalElements: 0, first: true, last: true, empty: true });
      })
      .catch((err) => {
        if (seq.current !== current) return;
        setError(err instanceof Error ? err.message : "Deployments could not be loaded.");
        setData({ content: [], page: 0, size: PAGE_SIZE, totalPages: 0, totalElements: 0, first: true, last: true, empty: true });
      })
      .finally(() => { if (seq.current === current) setLoading(false); });
    return () => { seq.current += 1; };
  }, [canRead, filters, page, refreshKey]);

  function applySearch(e) { e.preventDefault(); setPage(0); setFilters((f) => ({ ...f, search: searchInput.trim() })); }
  function changeFilter(k, v) { setPage(0); setFilters((f) => ({ ...f, [k]: v })); }
  function reload(msg) { setRefreshKey((v) => v + 1); if (msg) showFlash("success", msg); }

  async function openHistory(workerId) {
    setHistoryWorker(workerId); setHistoryLoading(true);
    try { const h = await getWorkerDeploymentHistory(workerId); setHistory(Array.isArray(h) ? h : h?.content || []); }
    catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }

  if (!canRead) return <EmptyState title="Deployment access not available" message="Your role does not grant deployment access." />;

  return (
    <div className="cmWorkersPanel">
      <SectionHead title="My Deployments" description="View workers deployed at your sites." />
      <FlashBanner flash={flash} />
      <div className="cmToolbar">
        <form className="cmToolbarControls" onSubmit={applySearch}>
          <div className="cmSearchBox"><Search size={15} /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search deployments" /></div>
          <button type="submit" className="secondaryButton cmBtn" disabled={loading}>Search</button>
          <label className="cmSelect"><Filter size={14} /><select value={filters.siteId} onChange={(e) => changeFilter("siteId", e.target.value)}><option value="">All sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.siteCode || s.siteName}</option>)}</select></label>
          <label className="cmSelect"><Filter size={14} /><select value={filters.status} onChange={(e) => changeFilter("status", e.target.value)}>{STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        </form>
      </div>

      {loading ? <LoadingState message="Loading deployments..." /> : error ? <ErrorState title="Failed to load" message={error} action={<button className="secondaryButton" onClick={() => reload()}>Retry</button>} /> : data.empty || data.content.length === 0 ? <EmptyState title="No deployments found" message="No deployment records match your filters." /> : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead><tr><th>Employee Code</th><th>Worker</th><th>Site</th><th>Category</th><th>Start</th><th>End</th><th>Status</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {data.content.map((d) => {
                const id = d.id || d.deploymentId;
                return (<tr key={id}>
                  <td>{d.worker?.employeeCode || d.employeeCode || "-"}</td>
                  <td>{d.worker?.fullName || d.workerName || "-"}</td>
                  <td>{d.site?.siteCode || d.siteCode || "-"}</td>
                  <td>{d.category?.name || d.categoryName || "-"}</td>
                  <td>{formatDate(d.startDate)}</td>
                  <td>{d.endDate ? formatDate(d.endDate) : "-"}</td>
                  <td><Chip tone={statusTone(d.status)}>{d.status}</Chip></td>
                  <td>{d.inForceToday ? "Yes" : "No"}</td>
                  <td><div className="cmRowActions">
                    <button className="cmLink" onClick={async () => { try { const det = await getDeployment(id); setDetail(det); } catch { setDetail(d); } }}>View</button>
                    <button className="cmLink" onClick={() => openHistory(d.workerId || d.worker?.id)}>History</button>
                  </div></td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      )}

      {historyWorker && (
        <div className="cmDrawerOverlay" onClick={() => setHistoryWorker(null)}><div className="cmDrawer" onClick={(e) => e.stopPropagation()}>
          <div className="cmDrawerHead"><h2>Worker Deployment History</h2><button onClick={() => setHistoryWorker(null)}>×</button></div>
          <div className="cmDrawerBody">{historyLoading ? <LoadingState message="Loading history..." /> : history.length === 0 ? <EmptyState title="No history" /> : history.map((h, i) => (<div key={i} style={{ border: "1px solid #eee", padding: 10, marginBottom: 8, borderRadius: 8 }}><div><strong>{h.client?.legalName || h.clientName}</strong> - {h.site?.siteName || h.siteName}</div><div>{formatDate(h.startDate)} to {h.endDate ? formatDate(h.endDate) : "Open"}</div><div><Chip tone={statusTone(h.status)}>{h.status}</Chip></div></div>))}</div>
        </div></div>
      )}

      {detail && (
        <div className="cmDrawerOverlay" onClick={() => setDetail(null)}><div className="cmDrawer" onClick={(e) => e.stopPropagation()}>
          <div className="cmDrawerHead"><h2>Deployment Details</h2><button onClick={() => setDetail(null)}>×</button></div>
          <div className="cmDrawerBody"><div style={{ display: "grid", gap: 8 }}>
            <div><strong>ID:</strong> {detail.id || detail.deploymentId}</div>
            <div><strong>Worker:</strong> {detail.worker?.fullName || detail.workerName} ({detail.worker?.employeeCode || detail.employeeCode})</div>
            <div><strong>Site:</strong> {detail.site?.siteName || detail.siteName} ({detail.site?.siteCode || detail.siteCode})</div>
            <div><strong>Category:</strong> {detail.category?.name || detail.categoryName}</div>
            <div><strong>Start:</strong> {formatDate(detail.startDate)} <strong>End:</strong> {detail.endDate ? formatDate(detail.endDate) : "-"}</div>
            <div><strong>Shift:</strong> {detail.shift || "-"}</div>
            <div><strong>Status:</strong> <Chip tone={statusTone(detail.status)}>{detail.status}</Chip></div>
            <div><strong>Active Today:</strong> {detail.inForceToday ? "Yes" : "No"}</div>
            <div><strong>Days Served:</strong> {detail.daysServed ?? "-"}</div>
            <div><strong>Release Date:</strong> {detail.releaseDate ? formatDate(detail.releaseDate) : "-"}</div>
            <div><strong>Release Reason:</strong> {detail.releaseReason || "-"}</div>
            <div><strong>Notes:</strong> {detail.notes || "-"}</div>
          </div></div>
        </div></div>
      )}
    </div>
  );
}
