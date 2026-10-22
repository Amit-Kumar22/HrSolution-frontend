import {
  Building2,
  CalendarCheck,
  FileSignature,
  Inbox,
  LayoutTemplate,
  ReceiptIndianRupee,
  ScrollText,
  Settings,
  ShieldCheck,
  UserSearch,
  UsersRound,
  Wallet,
} from "lucide-react";

export const MODULE_LABELS = {
  USER: "User & account management",
  ROLE: "Roles & permissions",
  CLIENT: "Clients",
  ENQUIRY: "Enquiries",
  PAYROLL: "Payroll",
  ATTENDANCE: "Attendance",
  WORKFORCE: "Workforce",
  RECRUITMENT: "Recruitment",
  CONTRACT: "Contracts",
  INVOICE: "Invoices",
  SETTINGS: "Settings",
  AUDIT: "Audit",
  CONTENT: "Website content",
};

const MODULE_ICONS = {
  USER: UsersRound,
  ROLE: ShieldCheck,
  CLIENT: Building2,
  ENQUIRY: Inbox,
  PAYROLL: Wallet,
  ATTENDANCE: CalendarCheck,
  WORKFORCE: UsersRound,
  RECRUITMENT: UserSearch,
  CONTRACT: FileSignature,
  INVOICE: ReceiptIndianRupee,
  SETTINGS: Settings,
  AUDIT: ScrollText,
  CONTENT: LayoutTemplate,
};

const MODULE_TONES = {
  USER: "blue",
  ROLE: "indigo",
  CLIENT: "blue",
  ENQUIRY: "amber",
  PAYROLL: "green",
  ATTENDANCE: "indigo",
  WORKFORCE: "blue",
  RECRUITMENT: "indigo",
  CONTRACT: "amber",
  INVOICE: "green",
  SETTINGS: "slate",
  AUDIT: "slate",
  CONTENT: "amber",
};

const MODULE_FALLBACK_ICON = LayoutTemplate;

export function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function moduleOf(permissionName) {
  const parts = String(permissionName || "").split("_");
  if (parts.length <= 1) return "OTHER";
  return parts.slice(0, parts.length - 1).join("_");
}

export function moduleLabel(moduleKey) {
  return MODULE_LABELS[moduleKey] || humanize(moduleKey);
}

export function moduleIcon(moduleKey) {
  return MODULE_ICONS[moduleKey] || MODULE_FALLBACK_ICON;
}

export function moduleTone(moduleKey) {
  return MODULE_TONES[moduleKey] || "slate";
}
