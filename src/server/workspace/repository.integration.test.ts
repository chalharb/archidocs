import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copySampleWorkspace, hashTree } from "../../../tests/helpers/workspace";
import { waitFor, type TempDir } from "../../../tests/helpers/tmp";
import { nodeAtomicWriteOps } from "../fs/atomic-write";
import { LayoutSaveError } from "../persistence/layout-writer";
import { revisionOf } from "../persistence/revision";
import { WorkspaceRepository, staleNotice } from "./repository";
import { isRelevantPath, watchWorkspace } from "./watcher";

let ws: TempDir;
let repo: WorkspaceRepository;

beforeEach(async () => {
  ws = await copySampleWorkspace();
  repo = await WorkspaceRepository.open("sample", ws.dir, { watch: { debounceMs: 50 } });
});
afterEach(async () => {
  await repo.close();
  await ws.cleanup();
});

const ENTITY_FILE = "model/people.yaml";
const text = (rel: string) => readFile(path.join(ws.dir, rel), "utf8");

describe("loading the example workspace (P0-10, DOD-14)", () => {
  it("loads every resource kind with no diagnostics", () => {
    const snap = repo.snapshot();
    expect(snap.status).toBe("valid");
    expect(snap.diagnostics).toEqual([]);
    const m = snap.model;
    expect(m.workspace!.id).toBe("acme");
    expect(Object.keys(m.projects)).toEqual(["payments", "platform"]);
    expect(Object.keys(m.diagrams).sort()).toEqual([
      "containers",
      "deployment",
      "network-topology",
      "payments-api-components",
      "support-overview",
      "system-context",
    ]);
    expect(new Set(Object.values(m.diagrams).map((d) => d.diagramType))).toEqual(
      new Set(["c4-context", "c4-container", "c4-component", "network", "deployment", "custom"]),
    );
    expect(Object.keys(m.layouts)).toEqual(["system-context"]);
    expect(
      Object.values(m.collections)
        .map((c) => c.kind)
        .sort(),
    ).toEqual(["EntitySet", "EntitySet", "RelationshipSet", "RelationshipSet"]);
    expect(staleNotice(snap)).toBeNull();
  });

  it("resolves every diagram to renderable data", async () => {
    for (const id of Object.keys(repo.snapshot().model.diagrams)) {
      const view = (await repo.diagramView(id))!;
      expect(view.diagnostics, id).toEqual([]);
      expect(view.diagram.nodes.length, id).toBeGreaterThan(0);
      expect(Object.keys(view.layout.positions).sort()).toEqual(
        view.diagram.nodes.map((n) => n.id).sort(),
      );
    }
  });

  it("exposes graph lookups through entity views", () => {
    const view = repo.entityView("payments-api")!;
    expect(view.parent).toBe("payments-system");
    expect(view.children).toEqual(["fraud-checker", "ledger-repository", "payment-controller"]);
    expect(view.incoming.map((r) => r.id)).toEqual(["shop-api"]);
    expect(view.outgoing.map((r) => r.id)).toEqual([
      "api-card-network",
      "api-ledger",
      "api-on-cluster",
    ]);
    expect(view.diagrams).toEqual(["containers", "deployment", "support-overview"]);
    expect(repo.entityView("customer")!.parent).toBeUndefined();
    expect(repo.entityView("nope")).toBeNull();
  });

  it("applies layout precedence and manual positions in diagram views", async () => {
    const view = (await repo.diagramView("system-context"))!;
    expect(view.settings.settings).toMatchObject({
      direction: "DOWN",
      nodeSpacing: 60,
      edgeType: "straight",
    });
    expect(view.settings.sources).toMatchObject({
      direction: "workspace",
      nodeSpacing: "workspace",
      edgeType: "layout",
    });
    expect(view.layout.positions.customer).toMatchObject({ x: 300, y: 0, source: "manual" });
    expect(view.layout.positions["payments-system"]!.source).toBe("generated");
    expect(view.persistence).toMatchObject({
      layoutFile: "diagrams/system-context.layout.yaml",
      writable: true,
      revision: revisionOf(await text("diagrams/system-context.layout.yaml")),
      draft: null,
    });
    const containers = (await repo.diagramView("containers"))!;
    expect(containers.settings.sources.direction).toBe("diagram");
    expect(containers.persistence.revision).toBeNull();
    expect(await repo.diagramView("nope")).toBeNull();
  });

  it("shows multiple view instances in the deployment diagram (DIAG-09)", async () => {
    const view = (await repo.diagramView("deployment"))!;
    const api = view.diagram.nodes.filter((n) => n.entityId === "payments-api").map((n) => n.id);
    expect(api).toEqual(["payments-api-a", "payments-api-b"]);
  });
});

describe("reload without restart (RELI-14) and stale handling (RELI-02, RELI-04)", () => {
  it("reports no change when nothing changed", async () => {
    const { changed, snapshot } = await repo.reload();
    expect(changed).toBe(false);
    expect(snapshot.version).toBe(1);
  });

  it("picks up valid external changes", async () => {
    await writeFile(
      path.join(ws.dir, ENTITY_FILE),
      (await text(ENTITY_FILE)).replace("name: Customer", "name: Shopper"),
    );
    const { changed, snapshot } = await repo.reload();
    expect(changed).toBe(true);
    expect(snapshot).toMatchObject({ status: "valid", version: 2 });
    expect(snapshot.model.entities.customer!.name).toBe("Shopper");
  });

  it("keeps the last valid model when an edit breaks the YAML, then recovers", async () => {
    const original = await text(ENTITY_FILE);
    await writeFile(
      path.join(ws.dir, ENTITY_FILE),
      original.replace("name: Customer", "name: [unclosed"),
    );
    const stale = (await repo.reload()).snapshot;
    expect(stale.status).toBe("stale");
    expect(stale.model.entities.customer!.name).toBe("Customer");
    expect(stale.diagnostics.map((d) => [d.code, d.file])).toContainEqual([
      "YAML_SYNTAX",
      ENTITY_FILE,
    ]);
    expect(staleNotice(stale)).toMatchObject({ code: "MODEL_STALE" });
    // Views still work against the last valid model.
    expect((await repo.diagramView("containers"))!.modelStatus).toBe("stale");

    await writeFile(path.join(ws.dir, ENTITY_FILE), original);
    expect((await repo.reload()).snapshot.status).toBe("valid");
  });

  it("treats a deleted file deterministically: stale with missing-reference diagnostics (FAIL-04, RELI-13)", async () => {
    await rm(path.join(ws.dir, ENTITY_FILE));
    const snap = (await repo.reload()).snapshot;
    expect(snap.status).toBe("stale");
    expect(snap.model.entities.customer).toBeDefined();
    const missing = snap.diagnostics.filter(
      (d) => d.code === "REF_MISSING" || d.code === "DIAGRAM_ENDPOINT_MISMATCH",
    );
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.some((d) => d.message.includes("customer"))).toBe(true);
    const again = (await repo.reload()).snapshot;
    expect(again.diagnostics).toEqual(snap.diagnostics);
  });

  it("treats a renamed file deterministically: same model, new provenance (FAIL-05)", async () => {
    await rename(path.join(ws.dir, ENTITY_FILE), path.join(ws.dir, "model/humans.yaml"));
    const snap = (await repo.reload()).snapshot;
    expect(snap.status).toBe("valid");
    expect(snap.model.sources["entity:customer"]!.file).toBe("model/humans.yaml");
    expect(snap.model.entities.customer!.name).toBe("Customer");
  });

  it("notifies change listeners and supports unsubscribing", async () => {
    const seen: number[] = [];
    const off = repo.onChange((s) => seen.push(s.version));
    await writeFile(
      path.join(ws.dir, "model/extra.yaml"),
      "apiVersion: archdocs/v1\nkind: Project\nid: x\nname: X\n",
    );
    await repo.reload();
    off();
    await rm(path.join(ws.dir, "model/extra.yaml"));
    await repo.reload();
    expect(seen).toEqual([2]);
  });

  it("reports unreadable files deterministically (FAIL-06)", async () => {
    const { chmod } = await import("node:fs/promises");
    await chmod(path.join(ws.dir, ENTITY_FILE), 0o000);
    const snap = (await repo.reload()).snapshot;
    await chmod(path.join(ws.dir, ENTITY_FILE), 0o644);
    expect(snap.status).toBe("stale");
    expect(snap.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "FS_READ_ERROR",
        file: ENTITY_FILE,
        message: `Permission denied: ${ENTITY_FILE}`,
      }),
    );
  });

  it("never crashes on malformed or hostile files (FAIL-01)", async () => {
    await writeFile(path.join(ws.dir, "evil.yaml"), "a: !!python/object:os.system ls\n");
    await writeFile(path.join(ws.dir, "big.yaml"), `a: "${"x".repeat(2 * 1024 * 1024)}"\n`);
    await writeFile(path.join(ws.dir, "garbage.yaml"), "\u0000\u0001: : : [[[");
    const snap = (await repo.reload()).snapshot;
    expect(snap.status).toBe("stale");
    const codes = snap.diagnostics.map((d) => [d.file, d.code]);
    expect(codes).toContainEqual(["evil.yaml", "YAML_UNSAFE_TAG"]);
    expect(codes).toContainEqual(["big.yaml", "FS_TOO_LARGE"]);
    expect(codes.some(([f]) => f === "garbage.yaml")).toBe(true);
  });
});

describe("file watching (RELI-01, RELI-03)", () => {
  it("picks up changes made while the watcher was starting", async () => {
    await writeFile(
      path.join(ws.dir, ENTITY_FILE),
      (await text(ENTITY_FILE)).replace("name: Customer", "name: Early"),
    );
    await repo.startWatching();
    expect(repo.snapshot().model.entities.customer!.name).toBe("Early");
  });

  it("detects external edits and refreshes the model automatically", async () => {
    await repo.startWatching();
    await repo.startWatching(); // idempotent
    await writeFile(
      path.join(ws.dir, ENTITY_FILE),
      (await text(ENTITY_FILE)).replace("name: Customer", "name: Watched"),
    );
    await waitFor(() => expect(repo.snapshot().model.entities.customer!.name).toBe("Watched"));
  });

  it("marks the model stale when a watched edit is invalid", async () => {
    await repo.startWatching();
    await writeFile(path.join(ws.dir, ENTITY_FILE), "apiVersion: archdocs/v9\nkind: Entity\n");
    await waitFor(() => expect(repo.snapshot().status).toBe("stale"));
    expect(repo.snapshot().model.entities.customer!.name).toBe("Customer");
  });

  it("ignores hidden paths, non-YAML files and batches bursts", async () => {
    const batches: string[][] = [];
    const watcher = watchWorkspace(repo.root.realPath, (p) => batches.push(p), { debounceMs: 100 });
    await watcher.ready;
    // Under heavy load the OS watcher can go live slightly after 'ready'; wait for a probe event.
    await waitFor(
      async () => {
        await ws.write("probe.yaml", `p: ${Date.now()}\n`);
        await new Promise((r) => setTimeout(r, 150));
        expect(batches.flat()).toContain("probe.yaml");
      },
      10_000,
      0,
    );
    batches.length = 0;
    await ws.write(".archidoc/drafts/x.json", "{}");
    await ws.write("notes.txt", "x");
    await ws.write("a.yaml", "a: 1\n");
    await ws.write("b.yaml", "b: 1\n");
    await waitFor(() =>
      expect(batches.flat()).toEqual(expect.arrayContaining(["a.yaml", "b.yaml"])),
    );
    expect(batches.flat().some((p) => p.startsWith(".archidoc") || p.endsWith(".txt"))).toBe(false);
    expect(batches.length).toBeLessThanOrEqual(2);
    await watcher.close();
  });

  it("isRelevantPath", () => {
    expect(isRelevantPath("/r", "/r/a.yaml")).toBe(true);
    expect(isRelevantPath("/r", "/r")).toBe(false);
    expect(isRelevantPath("/r", "/x/a.yaml")).toBe(false);
    expect(isRelevantPath("/r", "/r/.git/a.yaml")).toBe(false);
    expect(isRelevantPath("/r", "/r/node_modules/a.yaml")).toBe(false);
  });
});

describe("saving layouts through the repository (P0-12)", () => {
  it("saves, reloads and keeps positions; only the layout file changes", async () => {
    const before = await hashTree(ws.dir);
    const view = (await repo.diagramView("containers"))!;
    const result = await repo.saveLayout(
      "containers",
      { nodes: { "web-shop": { x: 40, y: 80 } }, settings: { edgeType: "bezier" } },
      view.persistence.revision,
    );
    expect(result.path).toBe("diagrams/containers.layout.yaml");
    const after = (await repo.diagramView("containers"))!;
    expect(after.layout.positions["web-shop"]).toMatchObject({ x: 40, y: 80, source: "manual" });
    expect(after.settings.settings.edgeType).toBe("bezier");
    expect(after.persistence.revision).toBe(result.revision);
    const changed = Object.entries(await hashTree(ws.dir))
      .filter(([f, h]) => before[f] !== h)
      .map(([f]) => f);
    expect(changed).toEqual([path.normalize("diagrams/containers.layout.yaml")]);
  });

  it("retains manual positions across unrelated model reloads (LAYOUT-16/17)", async () => {
    await repo.saveLayout("containers", { nodes: { "web-shop": { x: 40, y: 80 } } }, null);
    const diagramFile = "diagrams/containers.yaml";
    await writeFile(
      path.join(ws.dir, diagramFile),
      (await text(diagramFile)).replace(
        "  - entity: card-network",
        "  - entity: card-network\n  - entity: payments-system",
      ),
    );
    await repo.reload();
    const view = (await repo.diagramView("containers"))!;
    expect(view.layout.positions["web-shop"]).toMatchObject({ x: 40, y: 80, source: "manual" });
    expect(view.layout.positions["payments-system"]!.source).toBe("generated");
  });

  it("reports orphaned overrides after a node is removed (LAYOUT-18)", async () => {
    await repo.saveLayout("containers", { nodes: { "card-network": { x: 1, y: 1 } } }, null);
    const diagramFile = "diagrams/containers.yaml";
    await writeFile(
      path.join(ws.dir, diagramFile),
      (await text(diagramFile))
        .replace("  - entity: card-network\n", "")
        .replace("  - relationship: api-card-network\n", ""),
    );
    const snap = (await repo.reload()).snapshot;
    expect(snap.status).toBe("valid");
    const view = (await repo.diagramView("containers"))!;
    expect(view.layout.orphans.nodes).toEqual(["card-network"]);
    expect(view.diagnostics.map((d) => d.code)).toEqual(["LAYOUT_ORPHAN_NODE"]);
  });

  it("rejects conflicting saves and leaves the external edit in place (RELI-07, FAIL-03)", async () => {
    const view = (await repo.diagramView("system-context"))!;
    const rel = view.persistence.layoutFile;
    const external = (await text(rel)).replace("x: 300", "x: 333");
    await writeFile(path.join(ws.dir, rel), external);
    await expect(
      repo.saveLayout(
        "system-context",
        { nodes: { customer: { x: 1, y: 1 } } },
        view.persistence.revision,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await text(rel)).toBe(external);
  });

  it("keeps a recoverable draft when the write fails, then clears it on success (FAIL-02, RELI-11)", async () => {
    const failing = await WorkspaceRepository.open("failing", ws.dir, {
      writeOps: {
        ...nodeAtomicWriteOps,
        rename: (from, to) =>
          to.endsWith(".layout.yaml")
            ? Promise.reject(Object.assign(new Error("EIO"), { code: "EIO" }))
            : nodeAtomicWriteOps.rename(from, to),
      },
    });
    const edit = { nodes: { "web-shop": { x: 7, y: 7 } } };
    const err = await failing.saveLayout("containers", edit, null).catch((e: LayoutSaveError) => e);
    expect(err).toMatchObject({ code: "WRITE_FAILED" });
    await failing.close();

    // After "restart", the draft is offered for recovery.
    const view = (await repo.diagramView("containers"))!;
    expect(view.persistence.draft).toMatchObject({
      status: "recoverable",
      draft: { layout: edit, baseRevision: null },
    });

    await repo.saveLayout("containers", edit, null);
    expect((await repo.diagramView("containers"))!.persistence.draft).toBeNull();
  });

  it("flags drafts that conflict with later external edits (FAIL-03)", async () => {
    const view = (await repo.diagramView("system-context"))!;
    await repo.saveDraft(
      "system-context",
      { nodes: { customer: { x: 9, y: 9 } } },
      view.persistence.revision,
    );
    const rel = view.persistence.layoutFile;
    await writeFile(path.join(ws.dir, rel), (await text(rel)).replace("x: 300", "x: 301"));
    await repo.reload();
    expect((await repo.diagramView("system-context"))!.persistence.draft).toMatchObject({
      status: "conflict",
    });
    await repo.discardDraft("system-context");
    expect((await repo.diagramView("system-context"))!.persistence.draft).toBeNull();
  });

  it("rejects drafts for unknown diagrams and invalid saves", async () => {
    await expect(repo.saveDraft("nope", {}, null)).rejects.toMatchObject({
      code: "DIAGRAM_NOT_FOUND",
    });
    await expect(
      repo.saveLayout("containers", { nodes: { ghost: { x: 1, y: 1 } } }, null),
    ).rejects.toMatchObject({
      code: "INVALID",
    });
  });

  it("serializes concurrent saves so the second sees the first's revision", async () => {
    const [a, b] = await Promise.allSettled([
      repo.saveLayout("containers", { nodes: { "web-shop": { x: 1, y: 1 } } }, null),
      repo.saveLayout("containers", { nodes: { "web-shop": { x: 2, y: 2 } } }, null),
    ]);
    expect(a.status).toBe("fulfilled");
    expect(b).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
    expect(await text("diagrams/containers.layout.yaml")).toContain("x: 1");
  });
});
