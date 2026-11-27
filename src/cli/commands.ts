/**
 * The CLI's commands and flags, described once. The CLI parses each
 * command's arguments with these flags and prints its usage text from them;
 * the docs site generates its CLI reference from them, examples and exit
 * codes included, and checks every `archidocs …` line in a page with
 * `parseCommandLine`. Importing this module has no side effects and pulls in
 * nothing but `node:util`.
 */
import { parseArgs } from "node:util";

/** The CLI's exit codes: 0 no errors, 1 errors found (or any warning with `check --strict`), 2 could not run. */
export const EXIT = { ok: 0, foundErrors: 1, couldNotRun: 2 } as const;

/** What a command that needs a Workspace says, exiting 2, when the search for one finds none. */
export const NO_WORKSPACE = "No workspace.yaml found in this folder, its archidocs/ folder, or any folder above.";

/** One flag. Its key in `flags` is its name, without the leading `--`. */
export interface FlagDefinition {
  readonly type: "string" | "boolean";
  /** What a string flag takes, as the usage shows it: `<dir>` or `text|json`. */
  readonly value?: string;
  /** The value the parser fills in when the flag is absent. */
  readonly default?: string | boolean;
  /** The default in words, for a flag whose default the command works out itself. */
  readonly defaultText?: string;
  readonly description: string;
}

/** A positional argument, as the synopsis writes it: `<view-id>` or `[topic]`. */
export interface ArgumentDefinition {
  readonly name: string;
  readonly description: string;
}

/** One real command line for the reference, checked like any other with `parseCommandLine`. */
export interface ExampleDefinition {
  /** The whole line as typed, starting with `archidocs`. */
  readonly command: string;
  /** One line on what it does. */
  readonly description: string;
}

/** One exit code a command can end with. */
export interface ExitCodeDefinition {
  readonly code: (typeof EXIT)[keyof typeof EXIT];
  /** When the command ends with it. */
  readonly meaning: string;
}

export interface CommandDefinition {
  /** The words after `archidocs`: `check`, or `history build` for a subcommand. */
  readonly name: string;
  /** Each way to call it, after `archidocs `. */
  readonly synopsis: readonly string[];
  /** One line on what it does. */
  readonly description: string;
  readonly arguments: readonly ArgumentDefinition[];
  readonly flags: Readonly<Record<string, FlagDefinition>>;
  /** At least one, the plainest first. */
  readonly examples: readonly [ExampleDefinition, ...ExampleDefinition[]];
  /** Every exit code the command itself ends with, lowest first. */
  readonly exitCodes: readonly [ExitCodeDefinition, ...ExitCodeDefinition[]];
  /** For a command that serves until it is stopped: how it ends, when no exit code is its own. */
  readonly exitNote?: string;
}

/** How every command's exit 2 starts: the command line itself was refused. */
const USAGE_ERROR = "an unknown flag, a flag missing its value";

export const commands = {
  version: {
    name: "version",
    synopsis: ["version [--format text|json]"],
    description: "Print the CLI's version and the Bundle schemaVersion it writes.",
    arguments: [],
    flags: {
      format: { type: "string", value: "text|json", default: "text", description: "Print a line of text, or a JSON object with `version` and `schemaVersion`." },
    },
    examples: [
      { command: "archidocs version", description: "Print both versions as one line of text." },
      { command: "archidocs version --format json", description: "Print them as JSON, for a CI cache key that changes when the Bundle schemaVersion does." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "The version was printed." },
      { code: EXIT.couldNotRun, meaning: `It could not run: ${USAGE_ERROR}, or an unknown format.` },
    ],
  },
  init: {
    name: "init",
    synopsis: ["init [--skill [--workspace <dir>]]"],
    description: "Set up a Workspace in this repo and install the agent skill, or with `--skill` install only the skill in a code repo. Safe to re-run.",
    arguments: [],
    flags: {
      skill: { type: "boolean", default: false, description: "Install only the agent skill and its pointers, for a code repo that has no Workspace of its own." },
      workspace: { type: "string", value: "<dir>", description: "With `--skill`: the Workspace checkout that the printed MCP command points at." },
    },
    examples: [
      { command: "archidocs init", description: "Write `archidocs/workspace.yaml` if the repo has no Workspace yet, and install the agent skill." },
      {
        command: "archidocs init --skill --workspace ../architecture/archidocs",
        description: "In a code repo, install only the agent skill, and print the MCP command for the Workspace checked out beside it.",
      },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "The Workspace and the agent skill are set up, or already were. Each file written or updated is printed." },
      { code: EXIT.couldNotRun, meaning: `It could not run: ${USAGE_ERROR}, \`--workspace\` without \`--skill\`, or a file it could not write.` },
    ],
  },
  guide: {
    name: "guide",
    synopsis: ["guide [topic] [--skill <id>]"],
    description: "Print an agent skill's full guide, or one of its task topics. With no `--skill`, the authoring guide.",
    arguments: [{ name: "[topic]", description: "A task topic of the skill; with none, the guide and its list of topics." }],
    flags: {
      skill: { type: "string", value: "<id>", default: "authoring", description: "The skill whose guide to print. `authoring` is the one there is today." },
    },
    examples: [
      { command: "archidocs guide", description: "Print the authoring guide: the Model in brief, the edit loop and the list of task topics." },
      { command: "archidocs guide add-service", description: "Print one task topic, here how to add a Service." },
      { command: "archidocs guide --skill authoring", description: "Name the skill, as a skill's stub does: the same as `archidocs guide`." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "The guide or the topic was printed." },
      { code: EXIT.couldNotRun, meaning: "It could not run: an unknown skill or topic (the message names the closest one and lists them all), a topic on a skill without topics, more than one topic, or an unknown flag." },
    ],
  },
  check: {
    name: "check",
    synopsis: ["check [--format text|json|github] [--strict]"],
    description: "Validate the Workspace found from the current folder and print each issue with its file, line and rule.",
    arguments: [],
    flags: {
      format: { type: "string", value: "text|json|github", default: "text", description: "Print issues as text, as JSON, or as GitHub Actions annotations." },
      strict: { type: "boolean", default: false, description: "Exit 1 on warnings too, not only on errors." },
    },
    examples: [
      { command: "archidocs check", description: "Validate the Workspace and print its issues grouped by file, then a count and a link to each rule's page." },
      { command: "archidocs check --strict", description: "Fail on warnings as well as errors, for a CI job that keeps the Workspace clean." },
      { command: "archidocs check --format github", description: "Print each issue as a GitHub Actions annotation, which a pull request shows on the line the issue is about." },
      { command: "archidocs check --format json", description: "Print the issues and a count of errors and warnings as JSON, for a script." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "No errors. Warnings are printed and still exit 0, unless `--strict` is given." },
      { code: EXIT.foundErrors, meaning: "The Workspace has at least one error; with `--strict`, at least one error or warning." },
      { code: EXIT.couldNotRun, meaning: `It could not run: ${USAGE_ERROR}, an unknown format, or no Workspace found.` },
    ],
  },
  gaps: {
    name: "gaps",
    synopsis: ["gaps [--project <id>] [--owner <team>] [--json]"],
    description: "List what the Model leaves empty, grouped by Project and Owner Team: the gaps an agent's fill-gaps interview works through.",
    arguments: [],
    flags: {
      project: { type: "string", value: "<id>", description: "Only this Project's gaps." },
      owner: { type: "string", value: "<team>", description: "Only the gaps of items this Team owns." },
      json: { type: "boolean", default: false, description: "Print the gaps as JSON, in the shape the `list_gaps` MCP tool returns, instead of Markdown." },
    },
    examples: [
      { command: "archidocs gaps", description: "Print every gap as Markdown: a heading per Project and Owner Team, then a line per Element, Relationship or Deployment naming its empty fields." },
      { command: "archidocs gaps --owner payments-team", description: "Print only the gaps of what one Team owns, as a backlog to hand to that Team." },
      { command: "archidocs gaps --project shop --json", description: "Print one Project's gaps as JSON, for a script." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "The gaps were printed, or none were found. It exits 0 either way: a gap is incompleteness, not an error, and `check` never reports one." },
      { code: EXIT.foundErrors, meaning: "The Workspace has errors. They are printed as `check` prints them, and no gaps are listed." },
      { code: EXIT.couldNotRun, meaning: `It could not run: ${USAGE_ERROR}, an unknown Project or Team, or no Workspace found.` },
    ],
  },
  build: {
    name: "build",
    synopsis: ["build [--out <dir>] [--bundle-only] [--keep <n|all>]", "build --preview [--base <branch>] [--out <dir>]"],
    description: "Write the static viewer site with the Workspace's Bundle and past Revisions, or a PR preview site.",
    arguments: [],
    flags: {
      out: { type: "string", value: "<dir>", default: "dist", description: "The folder to write the site, or the Bundle, into." },
      "bundle-only": { type: "boolean", default: false, description: "Write only `workspace.bundle.json`, without the viewer or past Revisions." },
      keep: { type: "string", value: "<n|all>", defaultText: "200", description: "How many of the latest past Revisions the site keeps Bundles for, or `all`; tagged Revisions are always kept." },
      preview: { type: "boolean", default: false, description: "Build a PR preview site holding just the PR head and the base branch's latest Revision, for Compare." },
      base: { type: "string", value: "<branch>", defaultText: "the branch origin/HEAD points at", description: "With `--preview`: the base branch, read from `origin/<branch>` without fetching." },
    },
    examples: [
      { command: "archidocs build --out site", description: "Write the viewer, the latest Bundle and the past Revisions' Bundles into `site/`, ready for any static host." },
      { command: "archidocs build --out site --keep 50", description: "Keep Bundles for the latest 50 past Revisions only, and for every tagged one." },
      { command: "archidocs build --bundle-only --out public", description: "Write only `public/workspace.bundle.json`, for `mcp --bundle` or a script to read." },
      { command: "archidocs build --preview --base main --out preview", description: "Write a PR preview site that opens on Compare, from `origin/main` to the pull request checked out." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "The site, the Bundle or the preview site was written." },
      { code: EXIT.foundErrors, meaning: "The Workspace has errors. They are printed as `check` prints them, and nothing is written." },
      {
        code: EXIT.couldNotRun,
        meaning: `It could not run: ${USAGE_ERROR}, flags that don't go together, a \`--keep\` that is not a count or \`all\`, no Workspace found, or with \`--preview\` a Workspace outside git or a base branch that is not in the checkout.`,
      },
    ],
  },
  dev: {
    name: "dev",
    synopsis: ["dev [--workspace <dir>] [--port <n>] [--host <host>]"],
    description: "Serve the viewer locally and reload it when a `.yaml` or `.md` file in the Workspace changes.",
    arguments: [],
    flags: {
      workspace: { type: "string", value: "<dir>", defaultText: "the Workspace found from the current folder", description: "Where to look for the Workspace." },
      port: { type: "string", value: "<n>", default: "4321", description: "The port to serve on." },
      host: { type: "string", value: "<host>", default: "127.0.0.1", description: "The address to listen on." },
    },
    examples: [
      { command: "archidocs dev", description: "Serve the viewer for the Workspace found from the current folder, and print its address." },
      { command: "archidocs dev --port 4000", description: "Serve on another port, for when the default one is in use." },
      { command: "archidocs dev --workspace ../architecture", description: "Serve the Workspace found from another folder, such as a checkout of the Workspace repo beside a code repo." },
      { command: "archidocs dev --host 0.0.0.0", description: "Listen on every network interface, so that other machines can open the viewer." },
    ],
    exitCodes: [{ code: EXIT.couldNotRun, meaning: `It could not start: ${USAGE_ERROR}, a \`--port\` that is not a port or is in use, or no Workspace found.` }],
    exitNote:
      "Once it is serving, `dev` runs until you stop it with Ctrl+C. A Workspace with errors does not stop it: it prints them and keeps serving. The interrupt ends the process, so the exit status is the shell's for an interrupted command (130 in most shells), not a code of its own.",
  },
  export: {
    name: "export",
    synopsis: [
      "export <view-id> [--format svg|png] [--out <file>] [--direction TB|BT|LR|RL] [--theme light|dark] [--label <text>]",
      "export --all-saved --out <dir> [--format svg|png] [--direction TB|BT|LR|RL] [--theme light|dark] [--label <text>]",
    ],
    description: "Render a View, or every Saved View, to an SVG or PNG picture.",
    arguments: [{ name: "<view-id>", description: "The View: c1, c2, c2/<system>, c3/<service>, deployment/<environment>, or a Saved View as project:view-id." }],
    flags: {
      format: { type: "string", value: "svg|png", default: "svg", description: "The picture format." },
      out: { type: "string", value: "<file>", defaultText: "<view-id>.<format> in the current folder", description: "The file to write; with `--all-saved`, the folder to write each picture into." },
      direction: { type: "string", value: "TB|BT|LR|RL", defaultText: "a Saved View's own direction, else LR", description: "The layout direction: top to bottom, bottom to top, left to right or right to left. Dynamic Views ignore it." },
      "all-saved": { type: "boolean", default: false, description: "Render every Saved View into the `--out` folder, one picture each." },
      theme: { type: "string", value: "light|dark", default: "light", description: "The palette: the viewer's light tokens, or its Night shift dark ones." },
      label: { type: "string", value: "<text>", defaultText: "the Workspace, short commit and date", description: "The line under the title, such as `Big Bank · v1.2.0`, in place of the source line." },
    },
    examples: [
      { command: "archidocs export c2", description: "Write the C2 Generated View, every System and Service, to `c2.svg` in the current folder." },
      {
        command: "archidocs export c2/digital:internet-banking --direction TB --theme dark",
        description: "Write one System's Services, the System named by its Qualified id, laid out top to bottom in the dark palette.",
      },
      { command: "archidocs export payments:make-a-payment --format png --out make-a-payment.png", description: "Write a Saved View, here a Dynamic View, as a PNG." },
      { command: "archidocs export --all-saved --out views", description: "Write every Saved View into `views/`, one picture each, named by its id." },
      { command: 'archidocs export deployment/prod --label "Big Bank · v1.2.0"', description: "Write an Environment's Deployment View with a line of your own under the title, in place of the commit and date." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "Each picture was written, and its path printed." },
      { code: EXIT.foundErrors, meaning: "The Workspace has errors. They are printed as `check` prints them, and nothing is exported." },
      {
        code: EXIT.couldNotRun,
        meaning: `It could not run: ${USAGE_ERROR}, an unknown format, direction or theme, an unknown View, a View together with \`--all-saved\` or neither of them, \`--all-saved\` without \`--out\`, or no Workspace found.`,
      },
    ],
  },
  diff: {
    name: "diff",
    synopsis: ["diff <from> [<to>] [--format text|json|markdown]"],
    description: "Show what changed in the Model between two points in the Workspace's history.",
    arguments: [
      { name: "<from>", description: "A git ref, or a date or time, which names the last Revision at or before it." },
      { name: "[<to>]", description: "A ref, date or time like `<from>`; with none, the working tree." },
    ],
    flags: {
      format: { type: "string", value: "text|json|markdown", default: "text", description: "Print the changes as text, JSON, or Markdown for a PR comment." },
    },
    examples: [
      { command: "archidocs diff HEAD", description: "Show what your uncommitted edits change, against the last commit." },
      { command: "archidocs diff origin/main HEAD", description: "Show what a branch changes against the default branch, as a reviewer of its pull request will see it." },
      { command: "archidocs diff 2026-01-01 2026-06-30", description: "Show the Changes between two dates; each date names the last Revision at or before it." },
      { command: "archidocs diff origin/main HEAD --format markdown", description: "Write the Changes as Markdown, to post as a pull request comment." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "The Changes were printed. It exits 0 whether or not anything changed, so a script that asks whether the Model changed must read the output, not the exit code." },
      { code: EXIT.couldNotRun, meaning: `It could not run: ${USAGE_ERROR}, an unknown format, no point or more than two, an unknown ref or date, a date before the first Revision, a sha prefix of several Revisions, no Workspace found, or a Workspace outside git.` },
    ],
  },
  "history build": {
    name: "history build",
    synopsis: ["history build [--since <ref|date|time>]"],
    description: "Build and cache the Bundle of every past Revision, so later builds and diffs don't have to. Safe to re-run.",
    arguments: [],
    flags: {
      since: { type: "string", value: "<ref|date|time>", defaultText: "every Revision", description: "Only build Revisions at or after this ref's commit time, the start of this date, or this time (UTC unless it gives a zone)." },
    },
    examples: [
      { command: "archidocs history build", description: "Build and cache the Bundle of every past Revision, so the next `build` or `diff` reads them from the cache." },
      { command: "archidocs history build --since 2026-01-01", description: "Only build the Revisions from the start of that date on." },
      { command: "archidocs history build --since v1.0.0", description: "Only build the Revisions at or after a tag's commit." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "Every Revision asked for is in the cache. It prints how many it built and how many were already built." },
      { code: EXIT.couldNotRun, meaning: `It could not run: ${USAGE_ERROR}, an unknown \`--since\` ref or date, no Workspace found, or a Workspace outside git.` },
    ],
  },
  mcp: {
    name: "mcp",
    synopsis: ["mcp [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>] [--check]", "mcp --http [--host <loopback>] [--port <n>] [--allow-writes] [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>]"],
    description: "Serve the Model to AI agents over MCP, from a Workspace checkout or a published Bundle, on stdio or local HTTP.",
    arguments: [],
    flags: {
      workspace: { type: "string", value: "<dir>", defaultText: "the Workspace found from the current folder", description: "Serve this Workspace checkout; its write tools edit the YAML in place." },
      bundle: { type: "string", value: "<url|path>", description: "Serve a published Bundle, read-only, instead of a checkout." },
      "viewer-url": { type: "string", value: "<url>", description: "The published viewer's base URL; tool results then link to it." },
      http: { type: "boolean", default: false, description: "Serve Streamable HTTP at `/mcp` instead of stdio." },
      host: { type: "string", value: "<loopback>", defaultText: "127.0.0.1", description: "With `--http`: the loopback address to listen on, `127.0.0.1`, `localhost` or `::1`." },
      port: { type: "string", value: "<n>", defaultText: "3737", description: "With `--http`: the port to serve on." },
      "allow-writes": { type: "boolean", default: false, description: "With `--http`: allow the write tools, which are off over HTTP by default." },
      check: { type: "boolean", default: false, description: "Check the server instead of serving: run it behind an in-process client, print what it serves, and exit 0, or 2 with the reason." },
    },
    examples: [
      {
        command: "archidocs mcp --workspace archidocs",
        description: "Serve a Workspace checkout over stdio, with the read and write tools. This is the command to register with a coding agent, which starts it from the repo root.",
      },
      { command: "archidocs mcp --workspace archidocs --check", description: "Check the server that command starts: print what it serves and how many tools it has, then exit." },
      { command: "archidocs mcp --bundle https://big-bank.archidocs.dev/workspace.bundle.json", description: "Serve a published Bundle, here the Big Bank demo's, with the read tools only." },
      {
        command: "archidocs mcp --bundle https://architecture.example.com/workspace.bundle.json --viewer-url https://architecture.example.com/",
        description: "Serve your own published Bundle, with links to its viewer in the tool results.",
      },
      { command: "archidocs mcp --http --port 3737 --workspace archidocs", description: "Serve Streamable HTTP at `/mcp` on a loopback address, with the write tools off." },
      { command: "archidocs mcp --http --allow-writes --workspace archidocs", description: "Serve over HTTP with the write tools on." },
    ],
    exitCodes: [
      { code: EXIT.ok, meaning: "Over stdio, the client closed the connection. With `--check`, the server started and answered." },
      {
        code: EXIT.couldNotRun,
        meaning: `It could not start: ${USAGE_ERROR}, flags that don't go together, a \`--viewer-url\` that is not a URL, a \`--port\` that is not a port or is in use, a \`--host\` that is not a loopback address, no Workspace found when \`--bundle\` is not given, or, with \`--check\`, a server that could not read its source.`,
      },
    ],
    exitNote:
      "With `--http`, `mcp` runs until you stop it with Ctrl+C. The interrupt ends the process, so the exit status is the shell's for an interrupted command (130 in most shells), not a code of its own. A Bundle that can't be read does not stop the server: each tool call answers `source_unavailable`, and the next call tries again.",
  },
} as const satisfies Record<string, CommandDefinition>;

export type CommandName = keyof typeof commands;

/** Every command, in the order the usage lists them. */
export const commandList: readonly CommandDefinition[] = Object.values(commands);

/** The usage text the CLI prints after a usage error. */
export function usageText(): string {
  const lines = commandList.flatMap((c) => c.synopsis.map((s) => `  archidocs ${s}`));
  return `Usage:\n${lines.join("\n")}\n`;
}

/**
 * Parses a command's arguments (the words after its name) with its flags,
 * strictly: an unknown flag or a missing value throws `ERR_PARSE_ARGS_*`.
 */
export function parseCommand<N extends CommandName>(name: N, args: string[]): ParsedCommand<N> {
  const command: CommandDefinition = commands[name];
  return parseArgs({ args, options: command.flags, allowPositionals: command.arguments.length > 0, strict: true }) as ParsedCommand<N>;
}

/** `parseArgs`'s typed result for a command: its flags' values and its positionals. */
type ParsedCommand<N extends CommandName> = ReturnType<typeof parseArgs<{ args: string[]; options: (typeof commands)[N]["flags"]; allowPositionals: true; strict: true }>>;

/** The command a command line names, and the arguments after its name. */
export function findCommand(argv: readonly string[]): { command: CommandDefinition; args: string[] } | undefined {
  // The longest name wins, so `history build` is found before any `history`.
  const byLength = [...commandList].sort((a, b) => b.name.split(" ").length - a.name.split(" ").length);
  for (const command of byLength) {
    const words = command.name.split(" ");
    if (words.every((w, i) => argv[i] === w)) return { command, args: argv.slice(words.length) };
  }
  return undefined;
}

export type ParsedCommandLine = { ok: true; command: string } | { ok: false; message: string };

/**
 * Checks a command line (the words after `archidocs`) against the
 * definitions without running anything: an unknown command, an unknown
 * flag, a flag missing its value or a stray argument is reported. What
 * a value means, and which flags go together, are left to the command.
 */
export function parseCommandLine(argv: readonly string[]): ParsedCommandLine {
  const found = findCommand(argv);
  if (!found) {
    const [first, second] = argv;
    if (first === undefined) return { ok: false, message: "No command given." };
    const sub = commandList.find((c) => c.name.startsWith(`${first} `));
    if (sub) return { ok: false, message: second === undefined ? `Give a ${first} command.` : `Unknown ${first} command "${second}".` };
    return { ok: false, message: `Unknown command "${first}".` };
  }
  try {
    parseArgs({ args: found.args, options: found.command.flags, allowPositionals: found.command.arguments.length > 0, strict: true });
    return { ok: true, command: found.command.name };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
