"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Filter,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  FlashBanner,
  LoadingState,
  Modal,
  SectionHead,
  useFlash,
} from "./admin-ui";
import { getAuthSession, hasPermission, hasRole } from "@/lib/auth";
import { listClients } from "@/lib/adminApi";
import { getMyClient, listMySites } from "@/lib/clientApi";
import {
  attendanceStatusLabel,
  attendanceStatusTone,
  generateAttendanceSheet,
  listAttendanceSheets,
  approveAttendanceSheet,
  lockAttendanceSheet,
  submitAttendanceSheet,
  unlockAttendanceSheet,
} from "@/lib/attendanceApi";

const PAGE_SIZE = 20;
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Date(2024, index, 1).toLocaleString(undefined, { month: "long" }),
}));

function todayParts() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    year: String(now.getFullYear()),
  };
}

function makeStatusSet(roles) {
  return new Set((roles || []).map((role) => String(role)));
}

function useAttendancePermissions(session) {
  return useMemo(() => {
    const user = (session && session.user) || {};
    const roles = makeStatusSet(Array.isArray(user.roles) ? user.roles : []);
    const isClient = roles.has("CLIENT");
    const canList =
      isClient ||
      roles.has("SUPER_ADMIN") ||
      roles.has("ADMIN") ||
      roles.has("MANAGER") ||
      roles.has("HR") ||
      roles.has("HR_RECRUITER") ||
      roles.has("HR_MANAGER") ||
      roles.has("OPERATOR") ||
      roles.has("OPERATIONS") ||
      roles.has("OPERATIONS_MANAGER") ||
      roles.has("SUPERVISOR") ||
      roles.has("SITE_SUPERVISOR") ||
      roles.has("ACCOUNTS") ||
      roles.has("ACCOUNTANT");
    const canGenerate =
      roles.has("SUPER_ADMIN") ||
      roles.has("ADMIN") ||
      roles.has("MANAGER") ||
      roles.has("HR") ||
      roles.has("HR_RECRUITER") ||
      roles.has("HR_MANAGER") ||
      roles.has("OPERATOR") ||
      roles.has("OPERATIONS") ||
      roles.has("OPERATIONS_MANAGER") ||
      roles.has("SUPERVISOR") ||
      roles.has("SITE_SUPERVISOR");
    const canSubmit = canGenerate || isClient;
    const canApprove = roles.has("SUPER_ADMIN") || roles.has("ADMIN") || roles.has("MANAGER") || isClient;
    const canLock = roles.has("SUPER_ADMIN") || roles.has("ADMIN") || roles.has("MANAGER") || roles.has("ACCOUNTS") || roles.has("ACCOUNTANT");
    const canViewFinancials =
      hasPermission(session, "PAYROLL_READ") ||
      hasPermission(session, "PAYROLL_MANAGE") ||
      hasPermission(session, "ATTENDANCE_READ") ||
      hasPermission(session, "ATTENDANCE_MANAGE");

    return {
      isClient,
      canList,
      canGenerate,
      canSubmit,
      canApprove,
      canLock,
      canViewFinancials,
      roles,
    };
  }, [session]);
}

function StatusChip({ status }) {
  return <Chip tone={attendanceStatusTone(status)}>{attendanceStatusLabel(status)}</Chip>;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function AttendancePanel({ session: passedSession, isClient = false } = {}) {
  const session = passedSession || getAuthSession();
  const perms = useAttendancePermissions(session);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(perms.canList));
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [company, setCompany] = useState(null);
  const [filters, setFilters] = useState({ clientId: "", siteId: "", status: "", month: "", year: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [busyActionId, setBusyActionId] = useState(null);
  const [flash, showFlash] = useFlash();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, index) => String(currentYear - index));

  useEffect(() => {
    let cancelled = false;
    if (!perms.canList) return undefined;

    (async () => {
      try {
        if (perms.isClient || isClient) {
          const client = await getMyClient();
          if (cancelled) return;
          setCompany(client);
          const clientSites = client && client.id != null ? await listMySites(client.id) : [];
          if (!cancelled) setSites(Array.isArray(clientSites) ? clientSites : []);
          return;
        }

        const data = await listClients({ size: 200 });
        if (!cancelled) setClients(Array.isArray(data && data.content) ? data.content : []);

        if (filters.clientId) {
          const siteData = await listMySites(filters.clientId);
          if (!cancelled) setSites(Array.isArray(siteData) ? siteData : []);
        } else {
          if (!cancelled) setSites([]);
        }
      } catch {
        if (!cancelled) {
          setClients([]);
          setSites([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filters.clientId, perms.canList, perms.isClient, isClient, reloadToken]);

  useEffect(() => {
    if (!perms.canList) return undefined;
    let cancelled = false;

    const refreshAttendance = async () => {
      const query = {
        page,
        size: PAGE_SIZE,
        sort: ["year,DESC", "month,DESC"],
        clientId: perms.isClient || isClient ? (company && company.id != null ? company.id : undefined) : filters.clientId || undefined,
        siteId: filters.siteId || undefined,
        status: filters.status || undefined,
        month: filters.month || undefined,
        year: filters.year || undefined,
      };

      setLoading(true);
      setError("");

      try {
        const payload = await listAttendanceSheets(query);
        if (cancelled) return;

        setItems(Array.isArray(payload && payload.content) ? payload.content : []);
        const totalPages = Number.isFinite(payload && payload.totalPages) ? payload.totalPages : 0;
        const totalElements = Number.isFinite(payload && payload.totalElements) ? payload.totalElements : 0;
        setPage(Number.isFinite(payload && payload.page) ? payload.page : page);
        setLoading(false);
        if (totalPages > 0 && page >= totalPages) {
          setPage(Math.max(0, totalPages - 1));
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Attendance sheets could not be loaded.");
        setItems([]);
        setLoading(false);
      }
    };

    void refreshAttendance();

    return () => {
      cancelled = true;
    };
  }, [company, filters.clientId, filters.month, filters.siteId, filters.status, filters.year, isClient, page, perms.canList, perms.isClient, reloadToken]);

  async function handleGenerate(event) {
    event.preventDefault();
    if (!createOpen) {
      setCreateOpen(true);
      return;
    }
    const payload = {
      siteId: document.getElementById("attendance-site-select")?.value || "",
      month: document.getElementById("attendance-month-select")?.value || "",
      year: document.getElementById("attendance-year-select")?.value || "",
    };
    if (!payload.siteId || !payload.month || !payload.year) {
      showFlash("error", "Please select a site, month and year before generating the attendance sheet.");
      return;
    }

    try {
      await generateAttendanceSheet({
        siteId: payload.siteId,
        month: payload.month,
        year: payload.year,
      });
      setCreateOpen(false);
      setReloadToken((value) => value + 1);
      showFlash("success", "Attendance sheet generated successfully.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The attendance sheet could not be generated.");
    }
  }

  async function handleAction(action, sheet) {
    const sheetId = sheet && (sheet.id || sheet.sheetId);
    if (!sheetId) return;
    setBusyActionId(sheetId);
    try {
      if (action === "submit") await submitAttendanceSheet(sheetId);
      else if (action === "approve") await approveAttendanceSheet(sheetId);
      else if (action === "lock") await lockAttendanceSheet(sheetId);
      else if (action === "unlock") await unlockAttendanceSheet(sheetId);
      setReloadToken((value) => value + 1);
      showFlash("success", "Attendance update complete.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "The attendance action could not be completed.");
    } finally {
      setBusyActionId(null);
    }
  }

  if (!perms.canList) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Attendance is not available"
        message="Your current role does not include access to attendance sheets."
      />
    );
  }

  return (
    <div className="cmWorkersPanel">
      <SectionHead
        title="Attendance"
        description="Monthly attendance sheets for client, site and workforce payroll review."
        action={
          perms.canGenerate ? (
            <div className="cmStatusRow">
              <button type="button" className="primaryButton cmBtn" onClick={() => setCreateOpen(true)}>
                <Plus size={15} /> Generate sheet
              </button>
            </div>
          ) : null
        }
      />

      <FlashBanner flash={flash} />

      <div className="cmToolbar">
        <div className="cmToolbarControls">
          <label className="cmSelect">
            <Filter size={14} />
            <select
              value={filters.status}
              aria-label="Filter attendance by status"
              onChange={(event) => { setPage(0); setFilters((previous) => ({ ...previous, status: event.target.value })); }}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="CLIENT_APPROVED">Client approved</option>
              <option value="LOCKED">Locked</option>
            </select>
          </label>
          {!perms.isClient && !isClient && (
            <label className="cmSelect">
              <Filter size={14} />
              <select
                value={filters.clientId}
                aria-label="Filter attendance by client"
                onChange={(event) => {
                  const clientId = event.target.value;
                  setPage(0);
                  setFilters((previous) => ({ ...previous, clientId, siteId: "" }));
                  if (!clientId) setSites([]);
                }}
              >
                <option value="">All clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.legalName || client.displayName || client.clientCode || `Client ${client.id}`}</option>
                ))}
              </select>
            </label>
          )}
          {(siteOptionsFor(filters.clientId, company, sites, perms.isClient || isClient) || []).length > 0 && (
            <label className="cmSelect">
              <Filter size={14} />
              <select
                value={filters.siteId}
                aria-label="Filter attendance by site"
                onChange={(event) => { setPage(0); setFilters((previous) => ({ ...previous, siteId: event.target.value })); }}
              >
                <option value="">All sites</option>
                {(siteOptionsFor(filters.clientId, company, sites, perms.isClient || isClient) || []).map((site) => (
                  <option key={site.id} value={site.id}>{site.siteName || site.name || `Site ${site.id}`}</option>
                ))}
              </select>
            </label>
          )}
          <label className="cmSelect">
            <Filter size={14} />
            <select
              value={filters.month}
              aria-label="Filter attendance by month"
              onChange={(event) => { setPage(0); setFilters((previous) => ({ ...previous, month: event.target.value })); }}
            >
              <option value="">All months</option>
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </label>
          <label className="cmSelect">
            <Filter size={14} />
            <select
              value={filters.year}
              aria-label="Filter attendance by year"
              onChange={(event) => { setPage(0); setFilters((previous) => ({ ...previous, year: event.target.value })); }}
            >
              <option value="">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <button type="button" className="secondaryButton cmBtn" onClick={() => { setPage(0); setFilters({ clientId: "", siteId: "", status: "", month: "", year: "" }); setReloadToken((value) => value + 1); }}>
            <RefreshCw size={15} /> Reset
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading attendance sheets..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
      ) : !items.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No attendance sheets found"
          message="There are no attendance records for this scope yet. Generate a new sheet to begin."
        />
      ) : (
        <div className="cmTableWrap">
          <table className="cmTable" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Month</th>
                <th>Site</th>
                <th>Status</th>
                {perms.canViewFinancials && <th>Gross</th>}
                {perms.canViewFinancials && <th>Net</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const rowId = item.id || item.sheetId;
                const status = attendanceStatusLabel(item.status);
                const isBusy = busyActionId === rowId;
                return (
                  <tr key={rowId}>
                    <td>{item.clientName || item.client?.legalName || item.client?.displayName || "—"}</td>
                    <td>{item.month ? `${item.month}/${item.year || ""}`.trim() : `${item.year || "—"}`}</td>
                    <td>{item.siteName || item.site?.siteName || item.site?.name || "—"}</td>
                    <td><StatusChip status={item.status} /></td>
                    {perms.canViewFinancials && (
                      <td>{item.totalGross != null ? `₹${Number(item.totalGross).toLocaleString("en-IN")}` : "—"}</td>
                    )}
                    {perms.canViewFinancials && (
                      <td>{item.totalNet != null ? `₹${Number(item.totalNet).toLocaleString("en-IN")}` : "—"}</td>
                    )}
                    <td>
                      <div className="cmStatusRow">
                        {perms.canSubmit && item.status === "DRAFT" && (
                          <button type="button" className="secondaryButton cmBtn" disabled={isBusy} onClick={() => handleAction("submit", item)}>
                            {isBusy ? "Working..." : "Submit"}
                          </button>
                        )}
                        {perms.canApprove && item.status === "SUBMITTED" && (
                          <button type="button" className="secondaryButton cmBtn" disabled={isBusy} onClick={() => handleAction("approve", item)}>
                            {isBusy ? "Working..." : "Approve"}
                          </button>
                        )}
                        {perms.canLock && item.status === "CLIENT_APPROVED" && (
                          <button type="button" className="secondaryButton cmBtn" disabled={isBusy} onClick={() => handleAction("lock", item)}>
                            {isBusy ? "Working..." : "Lock"}
                          </button>
                        )}
                        {perms.canLock && item.status === "LOCKED" && (
                          <button type="button" className="secondaryButton cmBtn" disabled={isBusy} onClick={() => handleAction("unlock", item)}>
                            {isBusy ? "Working..." : "Unlock"}
                          </button>
                        )}
                        {item.status && <span className="cmMutedText">{status}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <Modal
          title="Generate attendance sheet"
          description="Create a monthly attendance sheet from active deployments."
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button type="button" className="secondaryButton cmBtn" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="button" className="primaryButton cmBtn" onClick={handleGenerate}>Generate</button>
            </>
          }
        >
          <div className="cmFormGrid">
            <Field label="Site" htmlFor="attendance-site-select" required>
              <select id="attendance-site-select" defaultValue="">
                <option value="">Select site</option>
                {siteOptionsFor(filters.clientId, company, sites, perms.isClient || isClient).map((site) => (
                  <option key={site.id} value={site.id}>{site.siteName || site.name || `Site ${site.id}`}</option>
                ))}
              </select>
            </Field>
            <Field label="Month" htmlFor="attendance-month-select" required>
              <select id="attendance-month-select" defaultValue={todayParts().month}>
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Year" htmlFor="attendance-year-select" required>
              <select id="attendance-year-select" defaultValue={todayParts().year}>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function siteOptionsFor(clientId, company, sites, isClientScope) {
  if (isClientScope && company && company.id != null) return asArray(sites);
  if (clientId) return asArray(sites);
  return asArray(sites);
}
