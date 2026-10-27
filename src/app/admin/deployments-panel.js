"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Building2,
  CalendarDays,
  Eye,
  Filter,
  History,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { getAuthSession } from "@/lib/auth";
import { listClients, listClientSites, listManpowerCategories } from "@/lib/adminApi";
import { getMyClient, listMySites } from "@/lib/clientApi";
import { listRequisitions } from "@/lib/requisitionApi";
import {
  getWorker,
  listWorkers,
  policeStatusLabel,
  policeStatusTone,
} from "@/lib/workerApi";
import {
  DEPLOYMENT_SHIFTS,
  DEPLOYMENT_STATUSES,
  acceptablePoliceVerification,
  createDeployment,
  deploymentCapabilities,
  deploymentShiftLabel,
  deploymentStatusLabel,
  deploymentStatusTone,
  endDeployment,
  getDeployment,
  isSecurityCategoryName,
  listDeployments,
  listSiteRoster,
  listWorkerDeploymentHistory,
  transferDeployment,
} from "@/lib/deploymentApi";
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
  SectionHead,
  formatDate,
  formatDateTime,
  useFlash,
} from "@/app/admin/admin-ui";
import "./deployments.css";

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

function todayDateString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDaysDateString(value, days) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function clientLabel(client) {
  if (!client) return "—";
  return client.legalName || client.displayName || client.clientCode || `Client #${client.id}`;
}

function siteLabel(site) {
  if (!site) return "—";
  return site.siteCode ? `${site.siteCode} — ${site.siteName || ""}`.trim() : site.siteName || site.name || `Site #${site.id}`;
}

function workerLabel(worker) {
  if (!worker) return "—";
  return `${worker.employeeCode ? `${worker.employeeCode} · ` : ""}${worker.fullName || `Worker #${worker.id}`}`;
}

function requisitionLabel(requisition) {
  if (!requisition) return "—";
  return `${requisition.requisitionNumber || `#${requisition.id}`}${requisition.categoryName ? ` · ${requisition.categoryName}` : ""}${requisition.siteCode ? ` · ${requisition.siteCode}` : ""}`;
}

function categoryLabel(category) {
  if (!category) return "—";
  return category.name || category.categoryName || category.code || `Category #${category.id}`;
}

function StatusChip({ status }) {
  return <Chip tone={deploymentStatusTone(status)}>{deploymentStatusLabel(status)}</Chip>;
}

function PoliceChip({ verified, status }) {
  if (typeof verified === "boolean") {
    return <Chip tone={verified ? "success" : "warn"}>{verified ? "Verified" : "Not verified"}</Chip>;
  }
  if (!status) return <Chip tone="neutral">Unknown</Chip>;
  return <Chip tone={policeStatusTone(status)}>{policeStatusLabel(status)}</Chip>;
}

function DetailRow({ label, children, full = false }) {
  return (
    <div className={full ? "depDetailFull" : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function useLookups(caps, filters, lookupToken) {
  const [clients, setClients] = useState([]);
  const [company, setCompany] = useState(null);
  const [categories, setCategories] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [filterSites, setFilterSites] = useState([]);
  const [requisitions, setRequisitions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listManpowerCategories()
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lookupToken]);

  useEffect(() => {
    let cancelled = false;
    if (caps.isClient) {
      getMyClient({ force: lookupToken > 0 })
        .then((data) => {
          if (cancelled) return;
          setCompany(data);
          if (data && data.id != null) {
            listMySites(data.id)
              .then((sites) => {
                if (!cancelled) setFilterSites(Array.isArray(sites) ? sites : []);
              })
              .catch(() => {
                if (!cancelled) setFilterSites([]);
              });
          }
        })
        .catch(() => {
          if (!cancelled) setCompany(null);
        });
      return () => {
        cancelled = true;
      };
    }

    listClients({ size: 200 })
      .then((page) => {
        if (!cancelled) setClients(Array.isArray(page.content) ? page.content : []);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    listWorkers({ size: 200 })
      .then((page) => {
        if (!cancelled) setWorkers(Array.isArray(page.content) ? page.content : []);
      })
      .catch(() => {
        if (!cancelled) setWorkers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [caps.isClient, lookupToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (caps.isClient) return;
      if (!filters.clientId) {
        if (clients.length === 0) {
          setFilterSites([]);
          return;
        }
        const results = await Promise.allSettled(
          clients.slice(0, 50).map((client) => listClientSites(client.id)),
        );
        if (cancelled) return;
        const merged = new Map();
        for (const result of results) {
          if (result.status !== "fulfilled" || !Array.isArray(result.value)) continue;
          for (const site of result.value) {
            if (site && site.id != null && !merged.has(site.id)) merged.set(site.id, site);
          }
        }
        setFilterSites(Array.from(merged.values()));
        return;
      }
      try {
        const sites = await listClientSites(filters.clientId);
        if (!cancelled) setFilterSites(Array.isArray(sites) ? sites : []);
      } catch {
        if (!cancelled) setFilterSites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caps.isClient, filters.clientId, lookupToken, clients]);

  useEffect(() => {
    let cancelled = false;
    listRequisitions({
      clientId: caps.isClient ? undefined : filters.clientId || undefined,
      siteId: filters.siteId || undefined,
      size: 200,
    })
      .then((page) => {
        if (!cancelled) setRequisitions(Array.isArray(page.content) ? page.content : []);
      })
      .catch(() => {
        if (!cancelled) setRequisitions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [caps.isClient, filters.clientId, filters.siteId, lookupToken]);

  return { clients, company, categories, workers, filterSites, requisitions };
}

export default function DeploymentsPanel({ session: passedSession, onChanged } = {}) {
  const session = passedSession || getAuthSession();
  const caps = useMemo(() => deploymentCapabilities(session), [session]);

  const [tab, setTab] = useState("deployments");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const size = 20;
  const [pageInfo, setPageInfo] = useState({ totalPages: 0, totalElements: 0, first: true, last: true });
  const [reloadToken, setReloadToken] = useState(0);
  const [lookupToken, setLookupToken] = useState(0);

  const [filters, setFilters] = useState({
    clientId: "",
    siteId: "",
    workerId: "",
    requisitionId: "",
    status: "",
  });

  const { clients, company, categories, workers, filterSites, requisitions } = useLookups(caps, filters, lookupToken);

  const [flash, showFlash] = useFlash();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [transferId, setTransferId] = useState(null);
  const [releaseId, setReleaseId] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listDeployments({
        clientId: caps.isClient ? undefined : filters.clientId || undefined,
        siteId: filters.siteId || undefined,
        workerId: filters.workerId || undefined,
        requisitionId: filters.requisitionId || undefined,
        status: filters.status || undefined,
        page,
        size,
        sort: ["startDate,DESC"],
      });
      setItems(result.content);
      setPageInfo({
        totalPages: result.totalPages,
        totalElements: result.totalElements,
        first: result.first,
        last: result.last,
      });
    } catch (err) {
      setError(errorMessage(err, "Deployments could not be loaded."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [caps.isClient, filters, page]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load, reloadToken]);

  function reload(message) {
    setReloadToken((token) => token + 1);
    setLookupToken((token) => token + 1);
    if (message) showFlash("success", message);
    if (typeof onChanged === "function") onChanged();
  }

  function updateFilter(key, value) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "clientId") {
        next.siteId = "";
        next.requisitionId = "";
      }
      if (key === "siteId") next.requisitionId = "";
      return next;
    });
    setPage(0);
  }

  function resetFilters() {
    setFilters({ clientId: "", siteId: "", workerId: "", requisitionId: "", status: "" });
    setPage(0);
  }

  const hasFilters = Object.values(filters).some(Boolean);

  if (!caps.canRead) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Deployment access not granted"
        message="Your account does not have the DEPLOYMENT_READ permission. Ask an administrator to review your role."
      />
    );
  }

  return (
    <div className="depPanel">
      <SectionHead
        title="Deployments"
        description="Post workers to client sites, transfer or release them, and review site rosters."
        action={caps.canManage ? (
          <button type="button" className="primaryButton cmBtn" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Deploy worker
          </button>
        ) : null}
      />

      <div className="cmTabs depTabs" role="tablist" aria-label="Deployment sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "deployments"}
          className={tab === "deployments" ? "cmTab cmTabActive" : "cmTab"}
          onClick={() => setTab("deployments")}
        >
          <UsersRound size={14} /> Deployments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "roster"}
          className={tab === "roster" ? "cmTab cmTabActive" : "cmTab"}
          onClick={() => setTab("roster")}
        >
          <CalendarDays size={14} /> Site roster
        </button>
      </div>

      <FlashBanner flash={flash} />

      {tab === "deployments" ? (
        <>
          <div className="cmToolbar depToolbar">
            {!caps.isClient && (
              <label className="cmSelect">
                <Building2 size={14} />
                <select
                  value={filters.clientId}
                  onChange={(event) => updateFilter("clientId", event.target.value)}
                  aria-label="Filter by client"
                >
                  <option value="">All clients</option>
                  {clients.map((entry) => (
                    <option key={entry.id} value={entry.id}>{clientLabel(entry)}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="cmSelect">
              <Filter size={14} />
              <select
                value={filters.siteId}
                onChange={(event) => updateFilter("siteId", event.target.value)}
                aria-label="Filter by site"
              >
                <option value="">All sites</option>
                {filterSites.map((entry) => (
                  <option key={entry.id} value={entry.id}>{siteLabel(entry)}</option>
                ))}
              </select>
            </label>

            {!caps.isClient && (
              <label className="cmSelect">
                <UsersRound size={14} />
                <select
                  value={filters.workerId}
                  onChange={(event) => updateFilter("workerId", event.target.value)}
                  aria-label="Filter by worker"
                >
                  <option value="">All workers</option>
                  {workers.map((entry) => (
                    <option key={entry.id} value={entry.id}>{workerLabel(entry)}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="cmSelect">
              <History size={14} />
              <select
                value={filters.requisitionId}
                onChange={(event) => updateFilter("requisitionId", event.target.value)}
                aria-label="Filter by requisition"
              >
                <option value="">
                  {requisitions.length === 0 ? "No requisitions available" : "All requisitions"}
                </option>
                {requisitions.map((entry) => (
                  <option key={entry.id} value={entry.id}>{requisitionLabel(entry)}</option>
                ))}
              </select>
            </label>

            <label className="cmSelect">
              <Filter size={14} />
              <select
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
                aria-label="Filter by deployment status"
              >
                <option value="">All statuses</option>
                {DEPLOYMENT_STATUSES.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </label>

            {hasFilters && (
              <button type="button" className="secondaryButton cmBtn" onClick={resetFilters}>
                Clear filters
              </button>
            )}

            <button type="button" className="secondaryButton cmBtn" onClick={() => reload()} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {loading ? (
            <LoadingState label="Loading deployments." />
          ) : error ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No deployments found"
              message={hasFilters ? "No deployment records match the selected filters." : "Deploy a worker to a client site to get started."}
            />
          ) : (
            <>
              <div className="cmTableWrap depTableWrap">
                <table className="cmTable">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Client</th>
                      <th>Site</th>
                      <th>Category</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                      <th className="cmColCenter">Active today</th>
                      <th className="cmColActions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((deployment) => (
                      <tr key={deployment.id}>
                        <td>
                          <strong>{deployment.workerName || "—"}</strong>
                          <div className="cmMuted">{deployment.employeeCode || "—"}</div>
                        </td>
                        <td>{deployment.clientName || "—"}</td>
                        <td>{deployment.siteCode || deployment.siteName || "—"}</td>
                        <td>{deployment.categoryName || "—"}</td>
                        <td>{formatDate(deployment.startDate)}</td>
                        <td>{deployment.endDate ? formatDate(deployment.endDate) : "Open"}</td>
                        <td><StatusChip status={deployment.status} /></td>
                        <td className="cmColCenter">
                          <Chip tone={deployment.inForceToday ? "success" : "neutral"}>
                            {deployment.inForceToday ? "Yes" : "No"}
                          </Chip>
                        </td>
                        <td className="cmColActions">
                          <div className="cmRowActions">
                            <button
                              type="button"
                              className="cmIconButton"
                              title="View deployment"
                              aria-label="View deployment"
                              onClick={() => setDetailId(deployment.id)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              className="cmIconButton"
                              title="Worker deployment history"
                              aria-label="Worker deployment history"
                              onClick={() => setHistoryTarget({
                                workerId: deployment.workerId,
                                workerName: deployment.workerName,
                              })}
                            >
                              <History size={15} />
                            </button>
                            {caps.canManage && deployment.status === "ACTIVE" && (
                              <button
                                type="button"
                                className="cmIconButton"
                                title="Transfer worker"
                                aria-label="Transfer worker"
                                onClick={() => setTransferId(deployment.id)}
                              >
                                <ArrowRightLeft size={15} />
                              </button>
                            )}
                            {caps.canManage && deployment.status === "ACTIVE" && (
                              <button
                                type="button"
                                className="cmIconButton cmIconDanger"
                                title="Release worker"
                                aria-label="Release worker"
                                onClick={() => setReleaseId(deployment.id)}
                              >
                                <UserMinus size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pageInfo.totalPages > 1 && (
                <div className="cmPagination">
                  <button
                    type="button"
                    className="secondaryButton cmBtn"
                    disabled={page === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    Previous
                  </button>
                  <span className="cmMuted">
                    Page {page + 1} of {pageInfo.totalPages} · {pageInfo.totalElements} deployments
                  </span>
                  <button
                    type="button"
                    className="secondaryButton cmBtn"
                    disabled={pageInfo.last}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <SiteRosterSection
          caps={caps}
          company={company}
          clients={clients}
          filterSites={filterSites}
          reloadToken={reloadToken}
        />
      )}

      {createOpen && (
        <DeploymentFormModal
          caps={caps}
          clients={clients}
          company={company}
          categories={categories}
          workers={workers}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            reload("Worker deployed successfully.");
          }}
        />
      )}

      {detailId && (
        <DeploymentDetailDrawer
          deploymentId={detailId}
          caps={caps}
          onClose={() => setDetailId(null)}
          onHistory={(target) => {
            setDetailId(null);
            setHistoryTarget(target);
          }}
          onTransfer={(id) => {
            setDetailId(null);
            setTransferId(id);
          }}
          onRelease={(id) => {
            setDetailId(null);
            setReleaseId(id);
          }}
        />
      )}

      {transferId && (
        <TransferDeploymentModal
          deploymentId={transferId}
          caps={caps}
          clients={clients}
          categories={categories}
          onClose={() => setTransferId(null)}
          onTransferred={() => {
            setTransferId(null);
            reload("Worker transferred successfully.");
          }}
        />
      )}

      {releaseId && (
        <ReleaseDeploymentModal
          deploymentId={releaseId}
          onClose={() => setReleaseId(null)}
          onReleased={() => {
            setReleaseId(null);
            reload("Worker released successfully.");
          }}
        />
      )}

      {historyTarget && (
        <WorkerHistoryModal
          workerId={historyTarget.workerId}
          workerName={historyTarget.workerName}
          caps={caps}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

function DeploymentDetailDrawer({ deploymentId, caps, onClose, onHistory, onTransfer, onRelease }) {
  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getDeployment(deploymentId);
        if (!cancelled) setDeployment(data);
      } catch (err) {
        if (!cancelled) {
          setDeployment(null);
          setError(errorMessage(err, "The deployment details could not be loaded."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deploymentId, reloadToken]);

  const isActive = deployment && deployment.status === "ACTIVE";
  const footer = deployment ? (
    <div className="depDrawerFooter">
      <button type="button" className="secondaryButton cmBtn" onClick={onClose}>Close</button>
      <button
        type="button"
        className="secondaryButton cmBtn"
        onClick={() => onHistory({ workerId: deployment.workerId, workerName: deployment.workerName })}
      >
        <History size={14} /> History
      </button>
      {caps.canManage && isActive && (
        <button type="button" className="secondaryButton cmBtn" onClick={() => onTransfer(deployment.id)}>
          <ArrowRightLeft size={14} /> Transfer
        </button>
      )}
      {caps.canManage && isActive && (
        <button type="button" className="cmDangerButton cmBtn" onClick={() => onRelease(deployment.id)}>
          <UserMinus size={14} /> Release
        </button>
      )}
    </div>
  ) : null;

  return (
    <Drawer
      title={deployment ? deployment.displayLabel || `Deployment #${deployment.id}` : "Deployment details"}
      description={deployment ? `${deployment.workerName || "Worker"} · ${deployment.siteName || deployment.siteCode || "Site"}` : null}
      onClose={onClose}
      size="lg"
      footer={footer}
    >
      {loading ? (
        <LoadingState label="Loading deployment details." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((token) => token + 1)} />
      ) : deployment ? (
        <>
          <dl className="cmDetailGrid depDetailGrid">
            <DetailRow label="Deployment ID">{deployment.id}</DetailRow>
            <DetailRow label="Status"><StatusChip status={deployment.status} /></DetailRow>
            <DetailRow label="Worker">{deployment.workerName || "—"}</DetailRow>
            <DetailRow label="Employee code">{deployment.employeeCode || "—"}</DetailRow>
            <DetailRow label="Client">{deployment.clientName || "—"}</DetailRow>
            <DetailRow label="Site">{deployment.siteName ? `${deployment.siteName}${deployment.siteCode ? ` (${deployment.siteCode})` : ""}` : "—"}</DetailRow>
            <DetailRow label="Category">{deployment.categoryName || "—"}</DetailRow>
            <DetailRow label="Requisition">{deployment.requisitionNumber || "—"}</DetailRow>
            <DetailRow label="Start date">{formatDate(deployment.startDate)}</DetailRow>
            <DetailRow label="End date">{deployment.endDate ? formatDate(deployment.endDate) : "Open"}</DetailRow>
            <DetailRow label="Shift">{deploymentShiftLabel(deployment.shift)}</DetailRow>
            <DetailRow label="Active today">{deployment.inForceToday ? "Yes" : "No"}</DetailRow>
            <DetailRow label="Days served">{deployment.daysServed ?? "—"}</DetailRow>
            <DetailRow label="Released on">{deployment.releasedOn ? formatDate(deployment.releasedOn) : "—"}</DetailRow>
            <DetailRow label="Release reason" full>{deployment.releaseReason || "—"}</DetailRow>
            <DetailRow label="Notes" full>{deployment.notes || "—"}</DetailRow>
            <DetailRow label="Created" full>{deployment.createdAt ? formatDateTime(deployment.createdAt) : "—"}</DetailRow>
          </dl>

          {caps.canManage && !caps.isClient && (
            <section className="depFinanceSection">
              <h3>Commercials</h3>
              <dl className="cmDetailGrid depDetailGrid">
                <DetailRow label="Monthly wage">{deployment.monthlyWage ?? "—"}</DetailRow>
                <DetailRow label="Billing rate">{deployment.billingRate ?? "—"}</DetailRow>
                <DetailRow label="Gross margin / month">{deployment.grossMarginPerMonth ?? "—"}</DetailRow>
                <DetailRow label="Billing below wage">{deployment.billingBelowWage ? "Yes" : "No"}</DetailRow>
              </dl>
            </section>
          )}
        </>
      ) : null}
    </Drawer>
  );
}

function DeploymentFormModal({ caps, clients, company, categories, workers, onClose, onCreated }) {
  const clientMode = caps.isClient;
  const [clientId, setClientId] = useState(clientMode && company && company.id != null ? String(company.id) : "");
  const [siteId, setSiteId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [requisitionId, setRequisitionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState(todayDateString());
  const [endDate, setEndDate] = useState("");
  const [shift, setShift] = useState("DAY");
  const [notes, setNotes] = useState("");
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [requisitionsLoading, setRequisitionsLoading] = useState(false);
  const [requisitionsError, setRequisitionsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});

  useEffect(() => {
    (async () => {
      if (!clientMode && !clientId && clients.length > 0) {
        setClientId(String(clients[0].id));
      }
    })();
  }, [clientMode, clientId, clients]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clientId) {
        setSites([]);
        setSitesError("");
        setSitesLoading(false);
        return;
      }
      setSitesLoading(true);
      setSitesError("");
      try {
        const data = clientMode ? await listMySites(clientId) : await listClientSites(clientId);
        if (!cancelled) setSites(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setSites([]);
          setSitesError(errorMessage(err, "Sites could not be loaded for this client."));
        }
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientMode, clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRequisitionsLoading(true);
      setRequisitionsError("");
      try {
        const page = await listRequisitions({ size: 200 });
        if (!cancelled) setRequisitions(Array.isArray(page.content) ? page.content : []);
      } catch (err) {
        if (!cancelled) {
          setRequisitions([]);
          setRequisitionsError(errorMessage(err, "Requisitions could not be loaded."));
        }
      } finally {
        if (!cancelled) setRequisitionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCategory = categories.find((entry) => String(entry.id) === String(categoryId));
  const selectedRequisition = requisitions.find((entry) => String(entry.id) === String(requisitionId));
  const securityRequired = selectedCategory
    ? isSecurityCategoryName(`${selectedCategory.name || ""} ${selectedCategory.code || ""}`)
    : isSecurityCategoryName(selectedRequisition?.categoryName || "");

  function changeClient(value) {
    setClientId(value);
    setSiteId("");
    setRequisitionId("");
    setFields((current) => ({ ...current, clientId: undefined, siteId: undefined }));
  }

  async function ensureWorker() {
    const fromList = workers.find((entry) => String(entry.id) === String(workerId));
    if (fromList) return fromList;
    return getWorker(workerId);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextFields = {};
    if (!siteId) nextFields.siteId = "Select a site.";
    if (!workerId) nextFields.workerId = "Select a worker.";
    if (!startDate) nextFields.startDate = "Start date is required.";
    if (startDate && endDate && endDate < startDate) nextFields.endDate = "End date cannot be before the start date.";
    if (Object.keys(nextFields).length) {
      setFields(nextFields);
      return;
    }

    setBusy(true);
    setFields({});
    try {
      const worker = securityRequired ? await ensureWorker() : null;
      if (
        securityRequired &&
        worker &&
        worker.clearedForSecurityWork !== true &&
        !acceptablePoliceVerification(worker.policeVerificationStatus)
      ) {
        setFields({ workerId: "This worker's police verification is not cleared for a security deployment." });
        setBusy(false);
        return;
      }

      await createDeployment({
        workerId: Number(workerId),
        siteId: Number(siteId),
        requisitionId: requisitionId ? Number(requisitionId) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        startDate,
        endDate: endDate || undefined,
        shift,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err, "The worker could not be deployed."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Deploy a worker"
      description="Assign an approved worker to a client site. Financial rates are taken from the active rate card."
      onClose={onClose}
      wide
    >
      <form className="cmFormGrid depFormGrid" onSubmit={submit}>
        {error && <div className="cmNotice cmNotice-error depFormNotice" role="alert">{error}</div>}

        {!clientMode && (
          <Field label="Client" htmlFor="dep-client" required error={fields.clientId}>
            <select id="dep-client" value={clientId} onChange={(event) => changeClient(event.target.value)} required>
              <option value="">Select a client</option>
              {clients.map((entry) => (
                <option key={entry.id} value={entry.id}>{clientLabel(entry)}</option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label="Site"
          htmlFor="dep-site"
          required
          error={fields.siteId}
          hint={
            sitesLoading
              ? "Loading sites…"
              : sitesError
                ? sitesError
                : !clientId
                  ? "Select a client first."
                  : sites.length === 0
                    ? "No sites are available for this client."
                    : undefined
          }
        >
          <select
            id="dep-site"
            value={siteId}
            onChange={(event) => {
              setSiteId(event.target.value);
              setRequisitionId("");
            }}
            disabled={!clientId}
            required
          >
            <option value="">Select a site</option>
            {sites.map((entry) => (
              <option key={entry.id} value={entry.id}>{siteLabel(entry)}</option>
            ))}
          </select>
        </Field>

        <Field label="Worker" htmlFor="dep-worker" required error={fields.workerId}>
          <select id="dep-worker" value={workerId} onChange={(event) => setWorkerId(event.target.value)} required>
            <option value="">Select a worker</option>
            {workers.map((entry) => (
              <option key={entry.id} value={entry.id}>{workerLabel(entry)}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Requisition"
          htmlFor="dep-requisition"
          error={fields.requisitionId}
          hint={
            requisitionsLoading
              ? "Loading requisitions…"
              : requisitionsError
                ? requisitionsError
                : requisitions.length === 0
                    ? "No requisitions are available. You can still deploy without one."
                  : "Optional. Links this deployment to a client requisition."
          }
        >
          <select id="dep-requisition" value={requisitionId} onChange={(event) => setRequisitionId(event.target.value)}>
            <option value="">No requisition</option>
            {requisitions.map((entry) => (
              <option key={entry.id} value={entry.id}>{requisitionLabel(entry)}</option>
            ))}
          </select>
        </Field>

        <Field label="Manpower category" htmlFor="dep-category" error={fields.categoryId}>
          <select id="dep-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Use requisition / rate card default</option>
            {categories.map((entry) => (
              <option key={entry.id} value={entry.id}>{categoryLabel(entry)}</option>
            ))}
          </select>
        </Field>

        <Field label="Shift" htmlFor="dep-shift" error={fields.shift}>
          <select id="dep-shift" value={shift} onChange={(event) => setShift(event.target.value)}>
            {DEPLOYMENT_SHIFTS.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Start date" htmlFor="dep-start" required error={fields.startDate}>
          <input id="dep-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </Field>

        <Field label="End date" htmlFor="dep-end" error={fields.endDate} hint="Optional. Leave blank for an open-ended deployment.">
          <input id="dep-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate || undefined} />
        </Field>

        <Field label="Notes" htmlFor="dep-notes" error={fields.notes}>
          <textarea id="dep-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        {securityRequired && (
          <div className="cmNotice cmNotice-warn depFormNotice">
            This category is treated as security work. The worker&apos;s police verification must be cleared before deployment.
          </div>
        )}

        <div className="depFormNotice">
          <div className="depDrawerFooter">
            <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primaryButton cmBtn" disabled={busy}>
              {busy ? "Deploying…" : "Deploy worker"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function TransferDeploymentModal({ deploymentId, caps, clients, categories, onClose, onTransferred }) {
  const [deployment, setDeployment] = useState(null);
  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [requisitionId, setRequisitionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shift, setShift] = useState("DAY");
  const [reason, setReason] = useState("");
  const [sites, setSites] = useState([]);
  const [sitesError, setSitesError] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [requisitionsError, setRequisitionsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getDeployment(deploymentId);
        if (cancelled) return;
        setDeployment(data);
        setClientId(data.clientId != null ? String(data.clientId) : "");
        setCategoryId(data.categoryId != null ? String(data.categoryId) : "");
        setShift(data.shift || "DAY");
        setEffectiveFrom(addDaysDateString(data.startDate, 1));
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "The deployment could not be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deploymentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clientId) {
        setSites([]);
        setSitesError("");
        return;
      }
      setSitesError("");
      try {
        const data = await listClientSites(clientId);
        if (!cancelled) setSites(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setSites([]);
          setSitesError(errorMessage(err, "Sites could not be loaded."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRequisitionsError("");
      try {
        const page = await listRequisitions({
          clientId: clientId || undefined,
          siteId: siteId || undefined,
          size: 200,
        });
        if (!cancelled) setRequisitions(Array.isArray(page.content) ? page.content : []);
      } catch (err) {
        if (!cancelled) {
          setRequisitions([]);
          setRequisitionsError(errorMessage(err, "Requisitions could not be loaded."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, siteId]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextFields = {};
    if (!siteId) nextFields.toSiteId = "Select the destination site.";
    if (deployment && siteId && String(siteId) === String(deployment.siteId)) {
      nextFields.toSiteId = "Select a site different from the current deployment site.";
    }
    if (!effectiveFrom) nextFields.effectiveFrom = "Effective date is required.";
    if (deployment && effectiveFrom && deployment.startDate && effectiveFrom <= deployment.startDate) {
      nextFields.effectiveFrom = "The effective date must be after the current deployment start date.";
    }
    if (!reason.trim()) nextFields.reason = "A reason is required for the transfer.";
    if (Object.keys(nextFields).length) {
      setFields(nextFields);
      return;
    }

    setBusy(true);
    setFields({});
    try {
      const selectedCategory = categories.find((entry) => String(entry.id) === String(categoryId));
      const selectedRequisition = requisitions.find((entry) => String(entry.id) === String(requisitionId));
      const effectiveCategoryName = selectedCategory
        ? `${selectedCategory.name || ""} ${selectedCategory.code || ""}`
        : selectedRequisition?.categoryName || deployment?.categoryName || "";
      if (deployment && isSecurityCategoryName(effectiveCategoryName)) {
        const worker = await getWorker(deployment.workerId);
        if (
          worker &&
          worker.clearedForSecurityWork !== true &&
          !acceptablePoliceVerification(worker.policeVerificationStatus)
        ) {
          setFields({ workerId: "This worker's police verification is not cleared for a security deployment." });
          setBusy(false);
          return;
        }
      }

      await transferDeployment(deploymentId, {
        toSiteId: Number(siteId),
        effectiveFrom,
        requisitionId: requisitionId ? Number(requisitionId) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        shift,
        reason: reason.trim(),
      });
      onTransferred();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err, "The worker could not be transferred."));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Transfer worker"
      description={deployment ? `${deployment.workerName || "Worker"} is currently deployed at ${deployment.siteName || deployment.siteCode || "a site"}.` : "Move a worker to another site."}
      onClose={onClose}
      wide
    >
      {loading ? (
        <LoadingState label="Loading deployment." />
      ) : error && !deployment ? (
        <ErrorState message={error} />
      ) : (
        <form className="cmFormGrid depFormGrid" onSubmit={submit}>
          {error && <div className="cmNotice cmNotice-error depFormNotice" role="alert">{error}</div>}

          <div className="depFormSummary depFormNotice">
            <span><strong>Worker:</strong> {deployment?.workerName || "—"}</span>
            <span><strong>Current site:</strong> {deployment?.siteName || deployment?.siteCode || "—"}</span>
            <span><strong>Current start:</strong> {deployment?.startDate ? formatDate(deployment.startDate) : "—"}</span>
          </div>

          {!caps.isClient && (
            <Field label="Destination client" htmlFor="transfer-client" required>
              <select
                id="transfer-client"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setSiteId("");
                  setRequisitionId("");
                }}
                required
              >
                <option value="">Select a client</option>
                {clients.map((entry) => (
                  <option key={entry.id} value={entry.id}>{clientLabel(entry)}</option>
                ))}
              </select>
            </Field>
          )}

          <Field
            label="Destination site"
            htmlFor="transfer-site"
            required
            error={fields.toSiteId}
            hint={
              sitesError
                ? sitesError
                : sites.length === 0
                  ? "No sites are available for this client."
                  : undefined
            }
          >
            <select
              id="transfer-site"
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
                setRequisitionId("");
              }}
              disabled={!clientId}
              required
            >
              <option value="">Select a site</option>
              {sites.map((entry) => (
                <option key={entry.id} value={entry.id}>{siteLabel(entry)}</option>
              ))}
            </select>
          </Field>

          <Field label="Effective from" htmlFor="transfer-effective" required error={fields.effectiveFrom} hint="Must be after the current deployment start date.">
            <input
              id="transfer-effective"
              type="date"
              value={effectiveFrom}
              min={deployment?.startDate ? addDaysDateString(deployment.startDate, 1) : undefined}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              required
            />
          </Field>

          <Field
            label="Requisition"
            htmlFor="transfer-requisition"
            error={fields.requisitionId}
            hint={requisitionsError || (requisitions.length === 0 ? "No requisitions match this client/site." : undefined)}
          >
            <select id="transfer-requisition" value={requisitionId} onChange={(event) => setRequisitionId(event.target.value)}>
              <option value="">No requisition</option>
              {requisitions.map((entry) => (
                <option key={entry.id} value={entry.id}>{requisitionLabel(entry)}</option>
              ))}
            </select>
          </Field>

          <Field label="Manpower category" htmlFor="transfer-category" error={fields.categoryId}>
            <select id="transfer-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Keep current category</option>
              {categories.map((entry) => (
                <option key={entry.id} value={entry.id}>{categoryLabel(entry)}</option>
              ))}
            </select>
          </Field>

          <Field label="Shift" htmlFor="transfer-shift" error={fields.shift}>
            <select id="transfer-shift" value={shift} onChange={(event) => setShift(event.target.value)}>
              {DEPLOYMENT_SHIFTS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Reason" htmlFor="transfer-reason" required error={fields.reason}>
            <textarea id="transfer-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} required />
          </Field>

          <div className="depFormNotice">
            <div className="depDrawerFooter">
              <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="primaryButton cmBtn" disabled={busy}>
                {busy ? "Transferring…" : "Transfer worker"}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ReleaseDeploymentModal({ deploymentId, onClose, onReleased }) {
  const [deployment, setDeployment] = useState(null);
  const [status, setStatus] = useState("RELEASED");
  const [endedOn, setEndedOn] = useState(todayDateString());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getDeployment(deploymentId);
        if (cancelled) return;
        setDeployment(data);
        if (data.startDate && data.startDate > todayDateString()) setEndedOn(data.startDate);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "The deployment could not be loaded."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deploymentId]);

  function prepare(event) {
    event.preventDefault();
    setError("");
    const nextFields = {};
    if (!endedOn) nextFields.endedOn = "Release date is required.";
    if (deployment && endedOn && deployment.startDate && endedOn < deployment.startDate) {
      nextFields.endedOn = "Release date cannot be before the deployment start date.";
    }
    if (!reason.trim()) nextFields.reason = "A reason is required.";
    if (Object.keys(nextFields).length) {
      setFields(nextFields);
      return;
    }
    setFields({});
    setConfirming(true);
  }

  async function release() {
    setBusy(true);
    setError("");
    try {
      await endDeployment(deploymentId, {
        status,
        endedOn,
        reason: reason.trim(),
      });
      onReleased();
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err, "The deployment could not be ended."));
      setConfirming(false);
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        title="Release worker"
        description={deployment ? `${deployment.workerName || "Worker"} · ${deployment.siteName || deployment.siteCode || "Site"}` : "End a deployment."}
        onClose={onClose}
      >
        {loading ? (
          <LoadingState label="Loading deployment." />
        ) : error && !deployment ? (
          <ErrorState message={error} />
        ) : (
          <form className="cmFormGrid depFormGrid" onSubmit={prepare}>
            {error && <div className="cmNotice cmNotice-error depFormNotice" role="alert">{error}</div>}

            <div className="depFormSummary depFormNotice">
              <span><strong>Worker:</strong> {deployment?.workerName || "—"}</span>
              <span><strong>Site:</strong> {deployment?.siteName || deployment?.siteCode || "—"}</span>
              <span><strong>Started:</strong> {deployment?.startDate ? formatDate(deployment.startDate) : "—"}</span>
            </div>

            <Field label="End status" htmlFor="release-status" required>
              <select id="release-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="RELEASED">Released</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </Field>

            <Field label="Release date" htmlFor="release-date" required error={fields.endedOn}>
              <input
                id="release-date"
                type="date"
                value={endedOn}
                min={deployment?.startDate || undefined}
                onChange={(event) => setEndedOn(event.target.value)}
                required
              />
            </Field>

            <Field label="Reason" htmlFor="release-reason" required error={fields.reason}>
              <textarea id="release-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} required />
            </Field>

            <div className="depFormNotice">
              <div className="depDrawerFooter">
                <button type="button" className="secondaryButton cmBtn" onClick={onClose} disabled={busy}>Cancel</button>
                <button type="submit" className="cmDangerButton cmBtn" disabled={busy}>Review release</button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {confirming && (
        <ConfirmDialog
          title="Release this worker?"
          message={`This will mark the deployment as ${deploymentStatusLabel(status)} on ${formatDate(endedOn)} and free the worker for redeployment.`}
          confirmLabel="Release worker"
          busy={busy}
          onConfirm={release}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function WorkerHistoryModal({ workerId, workerName, caps, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await listWorkerDeploymentHistory(workerId);
        if (!cancelled) {
          const sorted = [...data].sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));
          setItems(sorted);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(errorMessage(err, "The worker's deployment history could not be loaded."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerId, reloadToken]);

  return (
    <Modal
      title="Worker deployment history"
      description={workerName || `Worker #${workerId}`}
      onClose={onClose}
      wide
    >
      {loading ? (
        <LoadingState label="Loading deployment history." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((token) => token + 1)} />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="No deployments yet" message="This worker has not been deployed to any site." />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Client</th>
                <th>Site</th>
                <th>Category</th>
                <th>Start</th>
                <th>End</th>
                <th>Shift</th>
                <th>Status</th>
                <th className="cmColCenter">Days</th>
                {caps.canManage && !caps.isClient && <th>Billing</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.clientName || "—"}</td>
                  <td>{entry.siteName ? `${entry.siteName}${entry.siteCode ? ` (${entry.siteCode})` : ""}` : entry.siteCode || "—"}</td>
                  <td>{entry.categoryName || "—"}</td>
                  <td>{formatDate(entry.startDate)}</td>
                  <td>{entry.endDate ? formatDate(entry.endDate) : "Open"}</td>
                  <td>{deploymentShiftLabel(entry.shift)}</td>
                  <td><StatusChip status={entry.status} /></td>
                  <td className="cmColCenter">{entry.daysServed ?? "—"}</td>
                  {caps.canManage && !caps.isClient && <td>{entry.billingRate ?? "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function SiteRosterSection({ caps, company, clients, filterSites, reloadToken }) {
  const [clientId, setClientId] = useState(caps.isClient && company && company.id != null ? String(company.id) : "");
  const [siteId, setSiteId] = useState("");
  const [onDate, setOnDate] = useState(todayDateString());
  const [sites, setSites] = useState(Array.isArray(filterSites) ? filterSites : []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (caps.isClient) {
        setSites(Array.isArray(filterSites) ? filterSites : []);
        return;
      }
      if (!clientId) {
        setSites([]);
        return;
      }
      try {
        const data = await listClientSites(clientId);
        if (!cancelled) setSites(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caps.isClient, clientId, filterSites]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!siteId) {
        setItems([]);
        setError("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await listSiteRoster(siteId, onDate || undefined);
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(errorMessage(err, "The site roster could not be loaded."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, onDate, reload, reloadToken]);

  return (
    <div className="depRoster">
      <div className="cmToolbar depToolbar">
        {!caps.isClient && (
          <label className="cmSelect">
            <Building2 size={14} />
            <select
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setSiteId("");
              }}
              aria-label="Select client for roster"
            >
              <option value="">Select a client</option>
              {clients.map((entry) => (
                <option key={entry.id} value={entry.id}>{clientLabel(entry)}</option>
              ))}
            </select>
          </label>
        )}

        <label className="cmSelect">
          <Building2 size={14} />
          <select
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            aria-label="Select site for roster"
            disabled={!caps.isClient && !clientId}
          >
            <option value="">Select a site</option>
            {sites.map((entry) => (
              <option key={entry.id} value={entry.id}>{siteLabel(entry)}</option>
            ))}
          </select>
        </label>

        <label className="cmSelect">
          <CalendarDays size={14} />
          <input
            type="date"
            value={onDate}
            onChange={(event) => setOnDate(event.target.value)}
            aria-label="Roster date"
          />
        </label>

        <button type="button" className="secondaryButton cmBtn" onClick={() => setReload((value) => value + 1)} disabled={loading || !siteId}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {!siteId ? (
        <EmptyState
          icon={CalendarDays}
          title="Select a site"
          message="Choose a client and site to see which workers were deployed on a given date."
        />
      ) : loading ? (
        <LoadingState label="Loading site roster." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No workers at this site"
          message={`No deployments were active at this site on ${formatDate(onDate)}.`}
        />
      ) : (
        <div className="cmTableWrap depTableWrap">
          <table className="cmTable">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Employee code</th>
                <th>Site</th>
                <th>Category</th>
                <th>Shift</th>
                <th>Start</th>
                <th>End</th>
                <th>Police verification</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.workerName || "—"}</td>
                  <td>{entry.employeeCode || "—"}</td>
                  <td>{entry.siteName ? `${entry.siteName}${entry.siteCode ? ` (${entry.siteCode})` : ""}` : entry.siteCode || "—"}</td>
                  <td>{entry.categoryName || "—"}</td>
                  <td>{deploymentShiftLabel(entry.shift)}</td>
                  <td>{formatDate(entry.startDate)}</td>
                  <td>{entry.endDate ? formatDate(entry.endDate) : "Open"}</td>
                  <td><PoliceChip verified={entry.policeVerified} /></td>
                  <td><StatusChip status={entry.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cmMuted" style={{ padding: "8px 2px" }}>
            {items.length} worker{items.length === 1 ? "" : "s"} at this site on {formatDate(onDate)}.
          </div>
        </div>
      )}
    </div>
  );
}
