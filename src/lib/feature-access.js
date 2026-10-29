import { rolesOf } from "./auth";

const MANAGEMENT_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "ACCOUNTS", "ACCOUNTANT"]);
const REMINDER_VIEW_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATOR",
  "OPERATIONS",
  "OPERATIONS_MANAGER",
  "HR",
  "HR_RECRUITER",
  "HR_MANAGER",
  "ACCOUNTS",
  "ACCOUNTANT",
]);
const REPORT_ROLES = new Set([
  ...REMINDER_VIEW_ROLES,
  "CLIENT",
]);

function hasOneOf(session, allowedRoles) {
  return rolesOf(session).some((role) => allowedRoles.has(role));
}

export function canManageCompliance(session) {
  return hasOneOf(session, MANAGEMENT_ROLES);
}

export function canViewComplianceReminders(session) {
  return hasOneOf(session, REMINDER_VIEW_ROLES);
}

export function canGenerateComplianceReminders(session) {
  return canManageCompliance(session);
}

export function canViewReports(session) {
  return hasOneOf(session, REPORT_ROLES);
}

export function canViewNotifications(session) {
  const roles = rolesOf(session);
  return Boolean(session && session.accessToken && !roles.includes("CANDIDATE"));
}
