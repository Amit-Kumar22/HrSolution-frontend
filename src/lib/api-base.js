const RAW_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://76.13.245.49:8085";

const TRIMMED = String(RAW_BASE).replace(/\/+$/, "");

export const API_ORIGIN = TRIMMED.replace(/\/api\/v1$/i, "");

export const SERVER_API_BASE = `${API_ORIGIN}/api/v1`;

/* The browser talks to the Next server on the same origin (/api/v1), whose
   route handler in src/app/api/v1/[...path]/route.js forwards to the backend
   without the Origin header. Server-side rendering calls the backend directly. */
export const API_BASE = typeof window === "undefined" ? SERVER_API_BASE : "/api/v1";
