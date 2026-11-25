// A zone west of UTC, so a time read as local would land hours later than one read as UTC.
process.env.TZ = "America/Los_Angeles";

import { describe, expect, it } from "vitest";
import { find, span, timeSpan, type Dated } from "../../src/revisions/index.ts";

const sha = (head: string) => head.padEnd(40, "0");
/** The research's index, newest first: c1 and c3 are Revisions, and two more share their first four characters. */
const AMB2 = { sha: sha("abcd2"), date: "2026-11-05T12:00:00Z", tags: [] };
const AMB1 = { sha: sha("abcd1"), date: "2026-11-04T12:00:00Z", tags: [] };
const C3 = { sha: sha("c3c3c3"), date: "2026-11-03T12:00:00Z", tags: ["2026-11-02"] };
const C1 = { sha: sha("c1c1c1"), date: "2026-11-02T10:00:00Z", tags: ["v1", "first"] };
const REVISIONS: Dated[] = [AMB2, AMB1, C3, C1];

const named = (point: string) => {
  const found = find(REVISIONS, point);
  return found.ok ? found.revision : found;
};

describe("find", () => {
  it.each([
    ["an exact tag", "v1", C1],
    ["a tag that looks like a date, before the date", "2026-11-02", C3],
    ["a day: the last Revision within or before it", "2026-11-03", C3],
    ["a day with no Revision of its own", "2026-11-10", AMB2],
    ["a time with Z", "2026-11-03T10:00:00Z", C1],
    ["a time at a Revision's own instant", "2026-11-03T12:00:00Z", C3],
    ["a time with an offset", "2026-11-03T12:00:00+01:00", C1],
    ["a time with a compact offset", "2026-11-03T05:00-0700", C3],
    ["a time with no zone, read as UTC", "2026-11-03T12:00", C3],
    ["a time with a space and no zone, read as UTC", "2026-11-03 11:59:59", C1],
    ["a time with a fraction", "2026-11-03T11:59:59.999Z", C1],
    ["a unique prefix", "c3c3", C3],
    ["a prefix in upper case", "C3C3C3", C3],
    ["a full sha", sha("abcd1"), AMB1],
    ["a 7-character prefix of one of the shared four", "abcd100", AMB1],
  ])("%s: %s", (_, point, revision) => {
    expect(named(point)).toBe(revision);
  });

  it("reports a prefix several shas start with, newest first", () => {
    expect(named("abcd")).toEqual({ ok: false, kind: "ambiguous", count: 2, candidates: [AMB2, AMB1] });
    expect(named("ABCD")).toMatchObject({ kind: "ambiguous" });
  });

  it("lists at most 5 candidates and counts them all", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ sha: sha(`beef${i}`), date: "2026-11-01T00:00:00Z", tags: [] }));
    expect(find(many, "beef")).toMatchObject({ kind: "ambiguous", count: 7, candidates: many.slice(0, 5) });
  });

  it("names the first Revision for a date or time before it", () => {
    expect(named("2026-11-01")).toEqual({ ok: false, kind: "not_found", tags: ["2026-11-02", "v1", "first"], first: C1 });
    expect(named("2026-11-02T09:59:59Z")).toMatchObject({ kind: "not_found", first: C1 });
  });

  it.each([
    ["a branch name", "main"],
    ["the empty string", ""],
    ["a ref git would take", "HEAD~1"],
    ["hex too short", "c3c"],
    ["hex no sha starts with", "ffff"],
    ["a day that doesn't exist", "2026-02-30"],
    ["a time that doesn't exist", "2026-11-03T25:00Z"],
  ])("finds nothing for %s: %s", (_, point) => {
    const found = find(REVISIONS, point);
    expect(found).toMatchObject({ ok: false, kind: "not_found" });
    expect(found).not.toHaveProperty("first");
  });

  it("suggests at most 5 tags", () => {
    const tagged = Array.from({ length: 4 }, (_, i) => ({ sha: sha(`f${i}`), date: "2026-11-01T00:00:00Z", tags: [`a${i}`, `b${i}`] }));
    expect(find(tagged, "nope")).toMatchObject({ tags: ["a0", "b0", "a1", "b1", "a2"] });
  });

  it("finds nothing in an empty list", () => {
    expect(find([], "2026-11-03")).toEqual({ ok: false, kind: "not_found", tags: [] });
  });
});

describe("span", () => {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`);

  it("spans a UTC day from its start up to the next day's start", () => {
    expect(timeSpan("2026-11-03")).toEqual({ start: day("2026-11-03"), end: day("2026-11-04") });
    expect(span(REVISIONS, "2026-11-03")).toEqual({ ok: true, span: { start: day("2026-11-03"), end: day("2026-11-04") } });
  });

  it("spans a time's one instant, read as UTC without a zone", () => {
    const at = Date.parse("2026-11-03T10:00:00Z");
    expect(timeSpan("2026-11-03 10:00")).toEqual({ start: at, end: at + 1 });
    expect(span(REVISIONS, "2026-11-03T11:00+01:00")).toEqual({ ok: true, span: { start: at, end: at + 1 } });
  });

  it("spans a day even with no Revision in or before it", () => {
    expect(span(REVISIONS, "2020-01-01")).toEqual({ ok: true, span: { start: day("2020-01-01"), end: day("2020-01-02") } });
  });

  it("spans a tag's or a sha's Revision, a tag first even when it looks like a date", () => {
    const c3 = Date.parse(C3.date);
    expect(span(REVISIONS, "2026-11-02")).toEqual({ ok: true, span: { start: c3, end: c3 + 1 } });
    expect(span(REVISIONS, "c3c3")).toEqual({ ok: true, span: { start: c3, end: c3 + 1 } });
  });

  it("passes on find's failures", () => {
    expect(span(REVISIONS, "abcd")).toMatchObject({ ok: false, kind: "ambiguous" });
    expect(span(REVISIONS, "main")).toMatchObject({ ok: false, kind: "not_found" });
  });

  it("is not a time for anything else", () => {
    expect(timeSpan("v1")).toBeUndefined();
    expect(timeSpan("2026-11")).toBeUndefined();
  });
});
