import { describe, expect, it } from "vitest";
import { checkHost, checkRequest, isLoopbackHostname, parseHostHeader } from "./request-guard";

const req = (method: string, headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/x", { method, headers });
const SAME = {
  host: "localhost:3000",
  origin: "http://localhost:3000",
  "content-type": "application/json",
};

describe("Host validation (SEC-10, DNS rebinding)", () => {
  it.each([
    "localhost",
    "localhost:3000",
    "127.0.0.1:3000",
    "127.1.2.3",
    "[::1]:3000",
    "LOCALHOST",
  ])("accepts loopback host %s", (host) =>
    expect(checkHost(new Headers({ host }))).toEqual({ ok: true }),
  );

  it.each([
    "evil.com",
    "evil.com:3000",
    "192.168.1.10:3000",
    "0.0.0.0:3000",
    "localhost.evil.com",
    "[::2]",
  ])("rejects non-loopback host %s", (host) =>
    expect(checkHost(new Headers({ host }))).toMatchObject({ ok: false, status: 403 }),
  );

  it("rejects missing or malformed hosts", () => {
    expect(checkHost(new Headers())).toMatchObject({ ok: false, status: 400 });
    expect(checkHost(new Headers({ host: "a b" }))).toMatchObject({ ok: false, status: 400 });
    expect(checkHost(new Headers({ host: "x:99999999" }))).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("accepts explicitly allowed hosts", () => {
    expect(checkHost(new Headers({ host: "devbox.lan:3000" }), ["DevBox.lan"])).toEqual({
      ok: true,
    });
  });

  it("helpers", () => {
    expect(parseHostHeader("[::1]:80")).toEqual({ hostname: "[::1]", port: "80" });
    expect(parseHostHeader("Example.COM")).toEqual({ hostname: "example.com", port: "" });
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("128.0.0.1")).toBe(false);
  });
});

describe("TEST-07 unsafe request origins (SEC-07)", () => {
  it("allows safe methods without Origin", () => {
    expect(checkRequest(req("GET", { host: "localhost:3000" }))).toEqual({ ok: true });
    expect(checkRequest(req("HEAD", { host: "localhost:3000" }))).toEqual({ ok: true });
  });

  it("still enforces Host on safe methods", () => {
    expect(checkRequest(req("GET", { host: "evil.com" }))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("allows same-origin JSON writes", () => {
    expect(checkRequest(req("PUT", SAME))).toEqual({ ok: true });
    expect(checkRequest(req("POST", { ...SAME, "sec-fetch-site": "same-origin" }))).toEqual({
      ok: true,
    });
    expect(
      checkRequest(req("POST", { ...SAME, "content-type": "application/json; charset=utf-8" })),
    ).toEqual({ ok: true });
    expect(checkRequest(req("DELETE", { host: SAME.host, origin: SAME.origin }))).toEqual({
      ok: true,
    });
  });

  it.each([
    ["missing Origin", { host: SAME.host, "content-type": "application/json" }, 403],
    ["cross-site fetch metadata", { ...SAME, "sec-fetch-site": "cross-site" }, 403],
    ["same-site (other port/subdomain)", { ...SAME, "sec-fetch-site": "same-site" }, 403],
    ["foreign Origin", { ...SAME, origin: "https://evil.com" }, 403],
    ["Origin with different port", { ...SAME, origin: "http://localhost:4000" }, 403],
    ["null Origin", { ...SAME, origin: "null" }, 403],
    ["non-http Origin", { ...SAME, origin: "file://localhost:3000" }, 403],
    ["form content type", { ...SAME, "content-type": "application/x-www-form-urlencoded" }, 415],
    ["text/plain (CORS-simple)", { ...SAME, "content-type": "text/plain" }, 415],
    ["missing content type", { host: SAME.host, origin: SAME.origin }, 415],
    ["json lookalike", { ...SAME, "content-type": "application/jsonp" }, 415],
  ])("rejects %s", (_name, headers, status) => {
    expect(checkRequest(req("POST", headers as Record<string, string>))).toMatchObject({
      ok: false,
      status,
    });
  });
});
