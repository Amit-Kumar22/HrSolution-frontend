export const COMPANY_STATUS_META = Object.freeze({
  PENDING_APPROVAL: { label: "Pending approval", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  REJECTED: { label: "Rejected", tone: "danger" },
});

export const GST_TREATMENT_LABELS = Object.freeze({
  INTRA_STATE: "Intra-state (CGST + SGST)",
  INTER_STATE: "Inter-state (IGST)",
  UNKNOWN: "Unknown",
});

export const USER_STATUS_META = Object.freeze({
  ACTIVE: { label: "Active", tone: "success" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "info" },
  PENDING: { label: "Pending", tone: "info" },
  DISABLED: { label: "Disabled", tone: "danger" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
});

export function companyName(company) {
  if (!company) return "Client company";
  return (
    company.displayName ||
    company.tradeName ||
    company.legalName ||
    company.clientCode ||
    (company.id != null ? `Client #${company.id}` : "Client company")
  );
}

export function companyStatusMeta(status) {
  const key = String(status || "").toUpperCase();
  return COMPANY_STATUS_META[key] || { label: status || "—", tone: "neutral" };
}

export function gstTreatmentLabel(value) {
  return GST_TREATMENT_LABELS[String(value || "").toUpperCase()] || value || "—";
}

export function userStatusMeta(status) {
  const key = String(status || "").toUpperCase();
  return USER_STATUS_META[key] || { label: status || "—", tone: "neutral" };
}

export function siteLabel(site) {
  if (!site) return "Site";
  return site.displayLabel || site.siteName || site.siteCode || (site.id != null ? `Site #${site.id}` : "Site");
}

export function siteAddress(site) {
  if (!site) return "—";
  const address = [
    site.addressLine1,
    site.addressLine2,
    site.city,
    site.state,
    site.pincode,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
  return address || "—";
}

export function companyBillingAddress(company) {
  if (!company) return "—";
  const address = [
    company.billingAddressLine1,
    company.billingAddressLine2,
    company.billingCity,
    company.billingState,
    company.billingPincode,
    company.billingCountry,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
  return address || "—";
}

export function clientErrorMessage(error, fallback) {
  if (error && typeof error === "object" && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
