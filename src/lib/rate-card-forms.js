export const MAX_RATE_MONEY = 9999999.99;
export const MAX_OT_RATE = 99999.99;

export function todayDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `₹${number.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatMargin(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const sign = number < 0 ? "−" : "+";
  return `${sign}${formatMoney(Math.abs(number))}`;
}

export function isFutureRate(rate) {
  if (!rate || !rate.effectiveFrom) return false;
  return rate.effectiveFrom > todayDateString();
}

export function rateCardStatus(rate) {
  if (!rate) return "historical";
  if (rate.current) return "current";
  if (rate.effectiveFrom && rate.effectiveFrom > todayDateString()) return "future";
  return "historical";
}

export const RATE_STATUS_LABELS = Object.freeze({
  current: "Current",
  future: "Upcoming",
  historical: "Historical",
});

export const RATE_STATUS_TONES = Object.freeze({
  current: "success",
  future: "accent",
  historical: "neutral",
});

export const EMPTY_RATE_CARD_FORM = Object.freeze({
  categoryId: "",
  siteId: "",
  monthlyWage: "",
  billingRate: "",
  otRatePerHour: "",
  shiftHours: "8",
  effectiveFrom: "",
  notes: "",
});

export function rateCardToForm(rate) {
  return {
    categoryId: rate.categoryId != null ? String(rate.categoryId) : "",
    siteId: rate.siteId != null ? String(rate.siteId) : "",
    monthlyWage: rate.monthlyWage != null ? String(rate.monthlyWage) : "",
    billingRate: rate.billingRate != null ? String(rate.billingRate) : "",
    otRatePerHour: rate.otRatePerHour != null ? String(rate.otRatePerHour) : "",
    shiftHours: rate.shiftHours != null ? String(rate.shiftHours) : "8",
    effectiveFrom: rate.effectiveFrom || "",
    notes: rate.notes || "",
  };
}

export function rateCardFormToPayload(form) {
  const payload = {
    categoryId: Number(form.categoryId),
    siteId: form.siteId === "" || form.siteId == null ? null : Number(form.siteId),
    monthlyWage: Number(form.monthlyWage),
    billingRate: Number(form.billingRate),
    shiftHours: Number(form.shiftHours || 8),
    effectiveFrom: form.effectiveFrom,
    notes: form.notes.trim(),
  };
  if (form.otRatePerHour !== "" && form.otRatePerHour != null) {
    payload.otRatePerHour = Number(form.otRatePerHour);
  }
  return payload;
}

export function isBillingBelowWage(form) {
  if (form.monthlyWage === "" || form.billingRate === "") return false;
  const wage = Number(form.monthlyWage);
  const billing = Number(form.billingRate);
  return Number.isFinite(wage) && Number.isFinite(billing) && billing < wage;
}

export function validateRateCardForm(form) {
  const errors = {};

  if (!form.categoryId) errors.categoryId = "Choose a manpower category.";

  const wage = Number(form.monthlyWage);
  if (form.monthlyWage === "" || !Number.isFinite(wage)) {
    errors.monthlyWage = "Enter the monthly wage.";
  } else if (wage < 0) {
    errors.monthlyWage = "Monthly wage cannot be negative.";
  } else if (wage > MAX_RATE_MONEY) {
    errors.monthlyWage = `Monthly wage must be ${MAX_RATE_MONEY} or less.`;
  }

  const billing = Number(form.billingRate);
  if (form.billingRate === "" || !Number.isFinite(billing)) {
    errors.billingRate = "Enter the billing rate.";
  } else if (billing < 0) {
    errors.billingRate = "Billing rate cannot be negative.";
  } else if (billing > MAX_RATE_MONEY) {
    errors.billingRate = `Billing rate must be ${MAX_RATE_MONEY} or less.`;
  }

  if (form.otRatePerHour !== "" && form.otRatePerHour != null) {
    const ot = Number(form.otRatePerHour);
    if (!Number.isFinite(ot)) errors.otRatePerHour = "Overtime rate must be a number.";
    else if (ot < 0) errors.otRatePerHour = "Overtime rate cannot be negative.";
    else if (ot > MAX_OT_RATE) errors.otRatePerHour = `Overtime rate must be ${MAX_OT_RATE} or less.`;
  }

  const shift = Number(form.shiftHours);
  if (form.shiftHours === "" || !Number.isInteger(shift)) {
    errors.shiftHours = "Shift hours must be a whole number.";
  } else if (shift < 1 || shift > 24) {
    errors.shiftHours = "Shift hours must be between 1 and 24.";
  }

  if (!form.effectiveFrom) errors.effectiveFrom = "Choose the effective-from date.";

  if (form.notes && form.notes.length > 500) errors.notes = "Notes must be 500 characters or fewer.";

  return errors;
}