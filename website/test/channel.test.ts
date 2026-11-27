import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isBeta, releaseLine } from "../src/lib/channel.ts";

describe("the footer's release line", () => {
  it("names the latest release on production and PR Previews", () => {
    expect(releaseLine({ channel: undefined, version: "1.3.2", commit: undefined })).toBe("Documents Archidocs v1.3.2, the latest release.");
    expect(releaseLine({ channel: "", version: "1.3.2", commit: "abc1234" })).toBe("Documents Archidocs v1.3.2, the latest release.");
  });

  it("names the beta branch and commit on the staging site", () => {
    expect(releaseLine({ channel: "beta", version: "1.3.2", commit: "abc1234" })).toBe("Documents the beta branch at abc1234, ahead of the latest release, v1.3.2.");
  });

  it("leaves the commit out when the build has no git", () => {
    expect(releaseLine({ channel: "beta", version: "1.3.2", commit: undefined })).toBe("Documents the beta branch, ahead of the latest release, v1.3.2.");
  });
});

describe("the beta badge beside the site title", () => {
  it("shows only on the staging build of the beta branch", () => {
    expect(isBeta("beta")).toBe(true);
    expect(isBeta(undefined)).toBe(false);
    expect(isBeta("")).toBe(false);
  });
});

describe("the documented version", () => {
  const load = async () => {
    vi.resetModules();
    return (await import("../src/lib/repo.ts")).VERSION;
  };
  afterEach(() => vi.unstubAllEnvs());

  it("comes from ARCHIDOCS_DOCS_VERSION when set", async () => {
    vi.stubEnv("ARCHIDOCS_DOCS_VERSION", "9.8.7");
    expect(await load()).toBe("9.8.7");
  });

  it("falls back to the root package.json", async () => {
    vi.stubEnv("ARCHIDOCS_DOCS_VERSION", "");
    const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
    expect(await load()).toBe(version);
  });
});
