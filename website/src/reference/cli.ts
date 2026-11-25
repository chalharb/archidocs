/**
 * The CLI reference, from the structured command definitions in
 * `src/cli/commands.ts` that also drive the CLI's usage text: an index and a
 * page per command, with its examples and exit codes, and each flag a heading
 * of its own so search finds it.
 */
import { existsSync } from "node:fs";
import { commandList, EXIT, NO_WORKSPACE, usageText, type CommandDefinition, type CommandName, type FlagDefinition } from "../../../src/cli/commands.ts";
import { readRepoFile, repoPath } from "../lib/repo.ts";
import { blocks, fence, table, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/cli";
const SOURCE = "src/cli/commands.ts";

export const commandSlug = (name: string): string => name.replace(/ /g, "-");
export const commandPath = (name: string): string => `/${BASE}/${commandSlug(name)}/`;

const commandLink = (name: string): string => `[\`archidocs ${name}\`](${commandPath(name)})`;

const WORKSPACE_HEADING = "How the Workspace is found";
/** The section's link, for a command's page and for the troubleshooting entry on a Workspace that is not found. */
export const WORKSPACE_SECTION = `/${BASE}/#${WORKSPACE_HEADING.toLowerCase().replace(/ /g, "-")}`;

/**
 * Where each command starts the search for its Workspace, as the Checkout
 * module (`findCheckout` in `src/workspace/index.ts`) calls `findWorkspaceRoot`
 * (`src/core/load.ts`) from where `src/cli/run.ts` starts it; `undefined` for a command
 * that reads no Workspace. Keyed by command, so a new one must say.
 */
const WORKSPACE_SEARCH: Readonly<Record<CommandName, string | undefined>> = {
  version: undefined,
  init: "The current folder. If the search finds nothing, `init` does not fail: it writes `archidocs/workspace.yaml` at the root of the git repo, or in the current folder outside git. With `--skill` it does not search, and `--workspace <dir>` is only the path it prints in the MCP command.",
  guide: undefined,
  check: "The current folder.",
  build: "The current folder. With `--preview`, the Workspace must also be in a git repo.",
  dev: "The current folder, or `--workspace <dir>` when given.",
  export: "The current folder.",
  diff: "The current folder. The Workspace must also be in a git repo.",
  "history build": "The current folder. The Workspace must also be in a git repo.",
  mcp: "The current folder, or `--workspace <dir>` when given. With `--bundle` it does not search: it serves the published Bundle.",
};

/** A page to read next: a hand-written page, whose title is read from its frontmatter, or a generated one, whose title is given. */
export interface SeeAlso {
  /** The page's URL on the site, with its trailing slash. */
  readonly href: string;
  /** The link's text, for a generated page. */
  readonly title?: string;
  /** What the page does with the command. */
  readonly why: string;
}

/** The pages that use each command. Keyed by command, so a new one must name its guide. */
export const SEE_ALSO: Readonly<Record<CommandName, readonly SeeAlso[]>> = {
  version: [{ href: "/docs/guides/publish/other-hosts/", why: "keys the CI cache of past Bundles by the `schemaVersion` it prints" }],
  init: [
    { href: "/docs/start/quick-start/", why: "starts a Workspace with it" },
    { href: "/docs/guides/agents/install-skill/", why: "what the skill is, and `--skill` for a code repo" },
  ],
  guide: [
    { href: "/docs/guides/agents/install-skill/", why: "how the installed skill points agents at the guide" },
    { href: "/docs/reference/agent-guide/", title: "Authoring guide for agents", why: "the guide it prints, for the latest release" },
  ],
  check: [
    { href: "/docs/guides/model/add-a-service/", why: "ends an edit to the Model with it" },
    { href: "/docs/guides/model/rename-move-remove/", why: "uses it to find every reference to an id that changed" },
    { href: "/docs/guides/publish/github-pages/", why: "runs it in CI, so a failed check publishes nothing" },
    { href: "/docs/reference/rules/", title: "Check rules", why: "every rule it reports, with its fix" },
  ],
  build: [
    { href: "/docs/guides/publish/github-pages/", why: "builds and deploys the site with the Action" },
    { href: "/docs/guides/publish/gitlab-pages/", why: "the same with the GitLab CI template" },
    { href: "/docs/guides/publish/other-hosts/", why: "runs it in any CI, with the cache headers the site wants" },
    { href: "/docs/guides/publish/pr-previews/", why: "uses `--preview` to show a pull request on Compare" },
  ],
  dev: [
    { href: "/docs/start/quick-start/", why: "opens a new Workspace in the viewer with it" },
    { href: "/docs/guides/model/save-a-view/", why: "uses the viewer it serves to write a Saved View" },
    { href: "/docs/guides/viewer/", why: "what the viewer shows" },
  ],
  export: [
    { href: "/docs/guides/review/export/", why: "exports one View or every Saved View, with each option shown" },
    { href: "/docs/guides/publish/saved-view-images/", why: "publishes the pictures with the site, at stable URLs" },
  ],
  diff: [
    { href: "/docs/guides/review/diff/", why: "reads its output, for a working tree, a branch and two dates" },
    { href: "/docs/guides/publish/pr-previews/", why: "posts `--format markdown` as a pull request comment" },
  ],
  "history build": [
    { href: "/docs/concepts/revisions-and-history/", why: "what the cache of past Bundles is, and when to fill it ahead of time" },
    { href: "/docs/guides/publish/other-hosts/", why: "keeps that cache between CI runs" },
  ],
  mcp: [
    { href: "/docs/guides/agents/connect-mcp/", why: "registers it with Claude Code, Cursor, VS Code / Copilot or Codex, from a checkout, a published site or over HTTP" },
    { href: "/docs/concepts/agents-and-mcp/", why: "what the server offers an agent" },
  ],
};

/** What each exit code means for the CLI as a whole; each command's page says what it means there. */
const EXIT_MEANINGS: readonly { code: number; meaning: (commands: readonly CommandDefinition[]) => string }[] = [
  { code: EXIT.ok, meaning: () => "The command did what it was asked." },
  { code: EXIT.foundErrors, meaning: (commands) => `The Workspace has errors. Only ${list(commands.map((c) => commandLink(c.name)))} exit 1.` },
  {
    code: EXIT.couldNotRun,
    meaning: () => "The command could not run. The reason is printed to stderr as `archidocs: <message>`, and after most mistakes in the command line, the usage summary above.",
  },
];

export function cliPages(commands: readonly CommandDefinition[] = commandList): GeneratedPage[] {
  return [
    {
      id: BASE,
      title: "CLI",
      label: "Overview",
      order: 0,
      description: "Every `archidocs` command, with its flags, examples and exit codes.",
      source: SOURCE,
      body: blocks(
        "A usage error prints this summary. Each command's page describes its arguments and flags, with examples and its exit codes.",
        fence("text", usageText()),
        table(
          ["Command", "What it does"],
          commands.map((c) => [commandLink(c.name), text(c.description)]),
        ),
        `## ${WORKSPACE_HEADING}`,
        "A Workspace's root is the folder that holds `workspace.yaml`. A command that needs a Workspace looks for that file in this order, and the first one it finds wins:",
        [
          "1. In the current folder: `./workspace.yaml`.",
          "2. In the current folder's `archidocs/` folder: `./archidocs/workspace.yaml`.",
          "3. In the folder above and then that folder's `archidocs/` folder, and so on for each folder above, up to the root of the file system.",
        ].join("\n"),
        "So a command finds the Workspace from the root of a repo that keeps it in `archidocs/`, from the Workspace's own folder, and from any folder inside it, such as a Project's. The search does not stop at the root of the git repo, and it looks nowhere else: a Workspace in a folder beside the current one is not found.",
        "When the search finds nothing, the command exits 2 with this message, and the usage summary after it:",
        fence("text", `archidocs: ${NO_WORKSPACE}`),
        "`--workspace <dir>` changes only where the search starts. `<dir>` is searched the same way: the folder itself, its `archidocs/` folder, then each folder above. So it can name the Workspace's folder, the repo that holds it in `archidocs/`, or any folder inside the Workspace. A relative `<dir>` is read from the current folder.",
        table(
          ["Command", "Where the search starts"],
          commands.map((c) => [commandLink(c.name), WORKSPACE_SEARCH[c.name as CommandName] ?? "It reads no Workspace."]),
        ),
        "## Exit codes",
        table(
          ["Code", "Meaning"],
          EXIT_MEANINGS.map(({ code, meaning }) => [`\`${code}\``, meaning(commands.filter((c) => c.exitCodes.some((e) => e.code === code)))]),
        ),
        "Each command's page says what its exit codes mean for it.",
      ),
    },
    ...commands.map((c, i) => commandPage(c, i + 1)),
  ];
}

function commandPage(command: CommandDefinition, order: number): GeneratedPage {
  const flags = Object.entries(command.flags);
  const seeAlso = [
    ...(SEE_ALSO[command.name as CommandName] ?? []),
    ...(WORKSPACE_SEARCH[command.name as CommandName] === undefined ? [] : [{ href: WORKSPACE_SECTION, title: WORKSPACE_HEADING, why: "where it looks for `workspace.yaml`" }]),
  ];
  return {
    id: `${BASE}/${commandSlug(command.name)}`,
    title: `archidocs ${command.name}`,
    label: command.name,
    order,
    description: command.description,
    source: SOURCE,
    body: blocks(
      text(command.description),
      "## Usage",
      fence("text", command.synopsis.map((s) => `archidocs ${s}`).join("\n")),
      "## Examples",
      // A shell fence each, so the build checks every line against the definitions like any page's.
      ...command.examples.flatMap((e) => [text(e.description), fence("sh", e.command)]),
      command.arguments.length > 0 && "## Arguments",
      command.arguments.length > 0 && table(["Argument", "Meaning"], command.arguments.map((a) => [`\`${a.name}\``, text(a.description)])),
      "## Flags",
      flags.length === 0 && "This command takes no flags.",
      ...flags.map(([name, flag]) => flagSection(name, flag)),
      "## Exit codes",
      table(
        ["Code", "Meaning"],
        command.exitCodes.map((e) => [`\`${e.code}\``, text(e.meaning)]),
      ),
      command.exitNote !== undefined && text(command.exitNote),
      "Exit 2 prints the reason to stderr as `archidocs: <message>`, and after most mistakes in the command line, the usage summary.",
      seeAlso.length > 0 && "## See also",
      seeAlso.map((s) => `- [${s.title ?? handWrittenTitle(s.href)}](${s.href}): ${text(s.why)}.`).join("\n"),
    ),
  };
}

function flagSection(name: string, flag: FlagDefinition): string {
  const facts = [
    flag.type === "boolean" ? `\`--${name}\`` : `\`--${name} ${flag.value ?? "<value>"}\``,
    flag.defaultText !== undefined ? `Default: ${text(flag.defaultText)}.` : flag.default !== undefined && flag.default !== false ? `Default: \`${String(flag.default)}\`.` : flag.type === "boolean" ? "Off by default." : undefined,
  ].filter((f) => f !== undefined);
  return blocks(`### \`--${name}\``, facts.join(" · "), text(flag.description));
}

/** `a`, `a and b`, or `a, b and c`. */
const list = (items: readonly string[]): string => (items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** The file of a hand-written page, by its URL on the site. */
export function handWrittenFile(href: string): string | undefined {
  const base = `website/src/content/docs${href.replace(/\/$/, "")}`;
  return [".mdx", ".md", "/index.mdx", "/index.md"].map((ext) => base + ext).find((file) => existsSync(repoPath(file)));
}

/** A hand-written page's title, from its frontmatter, so the link's text follows the page when it is retitled. */
function handWrittenTitle(href: string): string {
  const file = handWrittenFile(href);
  if (!file) throw new Error(`The CLI reference links to ${href}, which is not a hand-written page; give the link a title if the page is generated.`);
  const title = /^title:\s*(.+)$/m.exec(readRepoFile(file))?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!title) throw new Error(`${file} has no title in its frontmatter.`);
  return title;
}
