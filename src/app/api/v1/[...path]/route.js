const API_BASE_URL = (process.env.API_BASE_URL || "http://76.13.245.49:8085").replace(/\/+$/, "");

const REQUEST_HEADER_IGNORE = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "keep-alive",
  "upgrade",
  "content-length",
  "accept-encoding",
  "transfer-encoding",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "sec-fetch-user",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
  "via",
  "expect",
]);

const RESPONSE_HEADER_IGNORE = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
  "set-cookie",
]);

function buildTargetUrl(request) {
  const incoming = new URL(request.url);
  const backend = new URL(API_BASE_URL);
  const basePath = backend.pathname.replace(/\/+$/, "");
  return new URL(`${backend.origin}${basePath}${incoming.pathname}${incoming.search}`);
}

function buildRequestHeaders(request) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!REQUEST_HEADER_IGNORE.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("accept-encoding", "identity");
  return headers;
}

async function proxy(request) {
  const method = request.method.toUpperCase();
  const init = {
    method,
    headers: buildRequestHeaders(request),
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let backendResponse;
  try {
    backendResponse = await fetch(buildTargetUrl(request), init);
  } catch (error) {
    const timedOut = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json(
      {
        detail: timedOut
          ? "The service took too long to respond. Please try again."
          : "Could not connect to the service. Check your connection and try again.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }

  const headers = new Headers();
  backendResponse.headers.forEach((value, key) => {
    if (!RESPONSE_HEADER_IGNORE.has(key.toLowerCase())) headers.set(key, value);
  });
  if (typeof backendResponse.headers.getSetCookie === "function") {
    for (const cookie of backendResponse.headers.getSetCookie()) headers.append("set-cookie", cookie);
  }

  const status = backendResponse.status;
  const body = status === 204 || status === 205 || status === 304
    ? null
    : await backendResponse.arrayBuffer();

  return new Response(body, { status, statusText: backendResponse.statusText, headers });
}

export async function GET(request) {
  return proxy(request);
}

export async function POST(request) {
  return proxy(request);
}

export async function PUT(request) {
  return proxy(request);
}

export async function PATCH(request) {
  return proxy(request);
}

export async function DELETE(request) {
  return proxy(request);
}

export async function HEAD(request) {
  return proxy(request);
}

export async function OPTIONS(request) {
  return proxy(request);
}
