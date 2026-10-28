"use client";

import { useSyncExternalStore } from "react";
import { FileText, Lock } from "lucide-react";
import {
  AUTH_SESSION_ERROR,
  AUTH_SESSION_LOADING,
  getAuthSessionSnapshot,
  getServerAuthSnapshot,
  subscribeToAuthSession,
} from "@/lib/auth";
import { isWorkerRole } from "@/lib/auth";
import { EmptyState, SectionHead } from "../admin/admin-ui";

export default function WorkerPayslipsPanel({ session }) {
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );

  const user = (sessionState && sessionState.user) || {};
  const displayName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Worker";

  if (sessionState === AUTH_SESSION_LOADING) {
    return <div className="wpPayslipsPanel">Loading your payslips…</div>;
  }
  if (sessionState === AUTH_SESSION_ERROR || (sessionState && "error" in sessionState)) {
    return <div className="wpPayslipsPanel" role="alert">{sessionState.error}</div>;
  }
  if (!sessionState || !isWorkerRole(sessionState)) {
    return <div className="wpPayslipsPanel">Taking you to the right dashboard…</div>;
  }

  return (
    <div className="wpPayslipsPanel">
      <SectionHead
        title="My payslips"
        description={`Payslips for ${displayName} are issued once the client payroll run covering your work is processed and published.`}
      />
      <EmptyState
        icon={Lock}
        title="No payslips available yet"
        message={
          "Individual payslips are generated per worker from a processed payroll run. " +
          "Your payslip becomes available to view and download once your client's payroll run is published. " +
          "Contact your HR or Accounts team if you expect a payslip for a completed period."
        }
      />
    </div>
  );
}
