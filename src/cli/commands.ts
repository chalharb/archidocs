/**
 * The CLI's commands and flags, described once. The CLI parses each
 * command's arguments with these flags and prints its usage text from them;
 * the docs site generates its CLI reference from them and checks every
 * `archidocs …` line in a page with `parseCommandLine`. Importing this
 * module has no side effects and pulls in nothing but `node:util`.
 */
import { parseArgs } from "node:util";

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

export interface CommandDefinition {
  /** The words after `archidocs`: `check`, or `history build` for a subcommand. */
  readonly name: string;
  /** Each way to call it, after `archidocs `. */
  readonly synopsis: readonly string[];
  /** One line on what it does. */
  readonly description: string;
  readonly arguments: readonly ArgumentDefinition[];
  readonly flags: Readonly<Record<string, FlagDefinition>>;
}

export const commands = {
  version: {
    name: "version",
    synopsis: ["version [--format text|json]"],
    description: "Print the CLI's version and the Bundle schemaVersion it writes.",
    arguments: [],
    flags: {
      format: { type: "string", value: "text|json", default: "text", description: "Print a line of text, or a JSON object with `version` and `schemaVersion`." },
    },
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
  },
  guide: {
    name: "guide",
    synopsis: ["guide [topic]"],
    description: "Print the authoring guide for agents, or one of its task topics.",
    arguments: [{ name: "[topic]", description: "A task topic; with none, the guide and the list of topics." }],
    flags: {},
  },
  check: {
    name: "check",
    synopsis: ["check [--format text|json|github] [--strict]"],
    description: "Validate the Workspace found from the current folder. Exits 1 on errors, 2 if it could not run.",
    arguments: [],
    flags: {
      format: { type: "string", value: "text|json|github", default: "text", description: "Print issues as text, as JSON, or as GitHub Actions annotations." },
      strict: { type: "boolean", default: false, description: "Exit 1 on warnings too, not only on errors." },
    },
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
  },
  dev: {
    name: "dev",
    synopsis: ["dev [--workspace <dir>] [--port <n>] [--host <host>]"],
    description: "Serve the viewer locally and reload it as you edit the Workspace.",
    arguments: [],
    flags: {
      workspace: { type: "string", value: "<dir>", defaultText: "the Workspace found from the current folder", description: "Where to look for the Workspace." },
      port: { type: "string", value: "<n>", default: "4321", description: "The port to serve on." },
      host: { type: "string", value: "<host>", default: "127.0.0.1", description: "The address to listen on." },
    },
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
  },
  diff: {
    name: "diff",
    synopsis: ["diff <from> [<to>] [--format text|json|markdown]"],
    description: "Show what changed in the Model between two points in the Workspace's history.",
    arguments: [
      { name: "<from>", description: "A git ref, or a date, which means the last default-branch commit at or before it." },
      { name: "[<to>]", description: "A ref or date like `<from>`; with none, the working tree." },
    ],
    flags: {
      format: { type: "string", value: "text|json|markdown", default: "text", description: "Print the changes as text, JSON, or Markdown for a PR comment." },
    },
  },
  "history build": {
    name: "history build",
    synopsis: ["history build [--since <ref|date>]"],
    description: "Build and cache the Bundle of every past Revision, so later builds and diffs don't have to. Safe to re-run.",
    arguments: [],
    flags: {
      since: { type: "string", value: "<ref|date>", defaultText: "every Revision", description: "Only build Revisions at or after this ref's commit time or the start of this date." },
    },
  },
  mcp: {
    name: "mcp",
    synopsis: ["mcp [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>]", "mcp --http [--host <loopback>] [--port <n>] [--allow-writes] [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>]"],
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
    },
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
