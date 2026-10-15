/**
 * Field metadata, conversion and validation for the company profile.
 *
 * <p>The patterns and length limits mirror the backend
 * {@code UpdateCompanySettingsRequest} and {@code IndianFormats} exactly, so a
 * value that passes here is very unlikely to be rejected by the server. Every
 * Indian-format pattern allows an empty string (the backend uses {@code ^$|...}
 * and treats a cleared field as valid), which is why validation only applies a
 * pattern when the field has a value.
 */

const PATTERNS = {
  gstStateCode: { re: /^[0-3][0-9]$/, message: "must be a two-digit GST state code, e.g. 27" },
  pincode: { re: /^[1-9][0-9]{5}$/, message: "must be a valid 6-digit PIN code" },
  phone: { re: /^[0-9+()\-\s]{7,20}$/, message: "must be a valid phone number" },
  gstin: {
    re: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    message: "must be a valid 15-character GSTIN, e.g. 27AABCS1234A1Z5",
  },
  pan: { re: /^[A-Z]{5}[0-9]{4}[A-Z]$/, message: "must be a valid 10-character PAN, e.g. AABCS1234A" },
  tan: { re: /^[A-Z]{4}[0-9]{5}[A-Z]$/, message: "must be a valid 10-character TAN, e.g. PNEA12345B" },
  cin: {
    re: /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
    message: "must be a valid 21-character CIN",
  },
  bankAccount: { re: /^[0-9]{9,18}$/, message: "must be a valid bank account number (9-18 digits)" },
  bankIfsc: { re: /^[A-Z]{4}0[A-Z0-9]{6}$/, message: "must be a valid 11-character IFSC, e.g. HDFC0001234" },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The profile form, grouped for display. Each field carries everything the
 * form and the validator need, so labels and limits are defined once.
 */
export const COMPANY_PROFILE_GROUPS = [
  {
    key: "identity",
    title: "Identity",
    description: "The registered and brand names shown on the website, invoices, payslips and emails.",
    fields: [
      {
        name: "legalName",
        label: "Legal name",
        required: true,
        maxLength: 200,
        placeholder: "Shree Manpower Services Private Limited",
      },
      {
        name: "tradeName",
        label: "Trade name",
        maxLength: 200,
        hint: "Brand name, when it differs from the registered legal name.",
        placeholder: "Shree Manpower",
      },
      {
        name: "tagline",
        label: "Tagline",
        maxLength: 300,
        full: true,
        placeholder: "Reliable contract staffing across India",
      },
      { name: "about", label: "About the company", type: "textarea", maxLength: 2000, full: true },
    ],
  },
  {
    key: "address",
    title: "Registered address",
    description: "Used on invoices and statutory documents. The GST state code decides CGST+SGST versus IGST.",
    fields: [
      { name: "addressLine1", label: "Address line 1", maxLength: 200 },
      { name: "addressLine2", label: "Address line 2", maxLength: 200 },
      { name: "city", label: "City", maxLength: 100, placeholder: "Pune" },
      { name: "state", label: "State", maxLength: 100, placeholder: "Maharashtra" },
      {
        name: "stateCode",
        label: "GST state code",
        pattern: "gstStateCode",
        maxLength: 2,
        hint: "Two digits, e.g. 27 for Maharashtra.",
        placeholder: "27",
      },
      { name: "pincode", label: "PIN code", pattern: "pincode", maxLength: 6, placeholder: "411001" },
      { name: "country", label: "Country", maxLength: 100, placeholder: "India" },
    ],
  },
  {
    key: "contact",
    title: "Contact",
    description: "How clients and candidates reach the company.",
    fields: [
      { name: "phone", label: "Primary phone", pattern: "phone", placeholder: "+91 20 1234 5678" },
      { name: "alternatePhone", label: "Alternate phone", pattern: "phone" },
      { name: "email", label: "Email address", email: true, maxLength: 180, placeholder: "info@example.com" },
      { name: "supportEmail", label: "Support email", email: true, maxLength: 180 },
      { name: "website", label: "Website", maxLength: 200, full: true, placeholder: "https://example.com" },
    ],
  },
  {
    key: "statutory",
    title: "Statutory registrations",
    description: "Registration numbers printed on invoices and statutory returns.",
    fields: [
      { name: "gstin", label: "GSTIN", pattern: "gstin", maxLength: 15, placeholder: "27AABCS1234A1Z5" },
      { name: "pan", label: "PAN", pattern: "pan", maxLength: 10, placeholder: "AABCS1234A" },
      { name: "tan", label: "TAN", pattern: "tan", maxLength: 10, placeholder: "PNEA12345B" },
      { name: "cin", label: "CIN", pattern: "cin", maxLength: 21 },
      { name: "pfEstablishmentCode", label: "PF establishment code", maxLength: 30 },
      { name: "esiEstablishmentCode", label: "ESI establishment code", maxLength: 30 },
      { name: "ptRegistrationNumber", label: "PT registration number", maxLength: 30 },
    ],
  },
  {
    key: "bank",
    title: "Bank details",
    description: "Printed on invoices so clients can pay. Account number and IFSC are validated for shape.",
    fields: [
      { name: "bankName", label: "Bank name", maxLength: 120 },
      { name: "bankBranch", label: "Bank branch", maxLength: 120 },
      { name: "bankAccountNumber", label: "Bank account number", pattern: "bankAccount", maxLength: 18 },
      { name: "bankIfsc", label: "Bank IFSC", pattern: "bankIfsc", maxLength: 11, placeholder: "HDFC0001234" },
    ],
  },
  {
    key: "social",
    title: "Social links",
    description: "Shown in the website footer when present.",
    fields: [
      { name: "linkedinUrl", label: "LinkedIn", maxLength: 300 },
      { name: "facebookUrl", label: "Facebook", maxLength: 300 },
      { name: "twitterUrl", label: "Twitter / X", maxLength: 300 },
      { name: "instagramUrl", label: "Instagram", maxLength: 300 },
    ],
  },
];

/** Every editable field, in the order the backend request declares them. */
export const COMPANY_PROFILE_FIELDS = COMPANY_PROFILE_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.name),
);

export const EMPTY_COMPANY_FORM = Object.freeze(
  Object.fromEntries(COMPANY_PROFILE_FIELDS.map((name) => [name, ""])),
);

/** Maps a CompanySettingsResponse into form strings (null/undefined become ""). */
export function companySettingsToForm(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const form = {};
  for (const name of COMPANY_PROFILE_FIELDS) {
    const value = source[name];
    form[name] = value === null || value === undefined ? "" : String(value);
  }
  return form;
}

/**
 * Builds the PUT body: every editable field, trimmed. Deliberately omits
 * logoPath, updatedAt and updatedBy - the backend manages those.
 */
export function companyFormToPayload(form) {
  const payload = {};
  for (const name of COMPANY_PROFILE_FIELDS) {
    payload[name] = typeof form[name] === "string" ? form[name].trim() : "";
  }
  return payload;
}

/** Returns a field->message map; empty when the form is valid. */
export function validateCompanyForm(form) {
  const errors = {};
  const valueOf = (name) => (typeof form[name] === "string" ? form[name].trim() : "");

  for (const group of COMPANY_PROFILE_GROUPS) {
    for (const field of group.fields) {
      const value = valueOf(field.name);
      if (field.required && !value) {
        errors[field.name] = `${field.label} is required.`;
        continue;
      }
      if (!value) continue;
      if (field.maxLength && value.length > field.maxLength) {
        errors[field.name] = `${field.label} must be ${field.maxLength} characters or fewer.`;
        continue;
      }
      if (field.email && !EMAIL_PATTERN.test(value)) {
        errors[field.name] = "must be a valid email address";
        continue;
      }
      if (field.pattern) {
        const rule = PATTERNS[field.pattern];
        if (rule && !rule.re.test(value)) errors[field.name] = rule.message;
      }
    }
  }

  return errors;
}
