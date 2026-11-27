import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { QUIET_MS, serveDev, type DevServer } from "../../src/cli/dev.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";
import { checkoutAt } from "../../src/workspace/index.ts";

// Serves the prebuilt viewer, which test/support/viewer-build.ts builds once per run.
const viewerDir = fileURLToPath(new URL("../../dist/viewer/", import.meta.url));

/** Reads Server-Sent Events from the dev server until `want` arrives. */
async function nextEvent(url: string, want: string): Promise<string> {
  const res = await fetch(new URL("__archidocs/events", url));
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`stream ended before "${want}"`);
    text += value;
    const match = text.split("\n\n").find((block) => block.startsWith(`event: ${want}\n`));
    if (match) {
      await reader.cancel();
      return JSON.parse(match.split("\ndata: ")[1]!) as string;
    }
  }
}

/** Counts Server-Sent Events named `name` from the dev server until stopped. */
function countEvents(url: string, name: string): { count: () => number; stop: () => void } {
  let count = 0;
  const controller = new AbortController();
  void (async () => {
    const res = await fetch(new URL("__archidocs/events", url), { signal: controller.signal });
    let text = "";
    for await (const value of res.body!.pipeThrough(new TextDecoderStream())) {
      text += value;
      const blocks = text.split("\n\n");
      text = blocks.pop()!;
      count += blocks.filter((block) => block.startsWith(`event: ${name}\n`)).length;
    }
  })().catch(() => {});
  return { count: () => count, stop: () => controller.abort() };
}

/** A GET to `url` with its own Host header, which `fetch` won't let a caller set. */
function getWithHost(url: string, path: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((done, fail) => {
    const { hostname, port } = new URL(url);
    request({ hostname, port, path, headers: { Host: host } }, (res) => {
      let body = "";
      res.setEncoding("utf8").on("data", (c: string) => (body += c)).on("end", () => done({ status: res.statusCode!, body }));
    }).on("error", fail).end();
  });
}

describe("archidocs dev", () => {
  let dev: DevServer | undefined;
  afterEach(async () => dev?.close());

  async function start() {
    const { repoRoot, root } = await writeWorkspace(landscapeWorkspace);
    let loads = 0;
    let loaded = () => {};
    dev = await serveDev({ checkout: checkoutAt(root), viewerDir, port: 0, onLoad: () => (loads++, loaded()) });
    /** Resolves on the next rebuild after the first load. */
    const nextLoad = () => new Promise<void>((done) => (loaded = done));
    return { repoRoot, root, url: dev.url, loads: () => loads, nextLoad };
  }

  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
  /** Longer than the watcher's quiet window, so a rebuild it started would have run. */
  const settle = () => sleep(QUIET_MS + 400);

  it("serves the viewer with a live-reload client, the Workspace's Bundle, its name and no history", async () => {
    const { repoRoot, url } = await start();

    const html = await (await fetch(url)).text();
    expect(html).toContain("__archidocs/events");
    const bundle = await (await fetch(new URL("workspace.bundle.json", url))).json();
    expect(bundle.elements.map((e: { id: string }) => e.id)).toContain("shop:checkout");
    expect(await (await fetch(new URL("site.json", url))).json()).toEqual({ workspace: basename(repoRoot) });
    expect((await (await fetch(new URL("bundles/index.json", url))).json()).revisions).toEqual([]);
    expect((await fetch(new URL("../../package.json", url))).status).toBe(404);
  });

  it("rebuilds the Bundle and tells the page to reload when a Workspace file changes", async () => {
    const { root, url } = await start();
    const reload = nextEvent(url, "reload");
    const systems = join(root, "shop/systems.yaml");
    await writeFile(systems, (await readFile(systems, "utf8")).replace("name: Checkout\n", "name: Checkout v2\n"));

    await reload;
    const bundle = await (await fetch(new URL("workspace.bundle.json", url))).json();
    expect(bundle.elements.find((e: { id: string }) => e.id === "shop:checkout").name).toBe("Checkout v2");
  });

  it("makes one reload of a run of edits seconds apart, as an agent's MCP calls are", async () => {
    const { root, url, loads } = await start();
    const reloads = countEvents(url, "reload");
    const systems = join(root, "shop/systems.yaml");
    const original = await readFile(systems, "utf8");
    for (let i = 1; i <= 5; i++) {
      await writeFile(systems, original.replace("name: Checkout\n", `name: Checkout v${i}\n`));
      await sleep(200);
    }

    await settle();
    expect(reloads.count()).toBe(1);
    expect(loads()).toBe(2);
    const bundle = await (await fetch(new URL("workspace.bundle.json", url))).json();
    expect(bundle.elements.find((e: { id: string }) => e.id === "shop:checkout").name).toBe("Checkout v5");
    reloads.stop();
  });

  it("keeps the last good Bundle and sends the errors while the Workspace is broken", async () => {
    const { root, url } = await start();
    const errors = nextEvent(url, "errors");
    await writeFile(join(root, "shop/people.yaml"), "people:\n  shopper:\n    relationships:\n      - to: nowhere\n");

    expect(await errors).toContain("nowhere");
    const bundle = await (await fetch(new URL("workspace.bundle.json", url))).json();
    expect(bundle.elements.map((e: { id: string }) => e.id)).toContain("shop:shopper");
  });

  it("does not rebuild when a file that is not a Workspace file changes", async () => {
    const { root, loads } = await start();
    await mkdir(join(root, ".drafts"));
    await mkdir(join(root, "node_modules/pkg"), { recursive: true });
    await writeFile(join(root, "notes.txt"), "todo\n");
    await writeFile(join(root, "package.json"), "{}\n");
    await writeFile(join(root, ".drafts/systems.yaml"), "systems: {}\n");
    await writeFile(join(root, "node_modules/pkg/systems.yaml"), "systems: {}\n");

    await settle();
    expect(loads()).toBe(1);
  });

  it("rebuilds when a .yaml or .md file anywhere in the Workspace changes", async () => {
    const { root, nextLoad } = await start();
    const yaml = nextLoad();
    await writeFile(join(root, "shop/extra.yaml"), "systems: {}\n");
    await yaml;

    const md = nextLoad();
    await writeFile(join(root, "shop/notes.md"), "# Notes\n");
    await md;
  });

  it("refuses a request whose Host is not local, on every route, when bound to localhost", async () => {
    const { url } = await start();
    const { port } = new URL(url);
    for (const path of ["/", "/workspace.bundle.json", "/site.json", "/__archidocs/events"]) {
      const res = await getWithHost(url, path, "evil.example");
      expect(res.status, path).toBe(403);
      expect(res.body, path).not.toContain("shop:checkout");
    }
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]) {
      const res = await getWithHost(url, "/workspace.bundle.json", host);
      expect(res.status, host).toBe(200);
      expect(res.body, host).toContain("shop:checkout");
    }
  });

  it("serves a foreign Host when bound beyond localhost, as the user chose", async () => {
    const { root } = await writeWorkspace(landscapeWorkspace);
    dev = await serveDev({ checkout: checkoutAt(root), viewerDir, host: "0.0.0.0", port: 0 });
    const res = await getWithHost(dev.url, "/workspace.bundle.json", "evil.example");
    expect(res.status).toBe(200);
    expect(res.body).toContain("shop:checkout");
  });

  it("answers 404 to an encoded path that climbs out of the viewer directory", async () => {
    const { url } = await start();
    // URL parsing folds %2e%2e away; an encoded slash survives it, and dist/ holds only the viewer, so the repo package.json is two levels up.
    for (const path of ["/%2e%2e/package.json", "/..%2f..%2fpackage.json"]) {
      const res = await getWithHost(url, path, new URL(url).host);
      expect(res.status, path).toBe(404);
      expect(res.body, path).not.toContain('"name"');
    }
  });
});
