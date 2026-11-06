/**
 * Deterministic benchmark workspace generator (PERF-01). Same inputs always
 * produce byte-identical files, so benchmark runs are repeatable.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface BenchSize {
  entities: number;
  relationships: number;
  /** Manual layout overrides for the first N diagram nodes. */
  manualPositions: number;
  /** Markdown `Document` and `Decision` files (DOC-01, ADR-01). Defaults to none. */
  markdownResources?: number;
}

export const MEDIUM: BenchSize = { entities: 100, relationships: 150, manualPositions: 50 };

/** BENCH-07 (ADD-009): the medium workspace plus 200 Markdown resources. */
export const WITH_MARKDOWN: BenchSize = { ...MEDIUM, markdownResources: 200 };

const H = "apiVersion: archdocs/v1\n";

export function benchFiles(size: BenchSize = MEDIUM): Record<string, string> {
  const ids = Array.from({ length: size.entities }, (_, i) => `e${String(i).padStart(4, "0")}`);
  const types = ["service", "database", "queue", "gateway"];
  const typeDocs = [
    `${H}kind: EntityType\nid: component\nname: Component\n`,
    ...types.map((t) => `${H}kind: EntityType\nid: ${t}\nname: ${t}\nextends: component\n`),
    `${H}kind: RelationshipType\nid: calls\nname: Calls\nsources: [component]\ntargets: [component]\n`,
  ];
  // Half the entities individually, half grouped, to exercise both formats.
  const half = Math.floor(ids.length / 2);
  const entity = (id: string, i: number) =>
    `id: ${id}\nname: Entity ${i}\ntype: ${types[i % types.length]}\n${i >= 10 ? `parent: ${ids[i % 10]}\n` : ""}technology: Tech ${i % 7}\ntags: [t${i % 5}]\nproperties:\n  tier: ${i % 3}\n`;
  const individual = ids.slice(0, half).map((id, i) => `${H}kind: Entity\n${entity(id, i)}`);
  const grouped =
    `${H}kind: EntitySet\nid: bench-set\nentities:\n` +
    ids
      .slice(half)
      .map((id, j) =>
        entity(id, half + j)
          .split("\n")
          .filter(Boolean)
          .map((line, k) => (k === 0 ? `  - ${line}` : `    ${line}`))
          .join("\n"),
      )
      .join("\n") +
    "\n";
  const rels = Array.from({ length: size.relationships }, (_, k) => {
    const s = k % ids.length;
    const t = (k * 7 + 3) % ids.length;
    return `  - {id: r${k}, type: calls, source: ${ids[s]}, target: ${ids[t === s ? (t + 1) % ids.length : t]}}`;
  });
  const diagram =
    `${H}kind: Diagram\nid: bench\nname: Bench\ndiagramType: custom\nnodes:\n` +
    ids.map((id) => `  - entity: ${id}`).join("\n") +
    "\nedges:\n" +
    rels.map((_, k) => `  - relationship: r${k}`).join("\n") +
    "\n";
  const layout =
    `${H}kind: DiagramLayout\ndiagram: bench\nnodes:\n` +
    ids
      .slice(0, size.manualPositions)
      .map((id, i) => `  ${id}: {x: ${(i % 10) * 300}, y: ${Math.floor(i / 10) * 200}}`)
      .join("\n") +
    "\n";

  const files: Record<string, string> = {
    "workspace.yaml": `${H}kind: Workspace\nid: bench\nname: Bench\n`,
    "types.yaml": typeDocs.join("---\n"),
    "entities/grouped.yaml": grouped,
    "relationships.yaml": `${H}kind: RelationshipSet\nid: bench-rels\nrelationships:\n${rels.join("\n")}\n`,
    "diagrams/bench.yaml": diagram,
    "diagrams/bench.layout.yaml": layout,
  };
  individual.forEach((doc, i) => (files[`entities/individual/e${i}.yaml`] = doc));
  Object.assign(files, markdownFiles(ids, size.markdownResources ?? 0));
  return files;
}

/**
 * Every fifth resource and the one after it are decisions (2/5), the rest are
 * documents. Each references entities and the diagram in front matter and links
 * to entities, the diagram, other documents and decisions inline. Every fourth
 * decision supersedes the previous one, forming short acyclic chains (ADR-03).
 */
function markdownFiles(ids: string[], count: number): Record<string, string> {
  const files: Record<string, string> = {};
  const isDecision = (k: number) => k % 5 < 2;
  const docIds: string[] = [];
  const adrIds: string[] = [];
  for (let k = 0; k < count; k++) {
    (isDecision(k) ? adrIds : docIds).push(
      isDecision(k)
        ? `adr-${String(adrIds.length + 1).padStart(4, "0")}`
        : `doc-${String(docIds.length).padStart(4, "0")}`,
    );
  }
  const ref = (k: number, n: number) =>
    Array.from({ length: n }, (_, j) => ids[(k * 3 + j * 11) % ids.length]!);
  const DOC_HEADINGS = ["Overview", "Details", "Notes"];
  const ADR_HEADINGS = ["Context", "Decision", "Consequences"];
  const body = (k: number, ents: string[], [intro, details, outro] = DOC_HEADINGS) => {
    const doc = docIds.length ? docIds[(k * 7) % docIds.length] : undefined;
    const adr = adrIds.length ? adrIds[(k * 5) % adrIds.length] : undefined;
    return (
      `## ${intro}\n\nThe [Entity ${ents[0]}](entity:${ents[0]}) calls the ` +
      `[Entity ${ents[1]}](entity:${ents[1]}) for **section ${k}**. ` +
      `See the [bench diagram](diagram:bench) for context.\n\n` +
      `## ${details}\n\n` +
      ents.map((e) => `- [${e}](entity:${e}) handles part ${k % 9} of the flow.`).join("\n") +
      `\n\n` +
      (doc ? `Related reading: [${doc}](document:${doc}).\n` : "") +
      (adr ? `Background: [${adr}](decision:${adr}).\n` : "") +
      `\n## ${outro}\n\n\`\`\`yaml\nexample: ${k}\n\`\`\`\n\n` +
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ` +
      `incididunt ut labore et dolore magna aliqua.\n`
    );
  };
  let d = 0;
  let a = 0;
  for (let k = 0; k < count; k++) {
    const ents = ref(k, 3);
    if (isDecision(k)) {
      const id = adrIds[a]!;
      const supersedes = a > 0 && a % 4 === 0 ? adrIds[a - 1] : undefined;
      const superseded = (a + 1) % 4 === 0 && a + 1 < adrIds.length;
      files[`decisions/${id}.md`] =
        `---\n${H}kind: Decision\nid: ${id}\ntitle: Decision ${a + 1}\n` +
        `status: ${superseded ? "superseded" : "accepted"}\n` +
        `date: "2026-${String((a % 12) + 1).padStart(2, "0")}-${String((a % 28) + 1).padStart(2, "0")}"\n` +
        `deciders: [Team ${a % 3}]\ntags: [t${a % 5}]\nentities: [${ents.join(", ")}]\ndiagrams: [bench]\n` +
        (supersedes ? `supersedes: [${supersedes}]\n` : "") +
        `---\n\n${body(k, ents, ADR_HEADINGS)}`;
      a++;
    } else {
      const id = docIds[d]!;
      files[`docs/${id}.md`] =
        `---\n${H}kind: Document\nid: ${id}\ntitle: Document ${d}\n` +
        `description: Notes for section ${k}.\nowner: Team ${d % 3}\ntags: [t${d % 5}]\n` +
        `entities: [${ents.join(", ")}]\ndiagrams: [bench]\n---\n\n${body(k, ents)}`;
      d++;
    }
  }
  return files;
}

export async function writeBenchWorkspace(dir: string, size: BenchSize = MEDIUM): Promise<void> {
  for (const [rel, content] of Object.entries(benchFiles(size))) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
}
