import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BASE_TYPES, docs, buildModel, res } from "../../tests/helpers/model";
import { supersessionCycles, validateDocumentation } from "./documentation";
import { buildGraphIndex, lookup } from "./graph-index";

const MODEL = docs(
  BASE_TYPES,
  res("Entity", "id: api\nname: API\ntype: container"),
  res("Entity", "id: db\nname: DB\ntype: container"),
  res("Diagram", "id: d\nname: D\ndiagramType: custom\nnodes: [{entity: api}]"),
);
const SECTIONS = "\n## Context\n\n## Decision\n\n## Consequences\n";

const md = (kind: string, front: string, body = "") => `---\n${res(kind, front)}---\n${body}`;
const adr = (id: string, extra = "", status = "accepted", body = SECTIONS) =>
  md("Decision", `id: ${id}\ntitle: ${id}\nstatus: ${status}\ndate: "2026-01-01"\n${extra}`, body);

function load(files: Record<string, string>) {
  const { model, diagnostics } = buildModel({ "model.yaml": MODEL, ...files });
  return { model, diagnostics: diagnostics.filter((d) => d.code !== "WORKSPACE_MISSING") };
}
const summary = (files: Record<string, string>) =>
  load(files).diagnostics.map((d) => [d.code, d.severity, d.file, d.path ?? d.line]);

describe("DOC-03 front-matter traceability", () => {
  it("accepts known references and warns on unknown ones", () => {
    expect(
      summary({
        "a.md": md("Document", "id: a\ntitle: A\nentities: [api, nope]\ndiagrams: [d, gone]"),
      }),
    ).toEqual([
      ["DOC_REF_MISSING", "warning", "a.md", ["diagrams", 1]],
      ["DOC_REF_MISSING", "warning", "a.md", ["entities", 1]],
    ]);
  });

  it("checks decision references too", () => {
    expect(summary({ "x.md": adr("x", "entities: [ghost]\nsupersedes: [missing]") })).toEqual([
      ["DOC_REF_MISSING", "warning", "x.md", ["entities", 0]],
      ["DOC_REF_MISSING", "warning", "x.md", ["supersedes", 0]],
    ]);
  });
});

describe("DOC-04 inline links", () => {
  it("resolves model links and links to other resources' files", () => {
    const files = {
      "docs/a.md": md(
        "Document",
        "id: a\ntitle: A",
        "[e](entity:api) [d](diagram:d) [x](decision:x) [b](document:b) [file](../adr/x.md)\n",
      ),
      "docs/b.md": md("Document", "id: b\ntitle: B"),
      "adr/x.md": adr("x"),
    };
    expect(load(files).diagnostics).toEqual([]);
  });

  it("warns on each broken link with its line and column", () => {
    const { diagnostics } = load({
      "docs/a.md": md(
        "Document",
        "id: a\ntitle: A",
        "\n[e](entity:nope)\n\n[f](missing.md) [g](../../escape.md) [h](decision:none)\n",
      ),
    });
    expect(diagnostics.map((d) => [d.code, d.line, d.column, d.message])).toEqual([
      ["DOC_LINK_BROKEN", 10, 17, "Link '../../escape.md' points outside the workspace"],
      ["DOC_LINK_BROKEN", 10, 38, "Link 'decision:none' points to unknown decision 'none'"],
      ["DOC_LINK_BROKEN", 8, 1, "Link 'entity:nope' points to unknown entity 'nope'"],
      [
        "DOC_LINK_BROKEN",
        10,
        1,
        "Link 'missing.md' points to 'docs/missing.md', which isn't a document or decision",
      ],
    ]);
  });
});

describe("ADR-02 recommended sections", () => {
  it("accepts the three sections at any heading level, case-insensitively", () => {
    expect(
      summary({ "x.md": adr("x", "", "accepted", "# context\n### DECISION\n## Consequences\n") }),
    ).toEqual([]);
  });

  it("warns once, at the start of the body, listing what's missing", () => {
    const { diagnostics } = load({ "x.md": adr("x", "", "accepted", "## Context\n") });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "ADR_SECTION_MISSING",
        severity: "warning",
        line: 9,
        message: "Decision 'x' has no Decision, Consequences sections",
      }),
    ]);
  });
});

describe("ADR-03 supersession", () => {
  it("derives superseded-by and accepts a consistent chain", () => {
    const files = {
      "1.md": adr("adr-1", "", "superseded"),
      "2.md": adr("adr-2", "supersedes: [adr-1]", "superseded"),
      "3.md": adr("adr-3", "supersedes: [adr-2, adr-2]"),
    };
    const { model, diagnostics } = load(files);
    expect(diagnostics).toEqual([]);
    const index = buildGraphIndex(model);
    expect(lookup.supersededBy(index, "adr-1")).toEqual(["adr-2"]);
    expect(lookup.supersededBy(index, "adr-2")).toEqual(["adr-3"]);
    expect(lookup.supersededBy(index, "adr-3")).toEqual([]);
  });

  it("warns when status and supersession disagree", () => {
    expect(
      summary({
        "1.md": adr("adr-1"),
        "2.md": adr("adr-2", "supersedes: [adr-1]"),
        "3.md": adr("adr-3", "", "superseded"),
      }),
    ).toEqual([
      ["ADR_STATUS_MISMATCH", "warning", "1.md", ["status"]],
      ["ADR_STATUS_MISMATCH", "warning", "3.md", ["status"]],
    ]);
  });

  it("reports a cycle as an error on every decision in it, including self-supersession", () => {
    expect(
      summary({
        "a.md": adr("a", "supersedes: [b]", "superseded"),
        "b.md": adr("b", "supersedes: [c]", "superseded"),
        "c.md": adr("c", "supersedes: [a]", "superseded"),
        "s.md": adr("s", "supersedes: [s]", "superseded"),
      }),
    ).toEqual([
      ["ADR_SUPERSESSION_CYCLE", "error", "a.md", ["supersedes"]],
      ["ADR_SUPERSESSION_CYCLE", "error", "b.md", ["supersedes"]],
      ["ADR_SUPERSESSION_CYCLE", "error", "c.md", ["supersedes"]],
      ["ADR_SUPERSESSION_CYCLE", "error", "s.md", ["supersedes"]],
    ]);
  });

  it("finds exactly the decisions on cycles, for any supersession graph", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.integer({ min: 0, max: 7 }), { maxLength: 3 }), {
          minLength: 1,
          maxLength: 8,
        }),
        (edges) => {
          const ids = edges.map((_, i) => `d${i}`);
          const files = Object.fromEntries(
            edges.map((targets, i) => [
              `${i}.md`,
              adr(
                ids[i]!,
                `supersedes: [${targets
                  .filter((t) => t < edges.length)
                  .map((t) => ids[t])
                  .join(", ")}]`,
              ),
            ]),
          );
          const { model } = load(files);
          const reaches = (from: string, to: string) => {
            const seen = new Set<string>();
            const queue = [...model.decisions[from]!.supersedes];
            while (queue.length) {
              const next = queue.shift()!;
              if (next === to) return true;
              if (seen.has(next)) continue;
              seen.add(next);
              queue.push(...model.decisions[next]!.supersedes);
            }
            return false;
          };
          const onCycle = new Set(supersessionCycles(model).flat());
          for (const id of ids) expect(onCycle.has(id), id).toBe(reaches(id, id));
        },
      ),
    );
  });
});

describe("DOC-05 reverse references", () => {
  it("indexes front-matter and inline references to entities and diagrams", () => {
    const { model } = load({
      "a.md": md(
        "Document",
        "id: a\ntitle: A\nentities: [api]",
        "[db](entity:db) [d](diagram:d)\n",
      ),
      "b.md": md("Document", "id: b\ntitle: B\ndiagrams: [d]", "[broken](entity:nope)\n"),
      "x.md": adr("x", "entities: [api, nope]", "accepted", `${SECTIONS}\n[api](entity:api)\n`),
    });
    const index = buildGraphIndex(model);
    expect(lookup.documentsForEntity(index, "api")).toEqual(["a"]);
    expect(lookup.documentsForEntity(index, "db")).toEqual(["a"]);
    expect(lookup.decisionsForEntity(index, "api")).toEqual(["x"]);
    expect(lookup.documentsForDiagram(index, "d")).toEqual(["a", "b"]);
    expect(lookup.decisionsForDiagram(index, "d")).toEqual([]);
    expect(lookup.documentsForEntity(index, "nope")).toEqual([]);
    expect(index.entityDocuments).not.toHaveProperty("nope");
  });

  it("gives the same index and diagnostics whatever the file order", () => {
    const files: Record<string, string> = {
      "a.md": md("Document", "id: a\ntitle: A\nentities: [api]", "[x](decision:x) [b](b.md)\n"),
      "b.md": md("Document", "id: b\ntitle: B", "[d](diagram:d) [bad](entity:nope)\n"),
      "x.md": adr("x", "supersedes: [y]\nentities: [db]"),
      "y.md": adr("y", "", "superseded"),
    };
    const reference = load(files);
    const expected = JSON.stringify([buildGraphIndex(reference.model), reference.diagnostics]);
    fc.assert(
      fc.property(fc.shuffledSubarray(Object.keys(files), { minLength: 4 }), (order) => {
        const shuffled = load(Object.fromEntries(order.map((f) => [f, files[f]!])));
        expect(JSON.stringify([buildGraphIndex(shuffled.model), shuffled.diagnostics])).toBe(
          expected,
        );
      }),
    );
  });

  it("validation has no opinion on a model without documents", () => {
    expect(validateDocumentation(load({}).model)).toEqual([]);
  });
});
