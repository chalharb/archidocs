// A zone west of UTC, so a time read as local would land hours later than one read as UTC.
process.env.TZ = "America/Los_Angeles";

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { history, pointMessage, resolvePoint } from "../../src/history/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";

/**
 * Revisions in January and February, a docs-only commit between them (tagged
 * `docs` and branched as `docs-branch`), and a March Revision whose sha starts
 * like February's.
 */
async function repo() {
  const r = await scriptedRepo();
  const january = await r.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
  const docs = await r.commit("Docs", "2026-01-20T12:00:00Z", { "README.md": "# Shop\n" });
  const february = await r.commit("Rename web", "2026-02-10T12:00:00Z", { "archidocs/shop/notes.yaml": "services:\n  notes:\n    name: Notes\n" });
  r.git("tag", "docs", docs);
  r.git("branch", "docs-branch", docs);
  return { r, january, docs, february, h: history(r.repoRoot, join(r.repoRoot, "archidocs")) };
}

describe("resolvePoint", () => {
  it("resolves refs through git, a non-Revision commit included", async () => {
    const { h, docs, february } = await repo();

    expect(await resolvePoint(h, "docs")).toEqual({ ok: true, sha: docs, ref: true });
    expect(await resolvePoint(h, "docs-branch")).toEqual({ ok: true, sha: docs, ref: true });
    expect(await resolvePoint(h, "HEAD~1")).toEqual({ ok: true, sha: docs, ref: true });
    expect(await resolvePoint(h, february)).toEqual({ ok: true, sha: february, ref: true });
  });

  it("resolves a date or a time to the last Revision, not a later docs-only commit", async () => {
    const { h, january, february } = await repo();

    expect(await resolvePoint(h, "2026-01-31")).toEqual({ ok: true, sha: january, ref: false });
    expect(await resolvePoint(h, "2026-02-10")).toEqual({ ok: true, sha: february, ref: false });
    // 08:00 UTC is before February's 12:00Z; read as Los Angeles time it would be 16:00Z, after it.
    expect(await resolvePoint(h, "2026-02-10T08:00")).toEqual({ ok: true, sha: january, ref: false });
    expect(await resolvePoint(h, "2026-02-10T08:00-08:00")).toEqual({ ok: true, sha: february, ref: false });
  });

  it("reports a date before the first Revision as not_found, naming the first Revision", async () => {
    const { h, january } = await repo();

    const result = await resolvePoint(h, "2026-01-01");

    expect(result).toMatchObject({ ok: false, kind: "not_found", first: { sha: january } });
    expect(!result.ok && pointMessage("2026-01-01", result)).toBe(
      `Unknown ref or date "2026-01-01"; a date names the last Revision at or before it. The first Revision is ${january.slice(0, 7)}, 2026-01-10T12:00:00Z.`,
    );
  });

  it("reports a point that names nothing as not_found, suggesting the Revisions' tags", async () => {
    const { r, h, january } = await repo();
    r.git("tag", "v1", january);

    const result = await resolvePoint(h, "nope");

    expect(result).toEqual({ ok: false, kind: "not_found", tags: ["v1"] });
    expect(!result.ok && pointMessage("nope", result)).toBe('Unknown ref or date "nope"; a date names the last Revision at or before it.');
  });

  it("reports a sha prefix of several Revisions as ambiguous", async () => {
    const { r, h, february } = await repo();
    const prefix = february.slice(0, 4);
    const march = await r.commitStartingWith(prefix, "Add mail", "2026-03-10T12:00:00Z", { "archidocs/shop/mail.yaml": "services:\n  mail:\n    name: Mail\n" });

    const result = await resolvePoint(h, prefix);

    expect(result).toMatchObject({ ok: false, kind: "ambiguous", count: 2, candidates: [{ sha: march }, { sha: february }] });
    expect(!result.ok && pointMessage(prefix, result)).toBe(`"${prefix}" is the start of 2 Revisions' shas; give more of it.`);
    expect(await resolvePoint(h, march.slice(0, 12))).toMatchObject({ ok: true, sha: march });
  });
});
