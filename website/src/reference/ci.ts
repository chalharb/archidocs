/**
 * The CI reference: the GitHub Action's inputs and outputs from `action.yml`,
 * and the GitLab CI template's inputs from its `spec:` block.
 */
import { parse, parseAllDocuments } from "yaml";
import { readRepoFile } from "../lib/repo.ts";
import { blocks, table, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/ci";

interface Input {
  description?: string;
  default?: unknown;
  type?: string;
  options?: unknown[];
}

const defaultText = (value: unknown): string => (value === undefined ? "" : value === "" ? "empty" : `\`${String(value)}\``);

const inputsTable = (inputs: Record<string, Input>): string =>
  table(
    ["Input", "Default", "Description"],
    Object.entries(inputs).map(([name, input]) => [`\`${name}\``, defaultText(input.default), text(input.description ?? "")]),
  );

export function ciPages(): GeneratedPage[] {
  const action = parse(readRepoFile("action.yml")) as { description: string; inputs: Record<string, Input>; outputs: Record<string, { description?: string }> };
  const [spec] = parseAllDocuments(readRepoFile("templates/gitlab/archidocs.gitlab-ci.yml"));
  const gitlab = (spec?.toJS() as { spec?: { inputs?: Record<string, Input> } } | undefined)?.spec?.inputs ?? {};
  return [
    {
      id: `${BASE}/github-action`,
      title: "GitHub Action",
      order: 1,
      description: action.description,
      source: "action.yml",
      body: blocks(
        text(action.description),
        "Use it as `chalharb/archidocs@<ref>` in a workflow that checks out with full history (`fetch-depth: 0`).",
        "## Inputs",
        inputsTable(action.inputs),
        "## Outputs",
        table(
          ["Output", "Description"],
          Object.entries(action.outputs).map(([name, o]) => [`\`${name}\``, text(o.description ?? "")]),
        ),
      ),
    },
    {
      id: `${BASE}/gitlab-template`,
      title: "GitLab CI template",
      order: 2,
      description: "A GitLab CI include that checks the Workspace, publishes it to GitLab Pages and builds merge request previews.",
      source: "templates/gitlab/archidocs.gitlab-ci.yml",
      body: blocks(
        "Include `templates/gitlab/archidocs.gitlab-ci.yml` from this repo at a pinned ref, and set its inputs under `inputs:`.",
        "## Inputs",
        inputsTable(gitlab),
      ),
    },
  ];
}
