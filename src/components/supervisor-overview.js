"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FilePlus2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { attendanceStatusLabel, rawAttendanceStatus, listAttendanceSheets } from "@/lib/attendanceApi";
import { humanize } from "@/lib/permission-modules";
import { Chip, EmptyState, ErrorState, LoadingState } from "@/app/admin/admin-ui";

const EMPTY_PAGE = { content: [], totalElements: 0 };

function accountStatus(status) {
  const key = String(status || "").toUpperCase();
  const tones = {
    ACTIVE: { label: "Active", tone: "success" },
    PENDING_APPROVAL: { label: "Pending approval", tone: "warn" },
    PENDING: { label: "Pending approval", tone: "warn" },
    DISABLED: { label: "Disabled", tone: "danger" },
    REJECTED: { label: "Rejected", tone: "danger" },
    BLOCKED: { label: "Blocked", tone: "danger" },
  };
  return tones[key] || { label: humanize(key) || "Unknown", tone: "neutral" };
}

function formatPeriod(item) {
  if (!item || !item.month) return String(item && item.year || "Period unavailable");
  const monthNumber = Number(item.month);
  const monthLabel = monthNumber >= 1 && monthNumber <= 12
    ? new Date(2024, monthNumber - 1, 1).toLocaleString(undefined, { month: "short" })
    : String(item.month);
  return `${monthLabel} ${item.year || ""}`.trim();
}

function statusClass(status) {
  return rawAttendanceStatus(status).toLowerCase().replace(/_/g, "-") || "unknown";
}

export default function SupervisorOverview({ user, roles, permissions, modules, onNavigate }) {
  const [attendance, setAttendance] = useState(EMPTY_PAGE);
  const [attendanceState, setAttendanceState] = useState("loading");
  const [attendanceError, setAttendanceError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
  );

  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Supervisor";
  const firstName = user.firstName || fullName.split(/\s+/)[0] || "there";
  const status = accountStatus(user.status);
  const draftCount = useMemo(
    () => attendance.content.filter((sheet) => rawAttendanceStatus(sheet.status) === "DRAFT").length,
    [attendance.content],
  );
  const submittedCount = useMemo(
    () => attendance.content.filter((sheet) => rawAttendanceStatus(sheet.status) === "SUBMITTED").length,
    [attendance.content],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAttendance() {
      setAttendanceState("loading");
      setAttendanceError("");
      try {
        const page = await listAttendanceSheets({ page: 0, size: 5, sort: ["year,DESC", "month,DESC"] });
        if (cancelled) return;
        setAttendance(page);
        setAttendanceState("ready");
      } catch (error) {
        if (cancelled) return;
        setAttendanceError(error instanceof Error ? error.message : "Attendance sheets could not be loaded.");
        setAttendanceState("error");
      }
    }

    void loadAttendance();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return (
    <div className="ssOverview">
      <section className="ssHero">
        <div className="ssHeroCopy">
          <span className="ssEyebrow">Supervisor workspace</span>
          <h1>Welcome back, {firstName}</h1>
          <p>Review site attendance, prepare monthly sheets and send completed records for client approval.</p>
        </div>
        <div className="ssHeroMeta">
          <Chip tone={status.tone}>{status.label}</Chip>
          <span>{today}</span>
          <small>{user.email || "Supervisor account"}</small>
        </div>
      </section>

      <section className="ssMetrics" aria-label="Supervisor attendance summary">
        <article className="ssMetric ssMetricBlue">
          <span className="ssMetricIcon"><CalendarDays size={18} /></span>
          <div><small>Attendance sheets</small><strong>{attendanceState === "ready" ? attendance.totalElements : "—"}</strong><span>Across your permitted scope</span></div>
        </article>
        <article className="ssMetric ssMetricAmber">
          <span className="ssMetricIcon"><FilePlus2 size={18} /></span>
          <div><small>Draft sheets</small><strong>{attendanceState === "ready" ? draftCount : "—"}</strong><span>In the latest five records</span></div>
        </article>
        <article className="ssMetric ssMetricGreen">
          <span className="ssMetricIcon"><Clock3 size={18} /></span>
          <div><small>Awaiting client review</small><strong>{attendanceState === "ready" ? submittedCount : "—"}</strong><span>In the latest five records</span></div>
        </article>
        <article className="ssMetric ssMetricViolet">
          <span className="ssMetricIcon"><KeyRound size={18} /></span>
          <div><small>Authorised modules</small><strong>{modules.length}</strong><span>{permissions.length} server-granted permissions</span></div>
        </article>
      </section>

      <div className="ssContentGrid">
        <section className="ssPanel ssAttendancePanel">
          <div className="ssPanelHead">
            <div>
              <span className="ssSectionKicker">Attendance</span>
              <h2>Recent attendance sheets</h2>
              <p>Latest monthly records available to your supervisor role.</p>
            </div>
            <div className="ssPanelActions">
              <button
                type="button"
                className="ssIconButton"
                aria-label="Refresh attendance sheets"
                title="Refresh attendance sheets"
                onClick={() => setRefreshToken((value) => value + 1)}
              >
                <RefreshCw size={15} />
              </button>
              <button type="button" className="ssTextAction" onClick={() => onNavigate("attendance")}>
                View all <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {attendanceState === "loading" ? (
            <LoadingState label="Loading attendance sheets..." />
          ) : attendanceState === "error" ? (
            <ErrorState message={attendanceError} onRetry={() => setRefreshToken((value) => value + 1)} />
          ) : attendance.content.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No attendance sheets yet"
              message="Generate a monthly sheet from active deployments when a site is ready for attendance tracking."
            />
          ) : (
            <div className="ssSheetList">
              {attendance.content.map((sheet) => {
                const id = sheet.id || sheet.sheetId;
                const statusValue = rawAttendanceStatus(sheet.status);
                return (
                  <article className="ssSheetRow" key={id || `${sheet.siteName}-${sheet.month}-${sheet.year}`}>
                    <span className="ssSheetIcon"><CalendarDays size={16} /></span>
                    <div className="ssSheetInfo">
                      <strong>{sheet.siteName || sheet.site?.siteName || sheet.site?.name || "Attendance sheet"}</strong>
                      <span>{formatPeriod(sheet)}{sheet.clientName ? ` · ${sheet.clientName}` : ""}</span>
                    </div>
                    <span className={`ssStatus ssStatus-${statusClass(statusValue)}`}>{attendanceStatusLabel(statusValue)}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="ssSideStack">
          <section className="ssPanel">
            <div className="ssPanelHead">
              <div>
                <span className="ssSectionKicker">Your permissions</span>
                <h2>Supervisor attendance access</h2>
              </div>
              <ShieldCheck className="ssPanelAccent" size={20} />
            </div>
            <ul className="ssPermissionList">
              <li><CheckCircle2 size={15} /><span><strong>View and filter</strong><small>Attendance sheets in your permitted scope</small></span></li>
              <li><CheckCircle2 size={15} /><span><strong>Generate sheets</strong><small>Create monthly sheets from active deployments</small></span></li>
              <li><CheckCircle2 size={15} /><span><strong>Submit sheets</strong><small>Send completed drafts for client approval</small></span></li>
            </ul>
            <p className="ssAccessNote">Client approval and payroll locking are not supervisor actions.</p>
            <button type="button" className="ssWideAction" onClick={() => onNavigate("attendance")}>
              Go to attendance <ArrowUpRight size={15} />
            </button>
          </section>

          <section className="ssPanel ssAccountPanel">
            <span className="ssSectionKicker">Account</span>
            <h2>{fullName}</h2>
            <p>{roles.map((role) => humanize(role)).join(" · ") || "Supervisor"}</p>
            <button type="button" className="ssTextAction" onClick={() => onNavigate("access")}>
              Review all access <ArrowUpRight size={14} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
