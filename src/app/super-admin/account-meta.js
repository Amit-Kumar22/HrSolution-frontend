import { ROLE_DASHBOARDS } from "../../lib/auth";

export const ACCOUNT_STATUSES = Object.freeze([
  "PENDING_VERIFICATION",
  "PENDING_APPROVAL",
  "ACTIVE",
  "DISABLED",
  "REJECTED",
]);

export const STATUS_META = Object.freeze({
  ACTIVE: { label: "Active", tone: "success" },
  DISABLED: { label: "Disabled", tone: "danger" },
  PENDING_VERIFICATION: { label: "Pending verification", tone: "warn" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "info" },
  REJECTED: { label: "Rejected", tone: "neutral" },
});

const ROLE_LABELS = Object.freeze({
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  HR: "HR",
  HR_RECRUITER: "HR Recruiter",
  HR_MANAGER: "HR Manager",
  RECRUITER: "Recruiter",
  OPERATIONS: "Operations",
  OPERATIONS_MANAGER: "Operations Manager",
  OPERATOR: "Operator",
  SECURITY_GUARD: "Security Guard",
  ACCOUNTS: "Accounts",
  ACCOUNTANT: "Accountant",
  SUPERVISOR: "Supervisor",
  CLIENT: "Client",
  CANDIDATE: "Candidate",
  WORKER: "Worker",
});

const ROLE_DESCRIPTIONS = Object.freeze({
  SUPER_ADMIN: "Full control of accounts, roles, permissions and every dashboard.",
  ADMIN: "Runs the existing administration console and website content.",
  HR: "Recruitment, worker records, attendance and HR documentation.",
  OPERATIONS_MANAGER: "Manages day-to-day operations, including client records and deployments.",
  OPERATOR: "Day-to-day operations entries within assigned modules.",
  ACCOUNTS: "Payroll, invoices and financial records.",
  SUPERVISOR: "Site supervision, shift attendance and worker allocation.",
});

export function roleLabel(role) {
  if (!role) return "—";
  return ROLE_LABELS[role] || String(role).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function roleDescription(role) {
  return ROLE_DESCRIPTIONS[role] || "Custom internal role configured in the backend.";
}

export function statusMeta(status) {
  return STATUS_META[status] || { label: status ? String(status) : "Unknown", tone: "neutral" };
}

export function isSuperAdminRole(role) {
  return role === "SUPER_ADMIN";
}

export function dashboardForRole(role) {
  const entry = ROLE_DASHBOARDS.find((item) => item.roles.includes(role));
  if (entry) return entry;
  return { path: "/admin", label: "Admin Dashboard" };
}

export function displayName(account) {
  if (!account) return "Unnamed account";
  if (account.fullName && String(account.fullName).trim()) return String(account.fullName).trim();
  const parts = [account.firstName, account.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : account.email || "Unnamed account";
}

export function initialsOf(value) {
  const name = String(value || "").trim();
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
