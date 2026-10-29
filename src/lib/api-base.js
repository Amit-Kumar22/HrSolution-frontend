const RAW_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://76.13.245.49:8085";

const TRIMMED = String(RAW_BASE).replace(/\/+$/, "");

export const API_ORIGIN = TRIMMED.replace(/\/api\/v1$/i, "");
export const API_BASE = /\/api\/v1$/i.test(TRIMMED) ? TRIMMED : `${TRIMMED}/api/v1`;
