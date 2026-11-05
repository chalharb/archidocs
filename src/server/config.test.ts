import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_WORKSPACE, allowedHostsFromEnv, readConfig } from "./config";

describe("readConfig", () => {
  it("defaults to the sample workspace, watching on, no extra hosts", () => {
    expect(readConfig({}, "/app")).toEqual({
      workspaces: [{ key: "sample-workspace", root: path.resolve("/app", DEFAULT_WORKSPACE) }],
      allowedHosts: [],
      watch: true,
      maxFileBytes: 1024 * 1024,
      readOnly: false,
    });
  });

  it("parses keyed and bare workspace entries", () => {
    const c = readConfig(
      { ARCHIDOC_WORKSPACES: "main=/data/arch, ./other ,", ARCHIDOC_ALLOWED_HOSTS: "A.lan, b.lan" },
      "/app",
    );
    expect(c.workspaces).toEqual([
      { key: "main", root: "/data/arch" },
      { key: "other", root: "/app/other" },
    ]);
    expect(c.allowedHosts).toEqual(["a.lan", "b.lan"]);
  });

  it.each(["0", "false", "NO"])("disables watching with %s", (v) => {
    expect(readConfig({ ARCHIDOC_WATCH: v }).watch).toBe(false);
  });

  it("parses the file size limit", () => {
    expect(readConfig({ ARCHIDOC_MAX_FILE_BYTES: "2048" }).maxFileBytes).toBe(2048);
  });

  it.each([
    [{ ARCHIDOC_WORKSPACES: "../bad key=/x" }, /Invalid workspace key/],
    [{ ARCHIDOC_WORKSPACES: "a=/x,a=/y" }, /Duplicate workspace key/],
    [{ ARCHIDOC_MAX_FILE_BYTES: "-1" }, /ARCHIDOC_MAX_FILE_BYTES/],
    [{ ARCHIDOC_MAX_FILE_BYTES: "abc" }, /ARCHIDOC_MAX_FILE_BYTES/],
    [{ ARCHIDOC_MAX_FILE_BYTES: String(128 * 1024 * 1024) }, /ARCHIDOC_MAX_FILE_BYTES/],
  ])("rejects invalid configuration %j", (env, message) => {
    expect(() => readConfig(env)).toThrow(ConfigError);
    expect(() => readConfig(env)).toThrow(message);
  });
});

describe("SEC-13 hosted read-only mode (ADD-010)", () => {
  const VERCEL = {
    VERCEL: "1",
    VERCEL_URL: "archidoc-abc123.vercel.app",
    VERCEL_BRANCH_URL: "archidoc-git-main.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "archidoc.vercel.app",
  };

  it("is read-only, not watching, and allows the deployment's own hosts on Vercel", () => {
    const c = readConfig({ ...VERCEL, ARCHIDOC_ALLOWED_HOSTS: "docs.example.com" });
    expect(c.readOnly).toBe(true);
    expect(c.watch).toBe(false);
    expect(c.allowedHosts).toEqual([
      "docs.example.com",
      "archidoc-abc123.vercel.app",
      "archidoc-git-main.vercel.app",
      "archidoc.vercel.app",
    ]);
  });

  it("can be overridden explicitly", () => {
    const c = readConfig({ ...VERCEL, ARCHIDOC_READ_ONLY: "false", ARCHIDOC_WATCH: "1" });
    expect(c.readOnly).toBe(false);
    expect(c.watch).toBe(true);
    expect(readConfig({ ARCHIDOC_READ_ONLY: "yes" }).readOnly).toBe(true);
    expect(readConfig({ ARCHIDOC_READ_ONLY: "maybe" }).readOnly).toBe(false);
  });

  it("ignores Vercel host variables off Vercel, and normalises hosts", () => {
    expect(allowedHostsFromEnv({ VERCEL_URL: "x.vercel.app" })).toEqual([]);
    expect(
      allowedHostsFromEnv({
        VERCEL: "1",
        VERCEL_URL: "https://X.vercel.app/path",
        ARCHIDOC_ALLOWED_HOSTS: "x.vercel.app, ",
      }),
    ).toEqual(["x.vercel.app"]);
  });
});

describe("SEC-01: loopback binding by default", () => {
  it("dev and start scripts bind to 127.0.0.1", async () => {
    const pkg = (await import("../../package.json", { with: { type: "json" } })).default as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.dev).toMatch(/-H 127\.0\.0\.1\b/);
    expect(pkg.scripts.start).toMatch(/-H 127\.0\.0\.1\b/);
  });
});
