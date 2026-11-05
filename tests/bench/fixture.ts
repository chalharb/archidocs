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
}

export const MEDIUM: BenchSize = { entities: 100, relationships: 150, manualPositions: 50 };

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
  return files;
}

export async function writeBenchWorkspace(dir: string, size: BenchSize = MEDIUM): Promise<void> {
  for (const [rel, content] of Object.entries(benchFiles(size))) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
}
