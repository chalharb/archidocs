import { describe, expect, it } from "vitest";
import { jsonSchemas } from "../../src/schema/index.ts";

interface Node {
  description?: string;
  title?: string;
  properties?: Record<string, Node>;
  additionalProperties?: boolean | Node;
  items?: Node;
  anyOf?: Node[];
  enum?: unknown[];
  $ref?: string;
  $defs?: Record<string, Node>;
}

interface Described {
  /** Where it is, as `model: $defs.Service.properties.type`. */
  at: string;
  node: Node;
  /** Its own description, or for a bare `$ref` the description of the shape it names. */
  description: string | undefined;
}

/**
 * Everything in a schema that an editor shows a description for, and the
 * Model YAML reference prints one for: each property, each shared shape under
 * `$defs`, each entry of a map or list that is itself a map, and each
 * alternative of a union.
 */
function described(name: string, root: Node): Described[] {
  const found: Described[] = [];
  const resolve = (node: Node) => (node.$ref ? root.$defs?.[node.$ref.replace("#/$defs/", "")] : node);
  const add = (at: string, node: Node) => found.push({ at: `${name}: ${at}`, node, description: node.description ?? resolve(node)?.description });
  const walk = (node: Node, at: string) => {
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      add(`${at}.properties.${key}`, child);
      walk(child, `${at}.properties.${key}`);
    }
    for (const [key, entry] of [["additionalProperties", node.additionalProperties], ["items", node.items]] as const) {
      if (typeof entry !== "object") continue;
      if (entry.properties) add(`${at}.${key}`, entry);
      walk(entry, `${at}.${key}`);
    }
    node.anyOf?.forEach((variant, i) => {
      // A scalar alternative of a field (`shortest` or a number) is covered by the field's own description.
      if (variant.properties || variant.$ref || /^\$defs\.[^.]+$/.test(at)) add(`${at}.anyOf.${i}`, variant);
      walk(variant, `${at}.anyOf.${i}`);
    });
  };
  walk(root, "");
  for (const [shape, def] of Object.entries(root.$defs ?? {})) {
    add(`$defs.${shape}`, def);
    walk(def, `$defs.${shape}`);
  }
  return found;
}

const all = Object.entries(jsonSchemas()).flatMap(([name, schema]) => described(name, schema as Node));

describe("schema descriptions", () => {
  it("finds the fields of every schema", () => {
    expect(all.length).toBeGreaterThan(100);
    for (const name of ["workspace", "project", "model", "adr"]) expect(all.some((d) => d.at.startsWith(`${name}: `))).toBe(true);
  });

  it("describes every property, shared shape, map entry and union alternative", () => {
    const missing = all.filter((d) => (d.description ?? "").trim() === "").map((d) => d.at);
    expect(missing, "add a `.describe(…)` in src/schema/, then run `pnpm schemas`").toEqual([]);
  });

  it("reports a property that has no description", () => {
    const schema: Node = { properties: { name: { description: "The name." }, colour: {} }, $defs: { Link: { properties: { url: {} } } } };
    const missing = described("sample", schema).filter((d) => !d.description).map((d) => d.at);
    expect(missing).toEqual(["sample: .properties.colour", "sample: $defs.Link", "sample: $defs.Link.properties.url"]);
  });

  it("writes each description as sentences that end in a full stop", () => {
    expect(all.filter((d) => d.description && !/[.]$/.test(d.description)).map((d) => d.at)).toEqual([]);
  });

  it("says what each value of an enum means", () => {
    const unexplained = all.flatMap((d) => (d.node.enum ?? []).filter((value) => !d.description?.includes(`\`${String(value)}\``)).map((value) => `${d.at}: ${String(value)}`));
    expect(unexplained).toEqual([]);
  });

  it("states a default only as a closing `Default: ….` sentence, which the reference reads", () => {
    const misplaced = all.filter((d) => /default/i.test(d.description ?? "") && !/ Default: [^.]+(\.[^ ][^.]*)*\.$/.test(d.description!)).map((d) => d.at);
    expect(misplaced).toEqual([]);
    expect(all.filter((d) => (d.description?.match(/Default: /g) ?? []).length > 1).map((d) => d.at)).toEqual([]);
  });

  it("gives every shared shape a title for editors and the reference to call it by", () => {
    for (const schema of Object.values(jsonSchemas())) {
      for (const [shape, def] of Object.entries((schema as Node).$defs ?? {})) expect(def.title, shape).toBeTruthy();
    }
  });
});
