/**
 * Screenshots of the viewer, generated so they can't go stale. For each
 * example in the shot list (`src/screenshots.ts`) the repo's own CLI builds
 * the example's site; Playwright opens each shot's URL on it in light and
 * dark, with reduced motion on, waits for the viewer to say its layout is
 * still, and takes the picture. The pictures are build output, served from
 * `/screenshots/<theme>/<id>.png`, and never committed.
 *
 * Capturing is the slow part, so each picture is cached on a hash of the
 * built site (the viewer and the example's Workspace Bundles), the shot and the
 * browser: an unchanged viewer and example aren't captured again.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join, normalize, relative } from "node:path";
import { promisify } from "node:util";
import { chromium, type Browser } from "@playwright/test";
import { build } from "../../../src/commands/index.ts";
import { DEFAULT_KEEP } from "../../../src/history/index.ts";
import { serializeSiteFile, SITE_FILE_PATH } from "../../../src/revisions/index.ts";
import { checkoutAt } from "../../../src/workspace/index.ts";
import { SHOTS } from "../screenshots.ts";
import { findDiagramSource, isDemo, THEMES, type Theme } from "./examples.ts";
import { repoPath } from "./repo.ts";

export type { Browser };

/** One screenshot in the shot list. */
export interface Shot {
  /** The id pages name it by: `<Screenshot id="…" />`. Lowercase words and hyphens. */
  id: string;
  /** The example Workspace whose site it shows: a folder in `examples/`. */
  example: "big-bank" | "kitchen-sink" | "quick-start";
  /** The viewer URL: the part after the site's address, as `#/view/c2?sel=shop:web`. */
  url: `#/${string}`;
  /** The browser window, in CSS pixels. The picture has twice as many. */
  viewport: { width: number; height: number };
}

/** Pixels per CSS pixel, so a picture stays sharp on a high-density screen. */
const SCALE = 2;
/** Bump when the way pictures are taken changes, so every cached one is taken again. */
const CAPTURE_VERSION = 1;
const DEFAULT_CACHE_DIR = repoPath("website/node_modules/.cache/archidocs-screenshots");

export function findShot(id: string): Shot {
  const shot = SHOTS.find((s) => s.id === id);
  if (!shot) throw new Error(`Unknown screenshot "${id}". Add it to website/src/screenshots.ts, or use one of: ${SHOTS.map((s) => s.id).join(", ")}.`);
  return shot;
}

export const screenshotUrl = (theme: Theme, id: string): string => `/screenshots/${theme}/${id}.png`;

/** The shot's URL on its example's live demo, or nothing when the example isn't deployed. */
export function liveShotUrl(shot: Shot): string | undefined {
  const source = findDiagramSource(shot.example);
  return isDemo(source) ? `${source.demo}/${shot.url}` : undefined;
}

const run = promisify(execFile);

let viewer: Promise<unknown> | undefined;

/** `dist/viewer/`, which `archidocs build` copies into each site, built first if it's missing: once, however many examples ask. */
function ensureViewer(): Promise<unknown> {
  viewer ??= existsSync(repoPath("dist/viewer/index.html")) ? Promise.resolve() : run("pnpm", ["build:viewer"], { cwd: repoPath(".") });
  return viewer;
}

/**
 * Builds an example's site into a temp folder with the repo's own `build` command, and
 * returns the folder. Big Bank is built as its demo is, with its dated
 * history; any other example is built from a copy outside git, so its site
 * holds the example's files and nothing of this repo's history. `without`
 * leaves files of the copy out, for tests.
 */
export async function buildExampleSite(example: Shot["example"], { without = [] }: { without?: readonly string[] } = {}): Promise<string> {
  await ensureViewer();
  const tmp = await mkdtemp(join(tmpdir(), `archidocs-shots-${example}-`));
  const site = join(tmp, "site");
  try {
    if (example === "big-bank" && without.length === 0) {
      await run(process.execPath, [repoPath("examples/big-bank/build-demo.mjs"), site]);
    } else {
      const copy = join(tmp, "workspace");
      cpSync(repoPath(`examples/${example}`), copy, { recursive: true, filter: (path) => !/[/\\]site$/.test(path) });
      for (const path of without) await rm(join(copy, path), { force: true, recursive: true });
      const result = await build(checkoutAt(join(copy, "archidocs")), { out: site, viewerDir: repoPath("dist/viewer/"), keep: DEFAULT_KEEP, bundleOnly: false });
      if (result.kind !== "site") throw new Error(`Building ${example}'s site failed: ${JSON.stringify(result)}`);
      await rm(copy, { recursive: true, force: true });
    }
  } catch (error) {
    await rm(tmp, { recursive: true, force: true });
    throw error;
  }
  // site.json names the Workspace for the viewer's downloads. The demo build names it after its temp folder,
  // so it is named here instead: the site, and so its hash, is then the same on every build.
  await writeFile(join(site, SITE_FILE_PATH), serializeSiteFile(example));
  return site;
}

/** A hash of every file in a folder, by path and content. */
export function siteHash(dir: string): string {
  const hash = createHash("sha256");
  const files = (readdirSync(dir, { recursive: true, withFileTypes: true }) as import("node:fs").Dirent[])
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  for (const file of files) hash.update(`${relative(dir, file)}\0`).update(readFileSync(file)).update("\0");
  return hash.digest("hex");
}

const PLAYWRIGHT_VERSION = (JSON.parse(readFileSync(repoPath("node_modules/@playwright/test/package.json"), "utf8")) as { version: string }).version;

/** The cache key of one picture: the site, the shot's URL and window, the theme and the browser. */
const pictureKey = (site: string, shot: Shot, theme: Theme): string =>
  createHash("sha256")
    .update(JSON.stringify({ capture: CAPTURE_VERSION, playwright: PLAYWRIGHT_VERSION, site, url: shot.url, viewport: shot.viewport, theme }))
    .digest("hex");

export const launchBrowser = (): Promise<Browser> => chromium.launch();

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".png": "image/png",
};

/** A built site served on a local port, ready to be captured. */
export interface SiteServer {
  url: string;
  /** Takes one shot's picture in one theme. Fails if the viewer shows its error or empty state. */
  capture(browser: Browser, shot: Shot, theme: Theme): Promise<Buffer>;
  close(): Promise<void>;
}

export async function openSite(dir: string): Promise<SiteServer> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://host").pathname);
    const rel = normalize(path.endsWith("/") ? `${path}index.html` : path).replace(/^[/\\]+/, "");
    if (rel.startsWith("..")) return void res.writeHead(400).end();
    readFile(join(dir, rel)).then(
      (body) => res.writeHead(200, { "content-type": TYPES[extname(rel)] ?? "application/octet-stream" }).end(body),
      () => res.writeHead(404).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  return {
    url,
    capture: (browser, shot, theme) => capture(browser, url, shot, theme),
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

/** What the viewer is showing: a finished layout, a message instead of one, or not yet either. */
type Screen = { kind: "ready"; drawn: number } | { kind: "problem"; text: string };

async function capture(browser: Browser, base: string, shot: Shot, theme: Theme): Promise<Buffer> {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: SCALE,
    colorScheme: theme,
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${base}${shot.url}`);
    const handle = await page.waitForFunction(
      (): Screen | false => {
        // A message in place of the screen: the Workspace or Revision couldn't load, no such View, or a failed layout.
        const problem = document.querySelector(".arc-unavailable, .arc-error, .arc-message");
        const text = problem?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (problem && !/^Loading\b/.test(text)) return { kind: "problem", text };
        // The canvas says "ready" once the layout of exactly this screen is drawn and still.
        if (!document.querySelector('[data-canvas][data-state="ready"]')) return false;
        return { kind: "ready", drawn: document.querySelectorAll("[data-node], [data-graph-node], [data-participant]").length };
      },
      undefined,
      { timeout: 30_000 },
    );
    const screen = (await handle.jsonValue()) as Screen;
    const name = `Screenshot "${shot.id}" (${shot.url})`;
    if (screen.kind === "problem") throw new Error(`${name} shows the viewer's error state: ${screen.text}`);
    if (screen.drawn === 0) throw new Error(`${name} shows an empty View: nothing is drawn on the canvas.`);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return await page.screenshot({ animations: "disabled", caret: "hide" });
  } finally {
    await context.close();
  }
}

/** Each picture, as `<theme>/<id>`, and how many were taken rather than read from the cache. */
export interface Captured {
  images: ReadonlyMap<string, Buffer>;
  captured: number;
}

/** Takes the shots in both themes, reading each picture from the cache when its site, shot and browser are unchanged. */
export async function captureShots(shots: readonly Shot[], { cacheDir = DEFAULT_CACHE_DIR }: { cacheDir?: string } = {}): Promise<Captured> {
  const images = new Map<string, Buffer>();
  let captured = 0;
  let browser: Promise<Browser> | undefined;
  await mkdir(cacheDir, { recursive: true });
  const examples = [...new Set(shots.map((s) => s.example))];
  try {
    await Promise.all(
      examples.map(async (example) => {
        const dir = await buildExampleSite(example);
        const hash = siteHash(dir);
        let server: Promise<SiteServer> | undefined;
        try {
          for (const shot of shots.filter((s) => s.example === example)) {
            for (const theme of THEMES) {
              const file = join(cacheDir, `${pictureKey(hash, shot, theme)}.png`);
              let png: Buffer | undefined = await readFile(file).catch(() => undefined);
              if (!png) {
                browser ??= launchBrowser();
                server ??= openSite(dir);
                png = await (await server).capture(await browser, shot, theme);
                // Written aside and renamed, so a build running at the same time never reads half a picture.
                const part = `${file}.${process.pid}.${captured}.part`;
                await writeFile(part, png);
                await rename(part, file);
                captured++;
              }
              images.set(`${theme}/${shot.id}`, png);
            }
          }
        } finally {
          // A server or browser that failed to start has already failed the capture; closing it can't add to that.
          await (await server?.catch(() => undefined))?.close();
          await rm(join(dir, ".."), { recursive: true, force: true });
        }
      }),
    );
  } finally {
    await (await browser?.catch(() => undefined))?.close();
  }
  return { images, captured };
}

let shotList: Promise<Captured> | undefined;

/** Every shot in the shot list, in both themes, once per build. */
export function captureScreenshots(): Promise<Captured> {
  shotList ??= captureShots(SHOTS);
  return shotList;
}
