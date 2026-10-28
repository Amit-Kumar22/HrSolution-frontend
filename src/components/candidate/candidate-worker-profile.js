"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CreditCard,
  FileText,
  IdCard,
  Info,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import WorkerDetailDrawer from "@/app/admin/worker-detail";
import { workerCapabilities } from "@/lib/workerApi";
import { fetchCurrentUser } from "@/lib/auth";
import MyLeavesPanel from "@/app/worker/my-leaves-panel";
import HolidayManagementPanel from "@/app/admin/holiday-panel";
import WorkerDocumentsPanel from "@/app/worker/worker-documents-panel";
import WorkerBankAccountsPanel from "@/app/worker/worker-bank-accounts-panel";
import WorkerPayslipsPanel from "@/app/worker/worker-payslips-panel";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  FlashBanner,
  formatDate,
  formatDateTime,
  Chip,
  Notice,
} from "@/app/admin/admin-ui";

const PROFILE_TABS = [
  { id: "overview", label: "Overview", icon: IdCard },
  { id: "documents", label: "My Documents", icon: FileText },
  { id: "bank-accounts", label: "My Bank Accounts", icon: CreditCard },
  { id: "payslips", label: "My Payslips", icon: FileText },
  { id: "leaves", label: "My Leaves", icon: CalendarDays },
  { id: "holiday", label: "Holiday Calendar", icon: CalendarDays },
];

function statusMeta(status) {
  const key = String(status || "").toUpperCase();
  const map = {
    ACTIVE: { label: "Active", tone: "success" },
    PENDING_VERIFICATION: { label: "Pending verification", tone: "warn" },
    PENDING: { label: "Pending", tone: "warn" },
    DISABLED: { label: "Disabled", tone: "danger" },
    REJECTED: { label: "Rejected", tone: "danger" },
    BLOCKED: { label: "Blocked", tone: "danger" },
    INACTIVE: { label: "Inactive", tone: "neutral" },
  };
  return map[key] || { label: humanize(status) || "Unknown", tone: "neutral" };
}

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function WorkerMyProfilePanel({ session }) {
  const capabilities = useMemo(() => workerCapabilities(session), [session]);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const [profileLoadedKey, setProfileLoadedKey] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const profileRequestKey = String(refreshKey);
  const profileLoading = profileLoadedKey !== profileRequestKey;

  useEffect(() => {
    fetchCurrentUser()
      .then((payload) => {
        setProfile(payload || null);
        setProfileLoadedKey(profileRequestKey);
      })
      .catch((error) => {
        setProfileError(error instanceof Error ? error.message : "The profile could not be loaded.");
        setProfileLoadedKey(profileRequestKey);
      });
  }, [profileRequestKey]);

  const workerId = profile && profile.id != null ? String(profile.id) : null;
  const user = profile || {};

  if (profileLoading) {
    return (
      <div className="cp-stack">
        <section className="cp-panel">
          <div className="cp-panelHead">
            <h2>My Profile</h2>
            <p>Your worker profile is loaded from your authenticated session.</p>
          </div>
          <LoadingState label="Loading your profile…" />
        </section>
      </div>
    );
  }

  if (profileError || !workerId) {
    return (
      <div className="cp-stack">
        <section className="cp-panel">
          <div className="cp-panelHead">
            <h2>My Profile</h2>
            <p>Your worker profile could not be loaded from your session.</p>
          </div>
          {profileError && <ErrorState message={profileError} onRetry={loadProfile} />}
          {!profileError && (
            <EmptyState
              icon={Info}
              title="No worker profile"
              message="Your session does not contain a worker profile. Please sign in again."
            />
          )}
        </section>
      </div>
    );
  }

  const displayName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Worker";
  const emailVerified = Boolean(user.emailVerified);
  const meta = statusMeta(user.status);
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  return (
    <div className="cp-stack">
      <section className="cp-panel">
        <div className="cp-panelHead">
          <h2>My Profile</h2>
          <p>Your worker profile is loaded from your authenticated session.</p>
        </div>

        <FlashBanner flash={{ tone: "info", message: `Viewing Worker #${workerId} - read only` }} />

        <div className="cpProfileHeader">
          <div className="cpProfileAvatar">
            <User size={40} />
          </div>
          <div className="cpProfileInfo">
            <h2>{displayName}</h2>
            <p className="cmMuted">{user.email || "—"}</p>
            <div className="cpProfileMetaRow">
              <span className="cpProfileMetaChip">{user.phone ? (<><Phone size={13} /> {user.phone}</>) : "—"}</span>
              <span className="cpProfileMetaChip">{emailVerified ? (<><ShieldCheck size={13} /> Email verified</>) : (<><Info size={13} /> Email not verified</>)}</span>
              <Chip tone={meta.tone}>{meta.label}</Chip>
            </div>
          </div>
        </div>

        <div className="cpProfileGrid">
          <div className="cpProfileCard">
            <h3>Account</h3>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Worker ID</span>
              <span className="cpProfileValue">#{workerId}</span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">First name</span>
              <span className="cpProfileValue">{user.firstName || "—"}</span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Last name</span>
              <span className="cpProfileValue">{user.lastName || "—"}</span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Full name</span>
              <span className="cpProfileValue">{displayName}</span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Email</span>
              <span className="cpProfileValue">{user.email || "—"}</span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Phone</span>
              <span className="cpProfileValue">{user.phone || "—"}</span>
            </div>
          </div>
          <div className="cpProfileCard">
            <h3>Access</h3>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Status</span>
              <span className="cpProfileValue"><Chip tone={meta.tone}>{meta.label}</Chip></span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Email verified</span>
              <span className="cpProfileValue">{emailVerified ? "Yes" : "No"}</span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Last sign-in</span>
              <span className="cpProfileValue">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</span>
            </div>
            <div className="cpProfileDetailRow">
              <span className="cpProfileLabel">Roles</span>
              <span className="cpProfileValue">
                {roles.length ? roles.map((role) => <span key={role} className="cpProfileChip">{humanize(role)}</span>) : "—"}
              </span>
            </div>
            {permissions.length > 0 && (
              <div className="cpProfileDetailRow">
                <span className="cpProfileLabel">Permissions</span>
                <span className="cpProfileValue">{permissions.length} permission{permissions.length === 1 ? "" : "s"} granted by the server</span>
              </div>
            )}
          </div>
        </div>

        <nav className="cpProfileTabs" aria-label="Worker profile sections">
          {PROFILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`cpProfileTab${active ? " cpProfileTabActive" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </nav>

        {activeTab === "overview" && (
          <Notice tone="info">
            This is a read-only view of your profile. Use the tabs above to manage your documents, bank accounts,
            payslips and leaves. Contact HR for corrections to your profile.
          </Notice>
        )}
        {activeTab === "documents" && <WorkerDocumentsPanel session={session} />}
        {activeTab === "bank-accounts" && <WorkerBankAccountsPanel session={session} />}
        {activeTab === "payslips" && <WorkerPayslipsPanel session={session} />}
        {activeTab === "leaves" && <MyLeavesPanel session={session} />}
        {activeTab === "holiday" && <HolidayManagementPanel session={session} allowManagement={false} />}
      </section>
    </div>
  );
}
