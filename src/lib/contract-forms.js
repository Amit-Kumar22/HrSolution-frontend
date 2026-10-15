import { formatMoney, todayDateString } from "./rate-card-forms";

export const MAX_SERVICE_CHARGE_VALUE = 9999999.99;
export const MAX_SERVICE_CHARGE_PERCENT = 100;
export const MAX_CONTRACT_DOCUMENT_BYTES = 10 * 1024 * 1024;

export { todayDateString };

export const SERVICE_CHARGE_TYPES = Object.freeze([
  { value: "PERCENTAGE", label: "Percentage of wages" },
  { value: "FIXED_PER_WORKER", label: "Fixed per worker / month" },
]);

export const SERVICE_CHARGE_TYPE_LABELS = Object.freeze({
  PERCENTAGE: "Percentage of wages",
  FIXED_PER_WORKER: "Fixed per worker / month",
});

export function serviceChargeTypeLabel(type) {
  return SERVICE_CHARGE_TYPE_LABELS[type] || type || "—";
}

export const CONTRACT_STATUS_LABELS = Object.freeze({
  DRAFT: "Draft",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
});

export const CONTRACT_STATUS_TONES = Object.freeze({
  DRAFT: "info",
  ACTIVE: "success",
  EXPIRED: "neutral",
  TERMINATED: "danger",
});

export function contractStatusLabel(status) {
  return CONTRACT_STATUS_LABELS[status] || status || "—";
}

export function contractStatusTone(status) {
  return CONTRACT_STATUS_TONES[status] || "neutral";
}

export function isDraftContract(contract) {
  return Boolean(contract) && contract.status === "DRAFT";
}

export function isActiveContract(contract) {
  return Boolean(contract) && contract.status === "ACTIVE";
}

/* Formats the human-readable service charge, preferring the backend label. */
export function serviceChargeLabel(contract) {
  if (!contract) return "—";
  if (contract.serviceChargeLabel) return contract.serviceChargeLabel;
  const value = contract.serviceChargeValue;
  if (value === null || value === undefined || value === "") return "—";
  if (contract.serviceChargeType === "PERCENTAGE") return `${value}% of wages`;
  return `${formatMoney(value)} per worker`;
}

export function formatContractPeriod(contract) {
  if (!contract) return "—";
  const start = contract.startDate || "—";
  const end = contract.endDate ? contract.endDate : "Ongoing (open-ended)";
  return `${start} → ${end}`;
}

export const EMPTY_CONTRACT_FORM = Object.freeze({
  contractNumber: "",
  title: "",
  startDate: "",
  endDate: "",
  serviceChargeType: "PERCENTAGE",
  serviceChargeValue: "",
  paymentTermsDays: "",
  notes: "",
});

export function contractToForm(contract) {
  return {
    contractNumber: contract.contractNumber || "",
    title: contract.title || "",
    startDate: contract.startDate || "",
    endDate: contract.endDate || "",
    serviceChargeType: contract.serviceChargeType || "PERCENTAGE",
    serviceChargeValue: contract.serviceChargeValue != null ? String(contract.serviceChargeValue) : "",
    paymentTermsDays: contract.paymentTermsDays != null ? String(contract.paymentTermsDays) : "",
    notes: contract.notes || "",
  };
}

export function contractFormToPayload(form) {
  return {
    contractNumber: form.contractNumber.trim(),
    title: form.title.trim(),
    startDate: form.startDate,
    endDate: form.endDate ? form.endDate : null,
    serviceChargeType: form.serviceChargeType,
    serviceChargeValue: Number(form.serviceChargeValue),
    paymentTermsDays: form.paymentTermsDays === "" ? null : Number(form.paymentTermsDays),
    notes: form.notes.trim(),
  };
}

export function validateContractForm(form) {
  const errors = {};

  const number = form.contractNumber.trim();
  if (!number) errors.contractNumber = "Contract number is required.";
  else if (number.length > 60) errors.contractNumber = "Contract number must be 60 characters or fewer.";

  if (form.title && form.title.length > 200) errors.title = "Title must be 200 characters or fewer.";

  if (!form.startDate) errors.startDate = "Start date is required.";

  if (form.endDate) {
    if (form.startDate && form.endDate < form.startDate) {
      errors.endDate = "End date must be on or after the start date.";
    }
  }

  if (!form.serviceChargeType) errors.serviceChargeType = "Choose a service charge type.";

  const value = Number(form.serviceChargeValue);
  if (form.serviceChargeValue === "" || !Number.isFinite(value)) {
    errors.serviceChargeValue = "Enter the service charge value.";
  } else if (value < 0) {
    errors.serviceChargeValue = "Service charge cannot be negative.";
  } else if (value > MAX_SERVICE_CHARGE_VALUE) {
    errors.serviceChargeValue = `Service charge must be ${MAX_SERVICE_CHARGE_VALUE} or less.`;
  } else if (form.serviceChargeType === "PERCENTAGE" && value > MAX_SERVICE_CHARGE_PERCENT) {
    errors.serviceChargeValue = "A percentage service charge cannot exceed 100%. Did you mean fixed per worker?";
  }

  if (form.paymentTermsDays !== "" && form.paymentTermsDays != null) {
    const days = Number(form.paymentTermsDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      errors.paymentTermsDays = "Payment terms must be a whole number of days between 0 and 365.";
    }
  }

  if (form.notes && form.notes.length > 2000) errors.notes = "Notes must be 2000 characters or fewer.";

  return errors;
}

const DOCUMENT_ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

export function validateContractDocument(file) {
  if (!file) return "Please choose a PDF or image file.";
  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isImage = type.startsWith("image/") || DOCUMENT_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!isPdf && !isImage) return "Only PDF or image files (PNG, JPEG, GIF) are accepted.";
  if (typeof file.size === "number" && file.size > MAX_CONTRACT_DOCUMENT_BYTES) {
    return "The document must be 10 MB or smaller.";
  }
  if (typeof file.size === "number" && file.size === 0) {
    return "The selected file is empty. Please choose a valid document.";
  }
  return null;
}
