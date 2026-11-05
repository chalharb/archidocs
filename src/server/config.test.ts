import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_WORKSPACE, readConfig } from "./config";

describe("readConfig", () => {
  it("defaults to the sample workspace, watching on, no extra hosts", () => {
    expect(readConfig({}, "/app")).toEqual({
      workspaces: [{ key: "sample-workspace", root: path.resolve("/app", DEFAULT_WORKSPACE) }],
      allowedHosts: [],
      watch: true,
      maxFileBytes: 1024 * 1024,
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

describe("SEC-01: loopback binding by default", () => {
  it("dev and start scripts bind to 127.0.0.1", async () => {
    const pkg = (await import("../../package.json", { with: { type: "json" } })).default as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.dev).toMatch(/-H 127\.0\.0\.1\b/);
    expect(pkg.scripts.start).toMatch(/-H 127\.0\.0\.1\b/);
  });
});
