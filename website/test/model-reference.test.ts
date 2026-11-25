import { describe, expect, it } from "vitest";
import { describedRows, describedShape, describedTable, fieldRows, sharedProperties, splitDefault, usedShapes, type DescribeOptions, type JsonSchema } from "../src/reference/json-schema.ts";
import { modelPages } from "../src/reference/model.ts";

/** The cells of every field-table row in a page's Markdown, with the table's header. */
function tableRows(body: string): { head: string[]; cells: string[] }[] {
  const split = (line: string) =>
    line
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((c) => c.trim());
  const rows: { head: string[]; cells: string[] }[] = [];
  let head: string[] | undefined;
  for (const line of body.split("\n")) {
    if (!line.startsWith("|")) head = undefined;
    else if (!head) head = split(line);
    else if (!/^\| ---/.test(line)) rows.push({ head, cells: split(line) });
  }
  return rows;
}

const pages = modelPages();
const page = (slug: string) => pages.find((p) => p.id.endsWith(`/${slug}`))!;
const headings = (body: string) => [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]!);

describe("the Model YAML reference pages", () => {
  it("gives every table the columns Field, Type, Required, Default and Description", () => {
    for (const p of pages) {
      const rows = tableRows(p.body);
      expect(rows.length, p.id).toBeGreaterThan(0);
      for (const row of rows) expect(row.head, p.id).toEqual(["Field", "Type", "Required", "Default", "Description"]);
    }
  });

  it("leaves no row without a type or a description", () => {
    for (const p of pages) {
      for (const { cells } of tableRows(p.body)) {
        expect(cells, `${p.id}: ${cells[0]!}`).toHaveLength(5);
        expect(cells[1], `${p.id}: the type of ${cells[0]!}`).not.toBe("");
        expect(cells[4], `${p.id}: the description of ${cells[0]!}`).not.toBe("");
      }
    }
  });

  it("lists the Relationship fields once on the Elements and Relationships page", () => {
    const body = page("model-yaml").body;
    const fields = tableRows(body).map((r) => r.cells[0]!);
    expect(headings(body).filter((h) => h === "Relationship")).toHaveLength(1);
    for (const field of ["to", "id", "description", "technology", "interaction", "via", "channel", "tags"]) expect(body, field).toContain(`\n| \`${field}\` |`);
    for (const field of ["interaction", "via", "channel"]) expect(fields.filter((f) => f === `\`${field}\`` || f.endsWith(`.${field}\``))).toHaveLength(1);
    expect(fields.filter((f) => f.includes("relationships["))).toEqual([]);
    expect(fields.length).toBeLessThan(40);
  });

  it("lists the common Element fields and the Link fields once, and links them from where they are used", () => {
    const body = page("model-yaml").body;
    expect(headings(body)).toEqual(["`people`", "`systems`", "`services`", "`components`", "Common Element fields", "Relationship", "Link"]);
    const fields = tableRows(body).map((r) => r.cells[0]!);
    for (const field of ["name", "owner", "links", "relationships", "label", "url"]) expect(fields.filter((f) => f === `\`${field}\`` || f.endsWith(`.${field}\``)), field).toHaveLength(1);
    for (const kind of ["Person", "System", "Service", "Component"]) expect(body).toMatch(new RegExp(`^A ${kind} (also takes|takes only) the \\[common Element fields\\]\\(/docs/reference/model/model-yaml/#common-element-fields\\)\\.$`, "m"));
    expect(body).toContain("| `relationships` | list of [Relationship](/docs/reference/model/model-yaml/#relationship) |");
    expect(body).toContain("| `systems.<id>.services` | map of id → [Service](/docs/reference/model/model-yaml/#services) |");
  });

  it("names no field twice in a table", () => {
    for (const p of pages) {
      const tables = new Map<string[], string[]>();
      for (const { head, cells } of tableRows(p.body)) tables.set(head, [...(tables.get(head) ?? []), cells[0]!]);
      for (const fields of tables.values()) expect(fields.filter((f, i) => fields.indexOf(f) !== i), p.id).toEqual([]);
    }
  });

  it("lists every shared shape of every schema, once on a page: under the key that holds it, or in a section of its own", async () => {
    for (const name of ["workspace", "project", "model", "adr"]) {
      const schema = (await import(`../../schemas/${name}.schema.json`, { with: { type: "json" } })).default as JsonSchema;
      const bodies = pages.filter((p) => p.source === `schemas/${name}.schema.json`).map((p) => p.body);
      for (const def of Object.values(schema.$defs ?? {})) {
        const title = def.title!;
        const sections = bodies.map((b) => headings(b).filter((h) => h === title).length);
        const keyed = bodies.filter((b) => new RegExp(`^\\| \`[a-z]+\\.<id>\` \\| ${title} \\|`, "m").test(b)).length;
        expect(Math.max(...sections), `${name}: ${title}`).toBeLessThanOrEqual(1);
        // A shape with a key of its own is listed there and nowhere else; any other, on each page that uses it.
        if (keyed > 0) expect([keyed, Math.max(...sections)], `${name}: ${title}`).toEqual([1, 0]);
        else expect(Math.max(...sections), `${name}: ${title}`).toBe(1);
      }
    }
  });

  it("links only to sections that exist", () => {
    const anchors = new Map(pages.map((p) => [`/${p.id}/`, new Set(headings(p.body).map((h) => h.toLowerCase().replace(/[^a-z0-9 _-]/g, "").replace(/ /g, "-")))]));
    for (const p of pages) {
      for (const [, path, hash] of p.body.matchAll(/\]\((\/docs\/reference\/model\/[a-z-]+\/)#([^)]+)\)/g)) {
        expect(anchors.get(path!)?.has(hash!), `${p.id} links ${path!}#${hash!}`).toBe(true);
      }
    }
  });

  it("shows a default in its own column, not in the description", () => {
    const rows = pages.flatMap((p) => tableRows(p.body));
    expect(rows.filter((r) => /Default:/.test(r.cells[4]!)).map((r) => r.cells[0])).toEqual([]);
    const defaults = Object.fromEntries(rows.filter((r) => r.cells[3] !== "").map((r) => [r.cells[0]!, r.cells[3]!]));
    expect(defaults).toMatchObject({
      "`services.<id>.type`": "`app`",
      "`services.<id>.external`": "`false`",
      "`interaction`": "`sync`",
      "`owner`": "the Project's `owner`",
      "`paths`": "`shortest`",
      "`views.structural.<id>.direction`": "`LR`, or `TB` for a Deployment View",
    });
  });

  it("states the id pattern and names the types it uses on each page", () => {
    expect(page("workspace-yaml").body).toContain("- **id**: a lowercase slug of `a-z`, `0-9` and `-` that starts with a letter or a digit (`^[a-z0-9][a-z0-9-]*$`).");
    expect(page("project-yaml").body).toContain("| `id` | id | yes |");
    expect(page("adr-frontmatter").body).toContain("- **ADR reference**:");
    expect(page("adr-frontmatter").body).toContain("| `date` | date | yes |");
    expect(page("project-yaml").body).not.toContain("- **reference**:");
    for (const p of pages) expect(p.body, p.id).not.toContain("Must match");
  });
});

/** A small schema with a shape used twice (Link), one that nests in itself (Folder) and a union (Pick). */
const sample: JsonSchema = {
  type: "object",
  properties: {
    folders: { type: "object", description: "Folders, keyed by id.", propertyNames: { type: "string", pattern: "^[a-z]+$" }, additionalProperties: { $ref: "#/$defs/Folder" } },
    picks: { type: "array", description: "What to show. Default: everything.", items: { $ref: "#/$defs/Pick" } },
    notes: {
      type: "array",
      description: "Notes",
      minItems: 1,
      items: { type: "object", description: "One note.", properties: { text: { type: "string", description: "Its text." }, code: { type: "string", pattern: "^N\\d+$", description: "Its code." } }, required: ["text"] },
    },
  },
  required: ["folders"],
  $defs: {
    Link: { type: "object", title: "Link", description: "A link.", properties: { url: { type: "string", format: "uri", description: "Where it goes." } }, required: ["url"] },
    Folder: {
      type: "object",
      title: "Folder",
      description: "A folder.",
      properties: {
        name: { type: "string", description: "Its name." },
        mode: { type: "string", enum: ["open", "closed"], description: "`open` or `closed`. Default: `open`." },
        links: { type: "array", description: "Its links.", items: { $ref: "#/$defs/Link" } },
        folders: { type: "object", description: "Folders inside it.", propertyNames: { type: "string", pattern: "^[a-z]+$" }, additionalProperties: { $ref: "#/$defs/Folder" } },
      },
      required: ["name"],
    },
    Pick: {
      title: "Pick",
      description: "One pick.",
      anyOf: [
        { type: "string", pattern: "^[a-z]+$", description: "A folder, by id." },
        { type: "object", description: "Folders by depth.", properties: { depth: { anyOf: [{ type: "integer", minimum: 1 }, { type: "string", const: "all" }], description: "How deep." } }, required: ["depth"] },
        { $ref: "#/$defs/Link" },
      ],
    },
  },
};

const options: DescribeOptions = {
  root: sample,
  patterns: { "^[a-z]+$": "id" },
  shapes: { Link: { label: "Link", href: "#link" }, Folder: { label: "Folder", href: "#folders" }, Pick: { label: "Pick", href: "#pick" } },
};

describe("field tables with shared shapes", () => {
  it("links a shared shape where it is used, and expands only the one the table is the home of", () => {
    const used = new Set<string>();
    expect(describedTable(describedRows(sample, { ...options, expand: "Folder", omit: ["name"], used }))).toMatchInlineSnapshot(`
      "| Field | Type | Required | Default | Description |
      | --- | --- | --- | --- | --- |
      | \`folders\` | map of id → Folder | yes |  | Folders, keyed by id. |
      | \`folders.<id>\` | Folder |  |  | A folder. |
      | \`folders.<id>.mode\` | \`open\` or \`closed\` |  | \`open\` | \`open\` or \`closed\`. |
      | \`folders.<id>.links\` | list of [Link](#link) |  |  | Its links. |
      | \`folders.<id>.folders\` | map of id → [Folder](#folders) |  |  | Folders inside it. |
      | \`picks\` | list of [Pick](#pick) |  | everything | What to show. |
      | \`notes\` | list of object |  |  | Notes. At least 1 item. |
      | \`notes[]\` | object |  |  | One note. |
      | \`notes[].text\` | string | yes |  | Its text. |
      | \`notes[].code\` | string |  |  | Its code. Must match \`^N\\d+$\`. |"
    `);
    expect([...used]).toEqual(["id"]);
  });

  it("renders a union as its alternatives, each map with a table of its own", () => {
    expect(describedShape(sample.$defs!["Pick"]!, options)).toMatchInlineSnapshot(`
      "**id**: A folder, by id.

      **\`{depth}\`**: Folders by depth.

      | Field | Type | Required | Default | Description |
      | --- | --- | --- | --- | --- |
      | \`depth\` | integer ≥ 1 or \`all\` | yes |  | How deep. |

      **\`{url}\`**: A link. Its fields are under [Link](#link).
      "
    `);
    expect(describedShape(sample.$defs!["Link"]!, options)).toContain("| `url` | URL | yes |  | Where it goes. |");
  });

  it("finds the shapes a schema uses, in order, and the properties shapes share", () => {
    expect(usedShapes(sample, sample)).toEqual(["Folder", "Link", "Pick"]);
    expect(usedShapes(sample, sample, (name) => name !== "Folder")).toEqual(["Folder", "Pick", "Link"]);
    const a: JsonSchema = { properties: { name: { type: "string" }, size: { type: "integer" }, kind: { type: "string" } }, required: ["name"] };
    const b: JsonSchema = { properties: { name: { type: "string" }, size: { type: "number" }, kind: { type: "string" } }, required: ["name", "kind"] };
    expect(sharedProperties([a, b])).toEqual(["name"]);
  });

  it("splits a closing Default sentence from a description", () => {
    expect(splitDefault("The way it runs. Default: `LR`, or `TB` for a Deployment View.")).toEqual({ description: "The way it runs.", default: "`LR`, or `TB` for a Deployment View" });
    expect(splitDefault("No default here.")).toEqual({ description: "No default here.", default: "" });
  });

  it("still flattens a schema into one table for the MCP tool reference", () => {
    expect(fieldRows(sample).map((r) => r.path)).toEqual(["folders", "folders.<id>.name", "folders.<id>.mode", "folders.<id>.links", "folders.<id>.links[].url", "folders.<id>.folders", "picks", "picks[].depth", "picks[].url", "notes", "notes[].text", "notes[].code"]);
  });
});
