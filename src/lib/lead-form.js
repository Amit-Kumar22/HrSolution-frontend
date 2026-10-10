const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

export function normalizePhone(text) {
  let phone = String(text || "").replace(/[\s()-]/g, "");
  phone = phone.replace(/^\+91/i, "");
  if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  else if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  return phone;
}

export const LEAD_KNOWN_FIELDS = [
  "companyName",
  "contactPerson",
  "phone",
  "email",
  "city",
  "state",
  "categoryId",
  "otherCategory",
  "numberOfWorkers",
  "durationMonths",
  "requiredFrom",
  "message",
];

function readText(formData, name) {
  const value = formData.get(name);
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function readNumber(formData, name) {
  const text = readText(formData, name);
  if (text == null) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readLeadValues(formData) {
  return {
    companyName: readText(formData, "companyName") || "",
    contactPerson: readText(formData, "contactPerson") || "",
    phone: normalizePhone(readText(formData, "phone")) || "",
    email: readText(formData, "email") || "",
  };
}

export function validateLead(values) {
  const errors = {};
  if (!values.companyName) errors.companyName = "Company name is required.";
  if (!values.contactPerson) errors.contactPerson = "Contact person is required.";
  if (!values.phone) errors.phone = "Phone number is required.";
  else if (!PHONE_PATTERN.test(values.phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }
  if (values.email && !EMAIL_PATTERN.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

export function buildLeadPayload(formData, formRenderedAt) {
  const honeypotValue = formData.get("website");
  return {
    companyName: readText(formData, "companyName"),
    contactPerson: readText(formData, "contactPerson"),
    phone: normalizePhone(readText(formData, "phone")),
    email: readText(formData, "email"),
    city: readText(formData, "city"),
    state: readText(formData, "state"),
    categoryId: readNumber(formData, "categoryId"),
    otherCategory: readText(formData, "otherCategory"),
    numberOfWorkers: readNumber(formData, "numberOfWorkers"),
    durationMonths: readNumber(formData, "durationMonths"),
    requiredFrom: readText(formData, "requiredFrom"),
    message: readText(formData, "message"),
    website: honeypotValue == null ? "" : String(honeypotValue),
    formRenderedAt: Number.isFinite(formRenderedAt) ? formRenderedAt : Date.now(),
  };
}

export function buildContactPayload(formData, formRenderedAt) {
  const { contactPerson, ...rest } = buildLeadPayload(formData, formRenderedAt);
  return { ...rest, name: contactPerson };
}


export function pickApiFieldErrors(error, knownFields) {
  if (!error || !error.fields || typeof error.fields !== "object") return {};
  const picked = {};
  for (const fieldName of knownFields) {
    const message = error.fields[fieldName];
    if (typeof message === "string" && message) picked[fieldName] = message;
  }
  return picked;
}

export function resolveSuccessMessage(result, fallback) {
  if (result && typeof result.message === "string" && result.message.trim()) {
    return result.message.trim();
  }
  return fallback;
}
