import { normalizePhone } from "./lead-form";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

export function normalizeAuthEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeAuthPhone(value) {
  return normalizePhone(String(value || ""));
}

export function validateEmail(value) {
  const email = normalizeAuthEmail(value);
  if (!email) return "Email address is required.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return "";
}

export function validatePhone(value) {
  const phone = normalizeAuthPhone(value);
  if (!phone) return "Phone number is required.";
  if (!PHONE_PATTERN.test(phone)) return "Enter a valid 10-digit Indian mobile number.";
  return "";
}

export function validatePassword(value) {
  const password = String(value || "");
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character.";
  return "";
}

export function validatePasswordMatch(value, confirmValue) {
  if (String(value || "") !== String(confirmValue || "")) {
    return "Passwords do not match.";
  }
  return "";
}

export function validateCandidateForm(values) {
  const errors = {};
  if (!String(values.firstName || "").trim()) errors.firstName = "First name is required.";
  if (!String(values.lastName || "").trim()) errors.lastName = "Last name is required.";
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(values.phone);
  if (phoneError) errors.phone = phoneError;
  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  if (!values.consentGiven) errors.consentGiven = "Please accept the data consent to continue.";
  return errors;
}

export function validateClientForm(values) {
  const errors = {};
  if (!String(values.companyName || "").trim()) errors.companyName = "Company name is required.";
  if (!String(values.firstName || "").trim()) errors.firstName = "First name is required.";
  if (!String(values.lastName || "").trim()) errors.lastName = "Last name is required.";
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(values.phone);
  if (phoneError) errors.phone = phoneError;
  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  if (!values.consentGiven) errors.consentGiven = "Please accept the data consent to continue.";
  return errors;
}

export function passwordHints() {
  return [
    "At least 8 characters",
    "An uppercase and a lowercase letter",
    "A number and a special character",
  ];
}

export function authFieldErrors(error, knownFields) {
  if (!error || !error.fields || typeof error.fields !== "object") return {};
  const picked = {};
  for (const fieldName of knownFields) {
    const message = error.fields[fieldName];
    if (typeof message === "string" && message) picked[fieldName] = message;
  }
  return picked;
}

export function pickRegistrationErrors(error) {
  const fields = authFieldErrors(error, [
    "firstName",
    "lastName",
    "companyName",
    "email",
    "phone",
    "password",
    "consentGiven",
  ]);
  if (fields.email && typeof fields.email === "string") {
    const lower = fields.email.toLowerCase();
    if (lower.includes("exist") || lower.includes("already") || lower.includes("duplicate")) {
      fields.duplicate = fields.email;
    }
  }
  return fields;
}