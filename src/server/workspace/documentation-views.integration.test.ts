import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copySampleWorkspace, hashTree } from "../../../tests/helpers/workspace";
import type { TempDir } from "../../../tests/helpers/tmp";
import {
  decisionList,
  decisionPage,
  diagramDocumentation,
  documentList,
  documentPage,
  entityDocumentation,
} from "./documentation-views";
import { WorkspaceRepository } from "./repository";

let ws: TempDir;
let repo: WorkspaceRepository;

beforeEach(async () => {
  ws = await copySampleWorkspace();
  repo = await WorkspaceRepository.open("sample", ws.dir);
});
afterEach(async () => {
  await repo.close();
  await ws.cleanup();
});

describe("documentation read models (DOC-05, DOC-06, ADR-04, ADR-05)", () => {
  it("lists documents by title and decisions newest first", () => {
    const { model } = repo.snapshot();
    expect(documentList(model).map((d) => d.id)).toEqual(["payments-overview", "payments-runbook"]);
    expect(documentList(model)[0]).toEqual({
      id: "payments-overview",
      title: "Payments overview",
      description: "How a card payment flows from the web shop to the ledger.",
      tags: ["payments", "overview"],
    });
    expect(decisionList(model).map((d) => [d.id, d.date, d.status])).toEqual([
      ["adr-0003", "2026-10-20", "proposed"],
      ["adr-0002", "2026-03-14", "accepted"],
      ["adr-0001", "2025-06-02", "superseded"],
    ]);
  });

  it("resolves a document's links to titled targets, entities to their first diagram", () => {
    const view = documentPage(repo.snapshot(), "payments-overview")!;
    expect(view.file).toBe("docs/payments-overview.md");
    expect(view.modelStatus).toBe("valid");
    expect(view.diagnostics).toEqual([]);
    expect(view.links["entity:web-shop"]).toEqual({
      kind: "entity",
      id: "web-shop",
      title: "Web Shop",
      diagram: "containers",
    });
    expect(view.links["diagram:containers"]).toMatchObject({
      kind: "diagram",
      title: "Payments — Containers",
    });
    expect(view.links["decision:adr-0002"]).toMatchObject({
      title: "Use PostgreSQL for the ledger",
    });
    expect(view.links["document:payments-runbook"]).toMatchObject({ title: "Payments runbook" });
    expect(view.entities.map((e) => e.id)).toEqual([
      "payments-system",
      "web-shop",
      "payments-api",
      "ledger-db",
    ]);
    expect(view.diagrams.map((d) => d.id)).toEqual(["system-context", "containers"]);
    expect(documentPage(repo.snapshot(), "nope")).toBeNull();
  });

  it("gives a decision both directions of its supersession chain", () => {
    const snap = repo.snapshot();
    expect(decisionPage(snap, "adr-0001")).toMatchObject({
      supersedes: [],
      supersededBy: [{ id: "adr-0002", title: "Use PostgreSQL for the ledger" }],
    });
    expect(decisionPage(snap, "adr-0002")).toMatchObject({
      supersedes: [{ id: "adr-0001", title: "Store the ledger in MongoDB" }],
      supersededBy: [],
    });
    expect(decisionPage(snap, "nope")).toBeNull();
  });

  it("lists the documentation for an entity and a diagram, decisions newest first", () => {
    const snap = repo.snapshot();
    const ledger = entityDocumentation(snap, "ledger-db");
    expect(ledger.documents.map((d) => d.id)).toEqual(["payments-overview", "payments-runbook"]);
    expect(ledger.decisions.map((d) => d.id)).toEqual(["adr-0002", "adr-0001"]);
    expect(repo.entityView("ledger-db")!.documentation).toEqual(ledger);
    const containers = diagramDocumentation(snap, "containers");
    expect(containers.documents.map((d) => d.id)).toEqual(["payments-overview"]);
    expect(containers.decisions.map((d) => d.id)).toEqual(["adr-0002"]);
    expect(diagramDocumentation(snap, "network-topology")).toEqual({
      documents: [],
      decisions: [],
    });
  });

  it("marks broken links and shows only the page's own diagnostics", async () => {
    const file = "docs/payments-runbook.md";
    await writeFile(
      path.join(ws.dir, file),
      `${await readFile(path.join(ws.dir, file), "utf8")}\n[gone](entity:gone)\n`,
    );
    await repo.reload();
    const view = documentPage(repo.snapshot(), "payments-runbook")!;
    expect(view.links["entity:gone"]).toBeNull();
    expect(view.links["payments-overview.md"]).toMatchObject({
      kind: "document",
      id: "payments-overview",
    });
    expect(view.diagnostics.map((d) => [d.code, d.file])).toEqual([["DOC_LINK_BROKEN", file]]);
    expect(documentPage(repo.snapshot(), "payments-overview")!.diagnostics).toEqual([]);
  });
});

describe("DOC-08 read-only documentation", () => {
  it("never writes Markdown: views, layout saves and drafts leave every .md file untouched", async () => {
    const markdown = async () =>
      Object.fromEntries(Object.entries(await hashTree(ws.dir)).filter(([f]) => f.endsWith(".md")));
    const before = await markdown();
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(6);
    const snap = repo.snapshot();
    for (const id of Object.keys(snap.model.documents)) documentPage(snap, id);
    for (const id of Object.keys(snap.model.decisions)) decisionPage(snap, id);
    const view = (await repo.diagramView("containers"))!;
    await repo.saveLayout("containers", view.saved, view.persistence.revision);
    await repo.saveDraft("containers", view.saved, null);
    expect(await markdown()).toEqual(before);
  });
});
