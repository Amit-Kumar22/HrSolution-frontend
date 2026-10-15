import { normalizePhone } from "./lead-form";

/*
 * The public apply form (PublicApplyRequest on the backend). Validation here
 * mirrors the server's bean-validation so a candidate sees mistakes before a
 * round trip, but the server stays the authority: whatever it returns wins.
 *
 * The honeypot ("website") and the render timestamp ("formRenderedAt") are the
 * same anti-spam pair the enquiry and contact forms use. Both are carried in
 * the request body rather than as separate fields, because the whole payload
 * is one JSON part of the multipart upload, not form-encoded fields.
 */

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

const NAME_MAX = 160;
const EMAIL_MAX = 180;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;
const EXPERIENCE_MAX_MONTHS = 720;
const SALARY_MAX = 9999999.99;

export const APPLICATION_KNOWN_FIELDS = [
  "fullName",
  "email",
  "phone",
  "city",
  "state",
  "totalExperienceMonths",
  "highestQualification",
  "coverNote",
  "expectedSalary",
  "consentGiven",
  "resume",
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

export function readApplicationValues(formData) {
  return {
    fullName: readText(formData, "fullName") || "",
    email: readText(formData, "email") || "",
    phone: normalizePhone(readText(formData, "phone")) || "",
    city: readText(formData, "city") || "",
    state: readText(formData, "state") || "",
    totalExperienceMonths: readText(formData, "totalExperienceMonths") || "",
    highestQualification: readText(formData, "highestQualification") || "",
    coverNote: readText(formData, "coverNote") || "",
    expectedSalary: readText(formData, "expectedSalary") || "",
    consentGiven: formData.get("consentGiven") != null,
  };
}

export function validateApplication(values) {
  const errors = {};

  if (!values.fullName) errors.fullName = "Your name is required.";
  else if (values.fullName.length > NAME_MAX) errors.fullName = "Name is too long.";

  if (!values.email) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(values.email)) errors.email = "Enter a valid email address.";
  else if (values.email.length > EMAIL_MAX) errors.email = "Email is too long.";

  if (!values.phone) errors.phone = "A mobile number is required.";
  else if (!MOBILE_PATTERN.test(values.phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }

  if (values.city.length > 100) errors.city = "City is too long.";
  if (values.state.length > 100) errors.state = "State is too long.";

  if (values.totalExperienceMonths !== "") {
    const months = Number(values.totalExperienceMonths);
    if (!Number.isFinite(months) || months < 0) {
      errors.totalExperienceMonths = "Enter your experience in months (0 if none).";
    } else if (months > EXPERIENCE_MAX_MONTHS) {
      errors.totalExperienceMonths = "Experience cannot exceed 60 years.";
    }
  }

  if (values.highestQualification.length > 120) {
    errors.highestQualification = "Qualification is too long.";
  }

  if (values.coverNote.length > 2000) {
    errors.coverNote = "Message must be 2000 characters or fewer.";
  }

  if (values.expectedSalary !== "") {
    const amount = Number(values.expectedSalary);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.expectedSalary = "Enter a valid monthly amount.";
    } else if (amount > SALARY_MAX) {
      errors.expectedSalary = "Amount is implausibly large.";
    }
  }

  if (!values.consentGiven) {
    errors.consentGiven = "Consent is required to process your application.";
  }

  return errors;
}

export function buildApplicationPayload(formData, formRenderedAt) {
  const honeypot = formData.get("website");
  return {
    fullName: readText(formData, "fullName"),
    email: readText(formData, "email"),
    phone: normalizePhone(readText(formData, "phone")),
    city: readText(formData, "city"),
    state: readText(formData, "state"),
    totalExperienceMonths: readNumber(formData, "totalExperienceMonths"),
    highestQualification: readText(formData, "highestQualification"),
    coverNote: readText(formData, "coverNote"),
    expectedSalary: readNumber(formData, "expectedSalary"),
    consentGiven: formData.get("consentGiven") != null,
    website: honeypot == null ? "" : String(honeypot),
    formRenderedAt: Number.isFinite(formRenderedAt) ? formRenderedAt : Date.now(),
  };
}

export function validateResume(file) {
  if (!file) return null;
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  const looksLikePdf = type === "application/pdf" || name.endsWith(".pdf");
  if (!looksLikePdf) return "Upload your resume as a PDF file.";
  if (file.size > RESUME_MAX_BYTES) return "Your resume must be 10 MB or smaller.";
  return null;
}

export function resolveApplicationError(error) {
  const status = error && typeof error.status === "number" ? error.status : 0;
  const message =
    (error && typeof error.message === "string" && error.message.trim()) ||
    "Your application could not be submitted. Please try again.";

  if (status === 404) {
    return {
      blocked: true,
      message:
        "This vacancy is no longer accepting applications. It may have been filled or withdrawn.",
    };
  }
  if (status === 409) {
    return {
      blocked: true,
      message,
    };
  }
  if (status === 415) {
    return { resumeError: "Your resume must be a PDF file.", message };
  }
  if (status === 413) {
    return { resumeError: "Your resume is too large. The maximum size is 10 MB.", message };
  }
  return { message };
}
