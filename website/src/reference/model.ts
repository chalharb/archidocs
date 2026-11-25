/**
 * The Model YAML reference: field tables from the JSON Schemas in
 * `schemas/`. `model.schema.json` covers every Project file other than
 * `project.yaml`, and is split by top-level key across three pages.
 *
 * Each top-level key has a section. A shape the schema defines once under
 * `$defs` is listed once: in the section of the key that holds it (`services`
 * for Service), or else in a section of its own (Relationship, Link), and
 * linked from every other place it is used.
 */
import { readRepoFile } from "../lib/repo.ts";
import { describedRows, describedShape, describedTable, sharedProperties, usedShapes, type DescribeOptions, type JsonSchema, type ShapeLink } from "./json-schema.ts";
import { blocks, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/model";

interface ModelPage {
  slug: string;
  title: string;
  description: string;
  schema: string;
  /** The top-level keys this page covers; all of them when absent. */
  keys?: readonly string[];
  lead: string;
  /** The rule `archidocs check` reports for a key the schema doesn't have; `unknown-field` when absent. */
  unknownKey?: string;
  /** The heading for the fields that every shape with a key on this page takes, listed once under it. */
  common?: string;
  /** Shared shapes to list first, ahead of the order the page first uses them in. */
  first?: readonly string[];
}

const PAGES: readonly ModelPage[] = [
  {
    slug: "workspace-yaml",
    title: "workspace.yaml",
    description: "The Workspace file: its Teams and Environments.",
    schema: "workspace",
    lead: "`workspace.yaml` sits at the Workspace root and defines the Teams and Environments every Project uses.",
  },
  {
    slug: "project-yaml",
    title: "project.yaml",
    description: "The file that marks a Project folder: its id, name and Owner Team.",
    schema: "project",
    lead: "`project.yaml` marks a folder as a Project and names its default Owner Team.",
  },
  {
    slug: "model-yaml",
    title: "Elements and Relationships",
    description: "Persons, Systems, Services and Components, and their Relationships, in a Project's YAML files.",
    schema: "model",
    keys: ["people", "systems", "services", "components"],
    lead: "Every other `.yaml` file in a Project folder follows one schema. These keys declare its Elements and, under each consumer, its Relationships.",
    common: "Common Element fields",
    first: ["Relationship"],
  },
  {
    slug: "deployments-yaml",
    title: "Deployment Targets and Deployments",
    description: "Where Services run, and what runs where in each Environment.",
    schema: "model",
    keys: ["targets", "deployments"],
    lead: "These keys of a Project file declare Deployment Targets and the Deployments on them.",
  },
  {
    slug: "views-yaml",
    title: "Saved Views",
    description: "Structural, Deployment and Dynamic Views a Project keeps.",
    schema: "model",
    keys: ["views"],
    lead: "The `views` key of a Project file declares its Saved Views.",
  },
  {
    slug: "adr-frontmatter",
    title: "ADR frontmatter",
    description: "The YAML frontmatter of an ADR in a Project's `adr/` folder.",
    schema: "adr",
    lead: "An ADR is a Markdown file in `<project>/adr/`; its frontmatter links the decision to the Elements and Views it affects.",
    unknownKey: "invalid-adr-frontmatter",
  },
];

/** What the Type column calls a string that must match one of the schemas' patterns. */
const PATTERNS: Readonly<Record<string, string>> = {
  "^[a-z0-9][a-z0-9-]*$": "id",
  "^([a-z0-9][a-z0-9-]*:)?[a-z0-9][a-z0-9-]*$": "reference",
  "^([a-z0-9][a-z0-9-]*:)?\\d{4}$": "ADR reference",
};

/** What each named type means, said once on every page that uses it, in this order. */
const TYPES: Readonly<Record<string, string>> = {
  id: "a lowercase slug of `a-z`, `0-9` and `-` that starts with a letter or a digit",
  reference: "an id in the same Project, or a [Qualified id](/docs/reference/glossary/#term-qualified-id), `project:id`, for something in another Project",
  "ADR reference": "an ADR's four-digit number in the same Project, or `project:NNNN` for an ADR in another Project",
  URL: "a full URL with its scheme, such as `https://shop.example.com`",
  date: "a calendar date written `YYYY-MM-DD`",
};

/** The id Starlight gives a heading. */
const anchor = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/ /g, "-");

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** `a`, `b` and `c`. */
const all = (items: readonly string[]): string => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)!}`);

/** The shared shape a top-level key holds, when it or each of its entries is one: `services` holds Service. */
function shapeHeld(node: JsonSchema): string | undefined {
  const entry = typeof node.additionalProperties === "object" ? node.additionalProperties : (node.items ?? node);
  return entry.$ref?.replace(/^#\/\$defs\//, "");
}

export function modelPages(): GeneratedPage[] {
  const schemas = new Map<string, JsonSchema>();
  const schemaOf = (page: ModelPage): JsonSchema => {
    const source = `schemas/${page.schema}.schema.json`;
    if (!schemas.has(page.schema)) schemas.set(page.schema, JSON.parse(readRepoFile(source)) as JsonSchema);
    const schema = schemas.get(page.schema)!;
    const missing = (page.keys ?? []).filter((k) => !schema.properties?.[k]);
    if (missing.length > 0) throw new Error(`${source} has no top-level ${missing.join(", ")}; update website/src/reference/model.ts.`);
    return schema;
  };
  const keysOf = (page: ModelPage) => page.keys ?? Object.keys(schemaOf(page).properties ?? {});

  /** Where each shape that a top-level key holds is listed: `model/Service` under `services` on `model-yaml`. */
  const homes = new Map<string, { page: ModelPage; key: string }>();
  for (const page of PAGES) {
    for (const key of keysOf(page)) {
      const shape = shapeHeld(schemaOf(page).properties![key]!);
      if (shape !== undefined && !homes.has(`${page.schema}/${shape}`)) homes.set(`${page.schema}/${shape}`, { page, key });
    }
  }

  return PAGES.map((page, i) => {
    const source = `schemas/${page.schema}.schema.json`;
    const schema = schemaOf(page);
    const keys = keysOf(page);
    const defs = schema.$defs ?? {};
    const homeOf = (shape: string) => homes.get(`${page.schema}/${shape}`);
    const here = (heading: string) => `/${BASE}/${page.slug}/#${anchor(heading)}`;
    const label = (shape: string) => defs[shape]!.title ?? shape;
    const shapes: Record<string, ShapeLink> = Object.fromEntries(
      Object.keys(defs).map((shape) => {
        const home = homeOf(shape);
        return [shape, { label: label(shape), href: home ? `/${BASE}/${home.page.slug}/#${anchor(home.key)}` : here(label(shape)) }];
      }),
    );
    const used = new Set<string>();
    const options: DescribeOptions = { root: schema, shapes, patterns: PATTERNS, used };

    // The shapes with a key on this page, and the fields all of them take.
    const held = keys.map((key) => shapeHeld(schema.properties![key]!)).filter((shape): shape is string => shape !== undefined && homeOf(shape)?.page === page);
    const common = page.common !== undefined && held.length > 1 ? sharedProperties(held.map((shape) => defs[shape]!)) : [];

    const sections = keys.map((key) => {
      const shape = shapeHeld(schema.properties![key]!);
      const home = shape !== undefined && held.includes(shape) && homeOf(shape)!.key === key ? shape : undefined;
      const sub: JsonSchema = { type: "object", properties: { [key]: schema.properties![key]! }, required: schema.required?.filter((r) => r === key) ?? [] };
      const own = home === undefined ? [] : Object.keys(defs[home]!.properties ?? {}).filter((k) => !common.includes(k));
      const link = `[${lowerFirst(page.common ?? "")}](${here(page.common ?? "")})`;
      return blocks(
        `## \`${key}\``,
        describedTable(describedRows(sub, { ...options, expand: home, omit: common })),
        home !== undefined && common.length > 0 && (own.length > 0 ? `A ${label(home)} also takes the ${link}.` : `A ${label(home)} takes only the ${link}.`),
      );
    });

    if (common.length > 0) {
      const first = defs[held[0]!]!;
      const shared: JsonSchema = { type: "object", properties: Object.fromEntries(common.map((k) => [k, first.properties![k]!])), required: first.required?.filter((r) => common.includes(r)) ?? [] };
      sections.push(blocks(`## ${page.common!}`, `Every ${all(held.map(label))} takes these fields.`, describedTable(describedRows(shared, options))));
    }

    // Every other shared shape the page uses gets a section of its own. A shape listed under a key of another page is linked there.
    const sub: JsonSchema = { type: "object", properties: Object.fromEntries(keys.map((key) => [key, schema.properties![key]!])) };
    const listed = usedShapes(sub, schema, (shape) => !homeOf(shape) || homeOf(shape)!.page === page).filter((shape) => !homeOf(shape));
    const unused = (page.first ?? []).filter((shape) => !listed.includes(shape));
    if (unused.length > 0) throw new Error(`${page.slug} lists ${unused.join(", ")} first, but its keys don't use ${unused.length > 1 ? "them" : "it"}; update website/src/reference/model.ts.`);
    for (const shape of [...(page.first ?? []), ...listed.filter((s) => !page.first?.includes(s))]) {
      sections.push(blocks(`## ${label(shape)}`, text(defs[shape]!.description ?? ""), describedShape(defs[shape]!, options)));
    }

    const headings = sections.map((s) => anchor(/^## (.+)$/m.exec(s)![1]!));
    const twice = headings.filter((h, n) => headings.indexOf(h) !== n);
    if (twice.length > 0) throw new Error(`${page.slug} has two sections with the anchor #${twice[0]!}; rename one in ${source} or website/src/reference/model.ts.`);

    const unexplained = [...used].filter((type) => TYPES[type] === undefined);
    if (unexplained.length > 0) throw new Error(`${source} uses the type ${unexplained.join(", ")}, which website/src/reference/model.ts doesn't explain; add it to TYPES.`);
    const patternOf = (type: string) => Object.entries(PATTERNS).find(([, name]) => name === type)?.[0];
    const legend = Object.entries(TYPES)
      .filter(([type]) => used.has(type))
      .map(([type, means]) => `- **${type}**: ${means}${patternOf(type) === undefined ? "" : ` (\`${patternOf(type)!}\`)`}.`);
    const body = sections.join("\n");
    const notation = [body.includes("<id>") && "`<id>` stands for a key you choose", body.includes("[]") && "`[]` for each item of a list"].filter((n): n is string => typeof n === "string");
    const rule = page.unknownKey ?? "unknown-field";

    return {
      id: `${BASE}/${page.slug}`,
      title: page.title,
      description: page.description,
      order: i + 1,
      source,
      body: blocks(
        page.lead,
        `Generated from [\`${source}\`](https://github.com/chalharb/archidocs/blob/main/${source}), which [editors use](/docs/guides/model/set-up-your-editor/) for completion, validation and these descriptions on hover.${notation.length > 0 ? ` In the Field column, ${notation.join(" and ")}.` : ""} A key that isn't listed here is an error: [\`${rule}\`](/docs/reference/rules/${rule}/).`,
        legend.length > 0 && `In the Type column:\n\n${legend.join("\n")}`,
        ...sections,
      ),
    };
  });
}
