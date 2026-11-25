import { afterEach, describe, expect, it, vi } from "vitest";
import { INDEX_PATH, LATEST_BUNDLE_PATH, openSite, pastBundlePath, readIndex, type Migration, type RevisionEntry } from "../../src/revisions/index.ts";
import { bundleText } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { memoryReader } from "../support/site-reader.ts";

const [NOW, PAST, DROPPED] = ["c", "b", "a"].map((c) => c.repeat(40)) as [string, string, string];
const entry = (sha: string, bundle = true): RevisionEntry => ({
  sha,
  date: "2026-02-10T12:00:00Z",
  subject: "A Revision",
  author: "Ana Author",
  tags: [],
  counts: { added: 0, removed: 0, changed: 0 },
  changedIds: [],
  bundle,
});
const indexText = (extra: Record<string, unknown> = {}) => JSON.stringify({ schemaVersion: 1, revisions: [entry(NOW), entry(PAST), entry(DROPPED, false)], ...extra });

/** A made-up version 0 that called Deployment Targets `infrastructure` and had no ADRs, as in test/history/migrate.test.ts. */
const chain: Record<number, Migration> = { 0: ({ infrastructure, ...b }) => ({ ...b, targets: infrastructure, adrs: [] }) };
async function atVersion0(sha: string): Promise<string> {
  const old = JSON.parse(await bundleText(validWorkspace, sha));
  old.schemaVersion = 0;
  old.infrastructure = old.targets;
  delete old.targets;
  delete old.adrs;
  return JSON.stringify(old);
}

async function files() {
  return { [LATEST_BUNDLE_PATH]: await bundleText(validWorkspace, NOW), [INDEX_PATH]: indexText(), [pastBundlePath(PAST)]: await bundleText(validWorkspace, PAST) };
}

afterEach(() => {
  vi.useRealTimers();
});

function fakeClock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  return { advance: (ms: number) => vi.setSystemTime(Date.now() + ms) };
}

describe("openSite", () => {
  it("reads the latest Bundle, the index and a past Bundle", async () => {
    const site = openSite(memoryReader(await files()).reader, { recheckMs: 60_000 });
    expect((await site.latest()).commit).toBe(NOW);
    expect(await site.index()).toMatchObject({ ok: true, index: { schemaVersion: 1, revisions: [{ sha: NOW }, { sha: PAST }, { sha: DROPPED }] } });
    expect(await site.bundle(entry(PAST))).toMatchObject({ ok: true, bundle: { commit: PAST } });
    expect(site.location).toBe(`memory:/${LATEST_BUNDLE_PATH}`);
  });

  it("reads the latest Bundle from another path when given one", async () => {
    const site = openSite(memoryReader({ "custom.json": await bundleText(validWorkspace, NOW) }).reader, { recheckMs: 60_000, bundle: "custom.json" });
    expect((await site.latest()).commit).toBe(NOW);
  });

  it("reads each past Bundle once", async () => {
    const memory = memoryReader(await files());
    const site = openSite(memory.reader, { recheckMs: 60_000 });
    const [one, two] = await Promise.all([site.bundle(entry(PAST)), site.bundle(entry(PAST))]);
    expect(one).toBe(two);
    expect(await site.bundle(entry(PAST))).toBe(one);
    expect(memory.readsOf(pastBundlePath(PAST))).toHaveLength(1);
  });

  it("asks again for a past Bundle it failed to read", async () => {
    const memory = memoryReader({ ...(await files()), [pastBundlePath(PAST)]: new Error("memory:/bundles/b… answered 503") });
    const site = openSite(memory.reader, { recheckMs: 60_000 });
    expect(await site.bundle(entry(PAST))).toMatchObject({ ok: false, code: "history_unavailable", reason: "unreadable", message: expect.stringContaining("503") });
    memory.set(pastBundlePath(PAST), await bundleText(validWorkspace, PAST));
    expect(await site.bundle(entry(PAST))).toMatchObject({ ok: true, bundle: { commit: PAST } });
    expect(memory.readsOf(pastBundlePath(PAST))).toHaveLength(2);
  });

  it("reports a dropped, missing, unreadable or unmigratable past Bundle as history_unavailable, with a reason", async () => {
    const OLD = "e".repeat(40);
    const BROKEN = "f".repeat(40);
    const memory = memoryReader({ ...(await files()), [pastBundlePath(OLD)]: await atVersion0(OLD), [pastBundlePath(BROKEN)]: "<html>" });
    const site = openSite(memory.reader, { recheckMs: 60_000 });
    expect(await site.bundle(entry(DROPPED, false))).toEqual({
      ok: false,
      code: "history_unavailable",
      reason: "dropped",
      message: `The Bundle at aaaaaaa (2026-02-10T12:00:00Z) was not kept on this site.`,
    });
    expect(memory.readsOf(pastBundlePath(DROPPED))).toEqual([]);
    expect(await site.bundle(entry("d".repeat(40)))).toMatchObject({ reason: "missing", message: expect.stringContaining("can't be read from the site") });
    expect(await site.bundle(entry(BROKEN))).toMatchObject({ reason: "unreadable", message: expect.stringContaining("is not JSON") });
    expect(await site.bundle(entry(OLD))).toMatchObject({ reason: "unmigratable", message: "The Bundle at eeeeeee has a schema this Archidocs can't read or migrate." });
  });

  it("migrates a latest and a past Bundle at an older schema", async () => {
    const memory = memoryReader({ ...(await files()), [LATEST_BUNDLE_PATH]: await atVersion0(NOW), [pastBundlePath(PAST)]: await atVersion0(PAST) });
    const site = openSite(memory.reader, { recheckMs: 60_000, migrations: chain });
    const current = JSON.parse(await bundleText(validWorkspace, NOW));
    expect(await site.latest()).toEqual({ ...current, adrs: [] });
    expect(await site.bundle(entry(PAST))).toMatchObject({ ok: true, bundle: { commit: PAST, schemaVersion: 1, targets: current.targets, adrs: [] } });
  });

  it("refuses a latest Bundle that is missing, not JSON, or newer than this Archidocs", async () => {
    const newer = JSON.stringify({ ...JSON.parse(await bundleText(validWorkspace, NOW)), schemaVersion: 2 });
    const open = (text?: string) => openSite(memoryReader(text === undefined ? {} : { [LATEST_BUNDLE_PATH]: text }).reader, { recheckMs: 60_000 });
    await expect(open().latest()).rejects.toThrow(`memory:/${LATEST_BUNDLE_PATH} was not found.`);
    await expect(open("{").latest()).rejects.toThrow(`memory:/${LATEST_BUNDLE_PATH} is not JSON.`);
    await expect(open(newer).latest()).rejects.toThrow(`memory:/${LATEST_BUNDLE_PATH} is not a Workspace Bundle this version can read.`);
  });

  it("gives no history for a missing index, and history_unavailable for one it can't read", async () => {
    const open = async (index?: string) => {
      const all: Record<string, string> = await files();
      if (index === undefined) delete all[INDEX_PATH];
      else all[INDEX_PATH] = index;
      return openSite(memoryReader(all).reader, { recheckMs: 60_000 }).index();
    };
    expect(await open()).toEqual({ ok: true, index: undefined });
    expect(await open(indexText({ schemaVersion: 2 }))).toEqual({ ok: false, code: "history_unavailable", reason: "index", message: "The site's bundles/index.json holds no Revisions." });
    expect(await open("{ revisions")).toMatchObject({ ok: false, reason: "index", message: expect.stringContaining("no readable Revision index") });
  });

  it("re-checks the latest Bundle and the index at most every recheckMs, with conditional requests", async () => {
    const clock = fakeClock();
    const memory = memoryReader(await files());
    const site = openSite(memory.reader, { recheckMs: 60_000 });
    await site.latest();
    await site.index();

    // Within the window nothing is read, even after the site changes.
    memory.set(LATEST_BUNDLE_PATH, await bundleText(validWorkspace, PAST));
    clock.advance(59_000);
    expect((await site.latest()).commit).toBe(NOW);
    expect(await site.index()).toMatchObject({ ok: true });
    expect(memory.reads).toHaveLength(2);

    // After it, each file is asked for again with the ETag held: the changed Bundle is read, the index is a 304.
    clock.advance(2_000);
    expect((await site.latest()).commit).toBe(PAST);
    const before = (await site.index()) as { ok: true; index: unknown };
    expect(memory.readsOf(LATEST_BUNDLE_PATH)[1]).toMatchObject({ validators: { etag: expect.any(String) }, answer: "text" });
    expect(memory.readsOf(INDEX_PATH)[1]).toMatchObject({ validators: { etag: expect.any(String) }, answer: "not_modified" });

    // A 304 keeps the index it held, and restarts the window.
    clock.advance(30_000);
    expect(((await site.index()) as { ok: true; index: unknown }).index).toBe(before.index);
    expect(memory.readsOf(INDEX_PATH)).toHaveLength(2);
  });

  it("reads once per page load with recheckMs Infinity", async () => {
    const clock = fakeClock();
    const memory = memoryReader(await files());
    const site = openSite(memory.reader, { recheckMs: Infinity });
    await site.latest();
    await site.index();
    clock.advance(365 * 24 * 3_600_000);
    await site.latest();
    await site.index();
    expect(memory.reads).toHaveLength(2);
  });

  it("asks again for an index it couldn't read", async () => {
    const memory = memoryReader({ ...(await files()), [INDEX_PATH]: new Error("down") });
    const site = openSite(memory.reader, { recheckMs: 60_000 });
    expect(await site.index()).toMatchObject({ ok: false, message: "The site has no readable Revision index (bundles/index.json): down" });
    memory.set(INDEX_PATH, indexText());
    expect(await site.index()).toMatchObject({ ok: true });
  });
});

describe("readIndex", () => {
  it("keeps a preview mark only when it names a base sha", () => {
    const base = { schemaVersion: 1, revisions: [] };
    expect(readIndex({ ...base, preview: { base: "main", baseSha: NOW, headSha: PAST } })).toEqual({ ...base, preview: { base: "main", baseSha: NOW, headSha: PAST } });
    expect(readIndex({ ...base, preview: { base: "main" } })).toEqual(base);
    expect(readIndex({ schemaVersion: 1 })).toBeUndefined();
    expect(readIndex(null)).toBeUndefined();
  });
});
