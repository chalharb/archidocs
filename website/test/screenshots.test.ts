import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DIAGRAM_SOURCES } from "../src/lib/examples.ts";
import { buildExampleSite, captureShots, findShot, launchBrowser, liveShotUrl, openSite, siteHash, type Browser, type Shot, type SiteServer } from "../src/lib/screenshots.ts";
import { pageMarkdown } from "../src/render-markdown.ts";
import { SHOTS } from "../src/screenshots.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const shot = (id: string, url: `#/${string}`): Shot => ({ id, example: "quick-start", url, viewport: { width: 800, height: 500 } });

describe("the shot list", () => {
  it("gives each shot a unique id, an example with diagrams, a viewer URL and a viewport", () => {
    const slugs = DIAGRAM_SOURCES.map((s) => s.slug);
    expect(new Set(SHOTS.map((s) => s.id)).size).toBe(SHOTS.length);
    for (const s of SHOTS) {
      expect(s.id, s.id).toMatch(/^[a-z0-9-]+$/);
      expect(slugs, s.id).toContain(s.example);
      expect(s.url, s.id).toMatch(/^#\//);
      expect(s.viewport.width, s.id).toBeGreaterThan(0);
    }
  });

  it("names the known shots when an id is unknown", () => {
    expect(() => findShot("no-such-shot")).toThrow(/Unknown screenshot "no-such-shot".*quick-start-landscape/);
  });
});

describe("the Markdown copy", () => {
  it("shows a screenshot as its light image", () => {
    const markdown = pageMarkdown('Before.\n\n<Screenshot id="quick-start-landscape" alt="The C2 Landscape" />\n\nAfter.\n');
    expect(markdown).toBe("Before.\n\n![The C2 Landscape](/screenshots/light/quick-start-landscape.png)\n\nAfter.\n");
  });
});

describe("the live link", () => {
  it("opens a demo's shot at the same URL on the demo, and an undeployed example's nowhere", () => {
    const outage: Shot = { id: "outage", example: "big-bank", url: "#/view/digital:mainframe-outage?sel=digital:mainframe", viewport: { width: 800, height: 500 } };
    expect(liveShotUrl(outage)).toBe("https://big-bank.archidocs.dev/#/view/digital:mainframe-outage?sel=digital:mainframe");
    expect(liveShotUrl(shot("landscape", "#/view/c2"))).toBeUndefined();
  });
});

describe("capturing", () => {
  let browser: Browser;
  let quickStart: SiteServer;

  beforeAll(async () => {
    browser = await launchBrowser();
    quickStart = await openSite(await buildExampleSite("quick-start"));
  });
  afterAll(async () => {
    await quickStart?.close();
    await browser?.close();
  });

  it("captures a shot in each theme, the same bytes every time", async () => {
    const landscape = shot("landscape", "#/view/c2");
    const light = await quickStart.capture(browser, landscape, "light");
    const dark = await quickStart.capture(browser, landscape, "dark");
    expect(light.subarray(0, 4)).toEqual(PNG);
    expect(light.equals(dark)).toBe(false);
    expect((await quickStart.capture(browser, landscape, "light")).equals(light)).toBe(true);
  });

  it("captures Big Bank's demo site, built with its history", async () => {
    const bigBank = await openSite(await buildExampleSite("big-bank"));
    try {
      const outage: Shot = { id: "outage", example: "big-bank", url: "#/view/digital:mainframe-outage", viewport: { width: 800, height: 500 } };
      expect((await bigBank.capture(browser, outage, "dark")).subarray(0, 4)).toEqual(PNG);
    } finally {
      await bigBank.close();
    }
  });

  it("fails on a shot whose URL shows the viewer's error state", async () => {
    await expect(quickStart.capture(browser, shot("missing", "#/view/no-such-view"), "light")).rejects.toThrow(/"missing" \(#\/view\/no-such-view\) shows the viewer's error state: No View no-such-view/);
  });

  it("fails on a shot whose URL shows an empty View", async () => {
    // The quick start's Workspace without its model: a C2 Landscape with nothing on it.
    const dir = await buildExampleSite("quick-start", { without: ["archidocs/shop/model.yaml"] });
    const empty = await openSite(dir);
    try {
      await expect(empty.capture(browser, shot("empty", "#/view/c2"), "light")).rejects.toThrow(/"empty" \(#\/view\/c2\) shows an empty View/);
    } finally {
      await empty.close();
    }
  });
});

describe("the cache", () => {
  it("hashes a site by its files, so a change to any file is a new key", () => {
    const dir = mkdtempSync(join(tmpdir(), "archidocs-hash-"));
    writeFileSync(join(dir, "index.html"), "<p>one</p>");
    const before = siteHash(dir);
    expect(siteHash(dir)).toBe(before);
    writeFileSync(join(dir, "index.html"), "<p>two</p>");
    expect(siteHash(dir)).not.toBe(before);
  });

  it("captures an unchanged site's shots once, then serves them from the cache", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "archidocs-screenshot-cache-"));
    const shots = [shot("landscape", "#/view/c2")];
    const first = await captureShots(shots, { cacheDir });
    expect(first.captured).toBe(2);
    expect([...first.images.keys()].sort()).toEqual(["dark/landscape", "light/landscape"]);
    const second = await captureShots(shots, { cacheDir });
    expect(second.captured).toBe(0);
    expect(second.images.get("light/landscape")!.equals(first.images.get("light/landscape")!)).toBe(true);
  });
});
