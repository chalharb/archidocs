/**
 * Request-origin protection (SEC-07) and Host validation (SEC-10).
 *
 * Uses only Web-standard APIs so it can run in the Next.js proxy as well as in
 * route handlers (defence in depth).
 *
 * - Every request must carry a Host header naming a loopback address or an
 *   explicitly allowed host. This blocks DNS-rebinding attacks against an
 *   unauthenticated local server.
 * - State-changing requests additionally need a same-origin `Origin`, no
 *   cross-site `Sec-Fetch-Site`, and a JSON content type (which browsers cannot
 *   send cross-origin without a CORS preflight that this server never approves).
 */

export type GuardResult = { ok: true } | { ok: false; status: 400 | 403 | 415; reason: string };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Split "host:port" / "[v6]:port" into hostname (lower-case, brackets kept) and port. */
export function parseHostHeader(value: string): { hostname: string; port: string } | null {
  const match = /^(\[[0-9a-fA-F:.]+\]|[^:[\]\s/]+)(?::(\d{1,5}))?$/.exec(value.trim());
  if (!match) return null;
  return { hostname: match[1]!.toLowerCase(), port: match[2] ?? "" };
}

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "[::1]" || /^127(\.\d{1,3}){3}$/.test(h);
}

export function checkHost(headers: Headers, allowedHosts: readonly string[] = []): GuardResult {
  const host = headers.get("host");
  if (!host) return { ok: false, status: 400, reason: "Missing Host header" };
  const parsed = parseHostHeader(host);
  if (!parsed) return { ok: false, status: 400, reason: "Malformed Host header" };
  const allowed =
    isLoopbackHostname(parsed.hostname) ||
    allowedHosts.map((h) => h.toLowerCase()).includes(parsed.hostname);
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      reason: `Host '${parsed.hostname}' is not allowed; this unauthenticated server only accepts loopback requests`,
    };
  }
  return { ok: true };
}

export function checkRequest(request: Request, allowedHosts: readonly string[] = []): GuardResult {
  const host = checkHost(request.headers, allowedHosts);
  if (!host.ok || SAFE_METHODS.has(request.method.toUpperCase())) return host;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") {
    return {
      ok: false,
      status: 403,
      reason: `Cross-site request rejected (Sec-Fetch-Site: ${fetchSite})`,
    };
  }
  const origin = request.headers.get("origin");
  if (!origin)
    return {
      ok: false,
      status: 403,
      reason: "State-changing requests must include an Origin header",
    };
  let originHost: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
    originHost = url.host.toLowerCase();
  } catch {
    return { ok: false, status: 403, reason: "Invalid Origin header" };
  }
  if (originHost !== request.headers.get("host")!.trim().toLowerCase()) {
    return { ok: false, status: 403, reason: `Origin '${origin}' does not match this server` };
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (
    request.method.toUpperCase() !== "DELETE" &&
    !/^application\/json\s*(;|$)/i.test(contentType)
  ) {
    return {
      ok: false,
      status: 415,
      reason: "State-changing requests must use Content-Type: application/json",
    };
  }
  return { ok: true };
}
