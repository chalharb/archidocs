/**
 * Reject requests whose Host is not loopback (or explicitly allowed) before any
 * route runs (SEC-10, DNS-rebinding protection). Handlers re-check as defence in depth.
 */
import { NextResponse, type NextRequest } from "next/server";
import { allowedHostsFromEnv } from "@/server/config";
import { checkHost } from "@/server/http/request-guard";

const allowedHosts = allowedHostsFromEnv(process.env);

export function proxy(request: NextRequest) {
  const result = checkHost(request.headers, allowedHosts);
  if (!result.ok) return new NextResponse(result.reason, { status: result.status });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
