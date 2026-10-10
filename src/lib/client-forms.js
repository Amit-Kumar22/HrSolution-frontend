import { stateCodeOf, stateNameOf } from "./gst-states";

export const CLIENT_STATUS_OPTIONS = [
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "INACTIVE",
  "REJECTED",
];

export const CLIENT_STATUS_TONE = {
  PENDING_APPROVAL: "warn",
  ACTIVE: "success",
  SUSPENDED: "danger",
  INACTIVE: "neutral",
  REJECTED: "danger",
};

export const CLIENT_STATUS_LABEL = {
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  INACTIVE: "Inactive",
  REJECTED: "Rejected",
};

export function statusTone(status) {
  return CLIENT_STATUS_TONE[status] || "neutral";
}

export function statusLabel(status) {
  return CLIENT_STATUS_LABEL[status] || status || "—";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const PHONE_RE = /^[6-9][0-9]{9}$/;

export function validateEmail(value) {
  return EMAIL_RE.test(String(value || "").trim());
}

export function validatePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return PHONE_RE.test(local);
}

export function validateGstin(value) {
  return GSTIN_RE.test(String(value || "").trim().toUpperCase());
}

export function validatePan(value) {
  return PAN_RE.test(String(value || "").trim().toUpperCase());
}

export function validatePincode(value) {
  return PINCODE_RE.test(String(value || "").trim());
}

export function validateStateCode(value) {
  const code = String(value || "").trim();
  if (!code) return false;
  return code.length === 2 && Boolean(stateCodeOf(code) || code === "99");
}

function requiredField(value) {
  return String(value ?? "").trim().length > 0;
}

/* ------------------------------------------------------------------ */
/* Site                                                                */
/* ------------------------------------------------------------------ */

export function emptySiteForm() {
  return {
    siteCode: "",
    siteName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    stateCode: "",
    pincode: "",
    siteInchargeName: "",
    siteInchargePhone: "",
    siteInchargeEmail: "",
    active: true,
  };
}

export function siteToForm(site) {
  return {
    siteCode: site?.siteCode ?? "",
    siteName: site?.siteName ?? "",
    addressLine1: site?.addressLine1 ?? "",
    addressLine2: site?.addressLine2 ?? "",
    city: site?.city ?? "",
    state: site?.state ?? "",
    stateCode: site?.stateCode ?? "",
    pincode: site?.pincode ?? "",
    siteInchargeName: site?.siteInchargeName ?? "",
    siteInchargePhone: site?.siteInchargePhone ?? "",
    siteInchargeEmail: site?.siteInchargeEmail ?? "",
    active: site?.active ?? true,
  };
}

export function siteFormToPayload(form) {
  const payload = {
    siteCode: String(form.siteCode || "").trim(),
    siteName: String(form.siteName || "").trim(),
    addressLine1: String(form.addressLine1 || "").trim(),
    addressLine2: String(form.addressLine2 || "").trim(),
    city: String(form.city || "").trim(),
    state: String(form.state || "").trim(),
    stateCode: String(form.stateCode || "").trim().toUpperCase(),
    pincode: String(form.pincode || "").trim(),
    siteInchargeName: String(form.siteInchargeName || "").trim(),
    siteInchargePhone: String(form.siteInchargePhone || "").trim(),
    siteInchargeEmail: String(form.siteInchargeEmail || "").trim(),
    active: Boolean(form.active),
  };
  return payload;
}

export function validateSiteForm(form) {
  const errors = {};
  if (!requiredField(form.siteCode)) errors.siteCode = "Site code is required.";
  if (!requiredField(form.siteName)) errors.siteName = "Site name is required.";
  if (requiredField(form.city) === false) errors.city = "City is required.";
  if (requiredField(form.pincode)) {
    if (!validatePincode(form.pincode)) errors.pincode = "Enter a valid 6-digit pincode.";
  } else {
    errors.pincode = "Pincode is required.";
  }
  if (requiredField(form.stateCode)) {
    if (!validateStateCode(form.stateCode)) errors.stateCode = "Enter a valid 2-digit GST state code.";
    else if (form.state && stateNameOf(form.stateCode) !== String(form.state).trim() && stateCodeOf(form.state)) {
      errors.stateCode = "State code does not match the selected state.";
    }
  }
  if (requiredField(form.siteInchargeEmail) && !validateEmail(form.siteInchargeEmail)) {
    errors.siteInchargeEmail = "Enter a valid email address.";
  }
  if (requiredField(form.siteInchargePhone) && !validatePhone(form.siteInchargePhone)) {
    errors.siteInchargePhone = "Enter a valid 10-digit Indian mobile number.";
  }
  return errors;
}

export const STATE_CODE_HINT =
  "State code drives minimum wage and professional tax for future payrolls at this site. Past payrolls are unaffected.";

/* ------------------------------------------------------------------ */
/* Status change                                                       */
/* ------------------------------------------------------------------ */

export function emptyStatusForm(currentStatus) {
  return { status: currentStatus || "ACTIVE", reason: "" };
}

export function statusFormToPayload(form) {
  return {
    status: String(form.status || "").trim(),
    reason: String(form.reason || "").trim(),
  };
}

export function validateStatusForm(form) {
  const errors = {};
  if (!requiredField(form.status)) errors.status = "Select a status.";
  if (!CLIENT_STATUS_OPTIONS.includes(String(form.status))) errors.status = "That status is not supported.";
  if (!requiredField(form.reason)) errors.reason = "A reason is required for the audit trail.";
  return errors;
}

/* ------------------------------------------------------------------ */
/* Client registration approval                                        */
/* ------------------------------------------------------------------ */

export function emptyApproveForm(registration) {
  return {
    userId: registration?.id ?? "",
    legalName: registration?.pendingCompanyName ?? "",
    gstin: "",
    pan: "",
    billingCity: "",
    billingState: "",
    billingStateCode: "",
    designation: "",
    paymentTermsDays: 30,
  };
}

export function approveFormToPayload(form) {
  return {
    legalName: String(form.legalName || "").trim(),
    gstin: String(form.gstin || "").trim().toUpperCase(),
    pan: String(form.pan || "").trim().toUpperCase(),
    billingCity: String(form.billingCity || "").trim(),
    billingState: String(form.billingState || "").trim(),
    billingStateCode: String(form.billingStateCode || "").trim(),
    designation: String(form.designation || "").trim(),
    paymentTermsDays: Number(form.paymentTermsDays),
  };
}

export function validateApproveForm(form) {
  const errors = {};
  if (!requiredField(form.legalName)) errors.legalName = "Legal name is required.";
  if (requiredField(form.gstin) && !validateGstin(form.gstin)) errors.gstin = "Enter a valid 15-character GSTIN.";
  if (requiredField(form.pan) && !validatePan(form.pan)) errors.pan = "Enter a valid 10-character PAN.";
  if (!requiredField(form.billingCity)) errors.billingCity = "Billing city is required.";
  if (!requiredField(form.billingState)) errors.billingState = "Billing state is required.";
  if (!requiredField(form.billingStateCode) || !validateStateCode(form.billingStateCode)) {
    errors.billingStateCode = "Enter a valid 2-digit GST state code.";
  }
  if (form.paymentTermsDays === "" || form.paymentTermsDays === null || Number.isNaN(Number(form.paymentTermsDays))) {
    errors.paymentTermsDays = "Payment terms in days is required.";
  } else if (Number(form.paymentTermsDays) < 0 || Number(form.paymentTermsDays) > 365) {
    errors.paymentTermsDays = "Payment terms must be between 0 and 365 days.";
  }
  if (requiredField(form.designation) === false) errors.designation = "Designation is required.";
  return errors;
}

/* ------------------------------------------------------------------ */
/* Link user                                                           */
/* ------------------------------------------------------------------ */

export function emptyLinkForm() {
  return { userId: "", designation: "", primaryContact: false };
}

export function linkFormToPayload(form) {
  return {
    userId: Number(form.userId),
    designation: String(form.designation || "").trim(),
    primaryContact: Boolean(form.primaryContact),
  };
}

export function validateLinkForm(form) {
  const errors = {};
  if (form.userId === "" || form.userId === null || form.userId === undefined) {
    errors.userId = "Select a user to link.";
  }
  if (!requiredField(form.designation)) errors.designation = "Designation is required.";
  return errors;
}

/* ------------------------------------------------------------------ */
/* Client create / update (POST /clients, PUT /clients/{id})           */
/* ------------------------------------------------------------------ */

const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const BILLING_STATE_CODE_RE = /^[0-3][0-9]$/;

export function validateCin(value) {
  return CIN_RE.test(String(value || "").trim().toUpperCase());
}

export function validateBillingStateCode(value) {
  const code = String(value || "").trim();
  if (!code) return true;
  return BILLING_STATE_CODE_RE.test(code);
}

export function emptyClientForm() {
  return {
    legalName: "",
    tradeName: "",
    gstin: "",
    pan: "",
    cin: "",
    billingAddressLine1: "",
    billingAddressLine2: "",
    billingCity: "",
    billingState: "",
    billingStateCode: "",
    billingPincode: "",
    billingCountry: "India",
    industryId: "",
    paymentTermsDays: 30,
    notes: "",
  };
}

export function clientToForm(client) {
  const base = emptyClientForm();
  if (!client) return base;
  return {
    legalName: client.legalName ?? base.legalName,
    tradeName: client.tradeName ?? base.tradeName,
    gstin: client.gstin ?? base.gstin,
    pan: client.pan ?? base.pan,
    cin: client.cin ?? base.cin,
    billingAddressLine1: client.billingAddressLine1 ?? base.billingAddressLine1,
    billingAddressLine2: client.billingAddressLine2 ?? base.billingAddressLine2,
    billingCity: client.billingCity ?? base.billingCity,
    billingState: client.billingState ?? base.billingState,
    billingStateCode: client.billingStateCode ?? base.billingStateCode,
    billingPincode: client.billingPincode ?? base.billingPincode,
    billingCountry: client.billingCountry ?? base.billingCountry,
    industryId: client.industryId ?? base.industryId,
    paymentTermsDays: client.paymentTermsDays ?? base.paymentTermsDays,
    notes: client.notes ?? base.notes,
  };
}

export function clientFormToPayload(form) {
  const value = (key) => String(form[key] || "").trim();
  return {
    legalName: value("legalName"),
    tradeName: value("tradeName"),
    gstin: value("gstin").toUpperCase(),
    pan: value("pan").toUpperCase(),
    cin: value("cin").toUpperCase(),
    billingAddressLine1: value("billingAddressLine1"),
    billingAddressLine2: value("billingAddressLine2"),
    billingCity: value("billingCity"),
    billingState: value("billingState"),
    billingStateCode: value("billingStateCode"),
    billingPincode: value("billingPincode"),
    billingCountry: value("billingCountry"),
    industryId: form.industryId === "" || form.industryId === null || form.industryId === undefined
      ? null
      : Number(form.industryId),
    paymentTermsDays: Number(form.paymentTermsDays),
    notes: value("notes"),
  };
}

export function validateClientForm(form) {
  const errors = {};
  const legalName = String(form.legalName || "").trim();
  if (!legalName) errors.legalName = "Legal name is required.";
  else if (legalName.length > 200) errors.legalName = "Legal name cannot exceed 200 characters.";
  if (String(form.tradeName || "").trim().length > 200) errors.tradeName = "Trade name cannot exceed 200 characters.";
  if (requiredField(form.gstin) && !validateGstin(form.gstin)) errors.gstin = "Enter a valid 15-character GSTIN.";
  if (requiredField(form.pan) && !validatePan(form.pan)) errors.pan = "Enter a valid 10-character PAN.";
  if (requiredField(form.cin) && !validateCin(form.cin)) errors.cin = "Enter a valid 21-character CIN.";
  if (requiredField(form.billingPincode) && !validatePincode(form.billingPincode)) errors.billingPincode = "Enter a valid 6-digit pincode.";
  if (!validateBillingStateCode(form.billingStateCode)) errors.billingStateCode = "State code must be between 00 and 39.";
  if (form.paymentTermsDays === "" || form.paymentTermsDays === null || form.paymentTermsDays === undefined || Number.isNaN(Number(form.paymentTermsDays))) {
    errors.paymentTermsDays = "Payment terms in days is required.";
  } else if (Number(form.paymentTermsDays) < 0 || Number(form.paymentTermsDays) > 365) {
    errors.paymentTermsDays = "Payment terms must be between 0 and 365 days.";
  }
  if (String(form.notes || "").trim().length > 2000) errors.notes = "Notes cannot exceed 2000 characters.";
  return errors;
}
