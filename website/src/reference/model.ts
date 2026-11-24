/**
 * The Model YAML reference: field tables from the JSON Schemas in
 * `schemas/`. `model.schema.json` covers every Project file other than
 * `project.yaml`, and is split by top-level key across three pages.
 */
import { readRepoFile } from "../lib/repo.ts";
import { fieldRows, fieldTable, type JsonSchema } from "./json-schema.ts";
import { blocks, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/model";

interface ModelPage {
  slug: string;
  title: string;
  description: string;
  schema: string;
  /** The top-level keys this page covers; all of them when absent. */
  keys?: readonly string[];
  lead: string;
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
  },
];

export function modelPages(): GeneratedPage[] {
  return PAGES.map((page, i) => {
    const source = `schemas/${page.schema}.schema.json`;
    const schema = JSON.parse(readRepoFile(source)) as JsonSchema;
    const keys = page.keys ?? Object.keys(schema.properties ?? {});
    const missing = keys.filter((k) => !schema.properties?.[k]);
    if (missing.length > 0) throw new Error(`${source} has no top-level ${missing.join(", ")}; update website/src/reference/model.ts.`);
    const sections = keys.map((key) => {
      const sub: JsonSchema = { type: "object", properties: { [key]: schema.properties![key]! }, required: schema.required?.filter((r) => r === key) ?? [] };
      return blocks(`## \`${key}\``, fieldTable(fieldRows(sub, { root: schema })));
    });
    return {
      id: `${BASE}/${page.slug}`,
      title: page.title,
      description: page.description,
      order: i + 1,
      source,
      body: blocks(
        page.lead,
        `Generated from [\`${source}\`](https://github.com/chalharb/archidocs/blob/main/${source}), which editors can use for completion and validation. \`<id>\` stands for a key you choose; \`[]\` for each item of a list.`,
        ...sections,
      ),
    };
  });
}
