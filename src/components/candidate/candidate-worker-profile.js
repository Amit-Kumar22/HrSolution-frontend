"use client";

import { useMemo, useState, useEffect } from "react";
import {
  CalendarDays,
  CreditCard,
  FileText,
  IdCard,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import WorkerDetailDrawer from "@/app/admin/worker-detail";
import { workerCapabilities } from "@/lib/workerApi";
import MyLeavesPanel from "@/app/worker/my-leaves-panel";
import HolidayManagementPanel from "@/app/admin/holiday-panel";
import WorkerDocumentsPanel from "@/app/worker/worker-documents-panel";
import WorkerBankAccountsPanel from "@/app/worker/worker-bank-accounts-panel";
import WorkerPayslipsPanel from "@/app/worker/worker-payslips-panel";

const STORAGE_KEY = "shakti.workerProfileId";
const CHANGE_EVENT = "shakti:worker-profile-change";

function persistWorkerId(workerId) {
  try {
    if (workerId) window.sessionStorage.setItem(STORAGE_KEY, workerId);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

const PROFILE_TABS = [
  { id: "overview", label: "Overview", icon: IdCard },
  { id: "documents", label: "My Documents", icon: FileText },
  { id: "bank-accounts", label: "My Bank Accounts", icon: CreditCard },
  { id: "payslips", label: "My Payslips", icon: FileText },
  { id: "leaves", label: "My Leaves", icon: CalendarDays },
  { id: "holiday", label: "Holiday Calendar", icon: CalendarDays },
];

export default function CandidateWorkerProfile({ session }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const user = (session && session.user) || {};
  const sessionWorkerId = user && user.id != null ? String(user.id) : "";
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isWorkerRoleUser = roles.includes("WORKER");
  const [workerId, setWorkerId] = useState(() => (isWorkerRoleUser ? sessionWorkerId : ""));
  const capabilities = useMemo(() => workerCapabilities(session), [session]);

  useEffect(() => {
    if (isWorkerRoleUser && sessionWorkerId && !workerId) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, sessionWorkerId);
      } catch {}
    }
  }, [isWorkerRoleUser, sessionWorkerId, workerId]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!/^[1-9][0-9]*$/.test(trimmed)) {
      setError("Enter the numeric Worker ID provided by your HR team.");
      return;
    }
    if (!persistWorkerId(trimmed)) {
      setError("This browser could not remember the Worker ID. Allow site storage and try again.");
      return;
    }
    setWorkerId(trimmed);
    setError("");
    setActiveTab("overview");
  }

  function handleForget() {
    persistWorkerId("");
    setWorkerId("");
    setInput("");
    setError("");
    setActiveTab("overview");
  }

  const displayWorkerId = workerId || "";

  return (
    <div className="cp-stack">
      <section className="cp-panel">
        <div className="cp-panelHead">
          <h2>My Worker Profile</h2>
          <p>
            View the worker record your HR team maintains for you. Enter the Worker ID they shared when you joined.
          </p>
        </div>

        {!displayWorkerId ? (
          <form className="cp-form" onSubmit={handleSubmit} noValidate>
            <div className="authField authField--full">
              <label className="authLabel" htmlFor="candidateWorkerId">Worker ID</label>
              <input
                id="candidateWorkerId"
                className={`authInput${error ? " authInputError" : ""}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="For example, 1024"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (error) setError("");
                }}
              />
            </div>
            {error && <p className="cp-state cp-state--error" role="alert">{error}</p>}
            <p className="cp-inlineNote">
              This is an internal worker number, not your phone number. Contact HR if you do not know it.
            </p>
            <div className="authButtonRow cp-formActions">
              <button type="submit" className="authButton">
                <Search size={15} /> Find my profile
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="cp-workerToolbar">
              <span>
                <ShieldCheck size={15} /> Viewing Worker #{displayWorkerId} - read only
              </span>
              <button type="button" className="authButtonSecondary" onClick={handleForget}>
                <RefreshCw size={14} /> Use a different ID
              </button>
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
              <WorkerDetailDrawer
                key={displayWorkerId}
                workerId={displayWorkerId}
                capabilities={capabilities}
                selfWorkerId={displayWorkerId}
                inline
              />
            )}
            {activeTab === "documents" && <WorkerDocumentsPanel session={session} />}
            {activeTab === "bank-accounts" && <WorkerBankAccountsPanel session={session} />}
            {activeTab === "payslips" && <WorkerPayslipsPanel session={session} />}
            {activeTab === "leaves" && <MyLeavesPanel session={session} />}
            {activeTab === "holiday" && <HolidayManagementPanel session={session} allowManagement={false} />}
          </>
        )}
      </section>
    </div>
  );
}
