import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { serveDev, type DevServer } from "../../src/cli/dev.ts";
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

  /** Longer than the watcher's 80 ms debounce, so a rebuild it started would have run. */
  const settle = () => new Promise((done) => setTimeout(done, 400));

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
});
