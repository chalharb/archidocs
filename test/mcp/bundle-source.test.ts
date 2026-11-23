import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bundleSource } from "../../src/mcp/index.ts";
import { bundleText, serveBundleSite } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { connectTo } from "../support/mcp.ts";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

afterEach(() => {
  vi.useRealTimers();
});

/** Fakes only the clock, so the 60 s re-check window can pass instantly while real HTTP still runs. */
function fakeClock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  return { advance: (ms: number) => vi.setSystemTime(Date.now() + ms) };
}

const commitOf = async (call: (name: string) => Promise<{ structuredContent?: Record<string, unknown> }>) =>
  (await call("get_workspace_info")).structuredContent!.commit;

describe("a Bundle source", () => {
  it("answers from a published Bundle and reports itself as read-only", async () => {
    const site = await serveBundleSite(await bundleText(validWorkspace, SHA_A));
    const { call, text } = await connectTo(bundleSource({ location: site.url }));
    const result = await call("get_workspace_info");
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      source: { kind: "bundle", location: `${site.url}workspace.bundle.json` },
      commit: SHA_A,
      writesAllowed: false,
      counts: { projects: 2, elements: 4, teams: 2, environments: 2 },
      issues: { errors: 0, warnings: 0 },
    });
    expect(text(result)).toContain(`Workspace from a Bundle at ${SHA_A.slice(0, 7)}`);
    expect((await call("get_element", { id: "shop:web" })).structuredContent).toMatchObject({ element: { name: "Web" } });
  });

  it("picks up a changed ETag on the first call after 60 s, with conditional requests in between", async () => {
    const clock = fakeClock();
    const site = await serveBundleSite(await bundleText(validWorkspace, SHA_A));
    const { call } = await connectTo(bundleSource({ location: site.url }));
    expect(await commitOf(call)).toBe(SHA_A);
    expect(site.requests).toHaveLength(1);

    // Within 60 s the server answers from what it has, without asking the site.
    site.publish(await bundleText(validWorkspace, SHA_B));
    clock.advance(59_000);
    expect(await commitOf(call)).toBe(SHA_A);
    expect(site.requests).toHaveLength(1);

    // After 60 s it asks again, sending the ETag it holds, and gets the new Bundle.
    clock.advance(2_000);
    expect(await commitOf(call)).toBe(SHA_B);
    expect(site.requests[1]).toMatchObject({ status: 200, headers: { "if-none-match": '"v1"' } });

    // Unchanged: a 304, and the server keeps answering from the Bundle it has.
    clock.advance(61_000);
    expect(await commitOf(call)).toBe(SHA_B);
    expect(site.requests[2]).toMatchObject({ status: 304, headers: { "if-none-match": '"v2"' } });
  });

  it("sends If-Modified-Since when the host gives Last-Modified and no ETag", async () => {
    const clock = fakeClock();
    const site = await serveBundleSite(await bundleText(validWorkspace, SHA_A), { validators: "last-modified" });
    const { call } = await connectTo(bundleSource({ location: site.url }));
    expect(await commitOf(call)).toBe(SHA_A);
    clock.advance(61_000);
    expect(await commitOf(call)).toBe(SHA_A);
    expect(site.requests[1]).toMatchObject({ status: 304, headers: { "if-modified-since": "Sun, 22 Nov 2026 00:01:00 GMT" } });
    expect(site.requests[1]!.headers["if-none-match"]).toBeUndefined();
  });

  it("refetches plainly when the host gives neither validator", async () => {
    const clock = fakeClock();
    const site = await serveBundleSite(await bundleText(validWorkspace, SHA_A), { validators: "none" });
    const { call } = await connectTo(bundleSource({ location: site.url }));
    await commitOf(call);
    site.publish(await bundleText(validWorkspace, SHA_B));
    clock.advance(61_000);
    expect(await commitOf(call)).toBe(SHA_B);
    expect(site.requests[1]!.headers).not.toHaveProperty("if-none-match");
    expect(site.requests[1]!.headers).not.toHaveProperty("if-modified-since");
  });

  it("returns source_unavailable while the site is down, and recovers when it is back", async () => {
    const site = await serveBundleSite(await bundleText(validWorkspace, SHA_A));
    site.setUp(false);
    const { call } = await connectTo(bundleSource({ location: site.url }));
    const down = await call("get_element", { id: "shop:web" });
    expect(down.isError).toBe(true);
    expect(down.structuredContent).toMatchObject({ code: "source_unavailable", message: expect.stringContaining("503") });

    site.setUp(true);
    expect((await call("get_element", { id: "shop:web" })).isError).toBeFalsy();
  });

  it("returns source_unavailable when the URL doesn't hold a Bundle", async () => {
    const site = await serveBundleSite("{\"not\": \"a bundle\"}");
    const { call } = await connectTo(bundleSource({ location: `${site.url}workspace.bundle.json` }));
    expect((await call("list_teams")).structuredContent).toMatchObject({ code: "source_unavailable", message: expect.stringContaining("not a Workspace Bundle") });
  });

  it("reads a Bundle file by path, or the folder it was built into", async () => {
    const out = await mkdtemp(join(tmpdir(), "archidocs-site-"));
    await writeFile(join(out, "workspace.bundle.json"), await bundleText(validWorkspace, SHA_A));
    for (const location of [out, join(out, "workspace.bundle.json")]) {
      const { call } = await connectTo(bundleSource({ location }));
      expect((await call("get_workspace_info")).structuredContent).toMatchObject({
        source: { kind: "bundle", location: join(out, "workspace.bundle.json") },
        commit: SHA_A,
      });
    }
  });

  it("returns source_unavailable for a path that doesn't exist", async () => {
    const { call } = await connectTo(bundleSource({ location: join(tmpdir(), "archidocs-missing", "workspace.bundle.json") }));
    expect((await call("get_workspace_info")).structuredContent).toMatchObject({ code: "source_unavailable" });
  });
});
