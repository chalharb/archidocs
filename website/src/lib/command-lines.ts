/**
 * Finds every `archidocs …` command line in a page and checks it against
 * the CLI's structured definitions with `parseCommandLine`, without running
 * anything. An unknown command or flag, or a flag missing its value, is a
 * problem. Shell code blocks are read line by line; inline code counts when
 * it is a whole command line. A command after ` -- `, as in
 * `claude mcp add archidocs -- archidocs mcp`, counts too. In a JSON or TOML
 * block, each MCP server entry's `command` and `args` are read as one line.
 */
import { parseCommandLine } from "../../../src/cli/commands.ts";

/** Code block languages whose lines are shell commands. */
export const SHELL_LANGUAGES: ReadonlySet<string> = new Set(["sh", "bash", "shell", "zsh", "console", "shellsession"]);

/** Code block languages whose MCP server entries (`command` plus `args`) are read. */
export const CONFIG_LANGUAGES: ReadonlySet<string> = new Set(["json", "toml"]);

export interface CommandLineProblem {
  /** The command line as written. */
  line: string;
  message: string;
}

/**
 * `archidocs` and what follows it, at the start of a command: after an
 * optional `$ ` prompt and an `npx`, `pnpm exec`/`dlx` or `yarn` runner, and
 * with an optional `@version`.
 */
const COMMAND = /^(?:\$\s+)?(?:(?:npx|bunx|yarn|pnpm\s+(?:exec|dlx))\s+(?:(?:-y|--yes)\s+)?)?archidocs(?:@\S+)?\s+(\S.*)$/;

/** The shell commands in a code block: continuation lines joined, then split at `&&`, `||`, `;` and ` | `. */
export function commandsInBlock(code: string): string[] {
  const joined = code.replace(/\\\n\s*/g, " ");
  return joined.split("\n").flatMap((line) => splitCommands(line.trim()));
}

/** A shell line split into its commands, ignoring separators inside quotes. */
function splitCommands(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quote) {
      if (c === quote) quote = undefined;
      current += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      current += c;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]!))) {
      break;
    } else if (line.startsWith("&&", i) || line.startsWith("||", i)) {
      out.push(current);
      current = "";
      i++;
    } else if (c === ";" || (c === "|" && /\s/.test(line[i - 1] ?? " ") && /\s/.test(line[i + 1] ?? " "))) {
      out.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The words of a command, as a shell splits them; a redirect ends it. Synopsis brackets are dropped. */
export function shellWords(command: string): string[] {
  const words: string[] = [];
  let word: string | undefined;
  let quote: string | undefined;
  for (const c of command) {
    if (quote) {
      if (c === quote) quote = undefined;
      else word = (word ?? "") + c;
    } else if (c === "'" || c === '"') {
      quote = c;
      word ??= "";
    } else if (/\s/.test(c)) {
      if (word !== undefined) words.push(word);
      word = undefined;
    } else if (c === ">" && word === undefined) {
      break;
    } else {
      word = (word ?? "") + c;
    }
  }
  if (word !== undefined) words.push(word);
  return words.map((w) => w.replace(/^\[+/, "").replace(/\]+$/, "")).filter(Boolean);
}

/** A command another tool runs, after its ` -- `: `claude mcp add archidocs -- archidocs mcp`. */
const AFTER_SEPARATOR = /\s--\s+(\S.*)$/;

/** The words after `archidocs`, if `command` runs it, itself or after a ` -- `. */
export function archidocsArgs(command: string): string[] | undefined {
  const match = COMMAND.exec(command.trim()) ?? COMMAND.exec(AFTER_SEPARATOR.exec(command)?.[1] ?? "");
  return match ? shellWords(match[1]!) : undefined;
}

/**
 * The command each MCP server entry in a JSON or TOML config starts, as the
 * words a process gets: `"command": "npx", "args": ["-y", "archidocs", "mcp"]`
 * is `["npx", "-y", "archidocs", "mcp"]`. In JSON an entry is any object with
 * a `command` string; in TOML it is a table with a `command` key.
 */
export function commandsInConfig(code: string, lang: string): string[][] {
  return (lang === "toml" ? tomlEntries(code) : jsonEntries(code)).map(({ command, args }) => [command, ...args]);
}

/** A runner in front of `archidocs` in a command's words: `npx -y`, `pnpm exec` and the like. */
const RUNNER = new Set(["npx", "bunx", "yarn", "pnpm", "exec", "dlx", "-y", "--yes"]);

/** Checks a command given as words, as a config starts it, rather than as a shell line. */
export function checkWords(words: string[]): CommandLineProblem | undefined {
  const start = words.findIndex((w) => !RUNNER.has(w));
  if (!/^archidocs(?:@\S+)?$/.test(words[start] ?? "")) return undefined;
  const parsed = parseCommandLine(words.slice(start + 1));
  return parsed.ok ? undefined : { line: words.join(" "), message: parsed.message };
}

interface ServerEntry {
  command: string;
  args: string[];
}

/** The objects in a JSON document that have a `command` string; a block that isn't JSON has none. */
function jsonEntries(code: string): ServerEntry[] {
  let doc: unknown;
  try {
    doc = JSON.parse(code);
  } catch {
    return [];
  }
  const out: ServerEntry[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value !== "object" || value === null) return;
    const { command, args } = value as Record<string, unknown>;
    if (typeof command === "string") out.push({ command, args: Array.isArray(args) ? args.map(String) : [] });
    Object.values(value).forEach(walk);
  };
  walk(doc);
  return out;
}

/** The tables of a TOML document that have a `command` key, with their `args` array of strings. */
function tomlEntries(code: string): ServerEntry[] {
  const strings = (text: string) => [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]!}"`) as string);
  return code.split(/^\s*\[/m).flatMap((table) => {
    const command = /^\s*command\s*=\s*("(?:[^"\\]|\\.)*")/m.exec(table)?.[1];
    if (command === undefined) return [];
    const args = /^\s*args\s*=\s*\[((?:"(?:[^"\\]|\\.)*"|[^\]"])*)\]/m.exec(table)?.[1] ?? "";
    return [{ command: JSON.parse(command) as string, args: strings(args) }];
  });
}

/** Checks one command; returns a problem if it runs `archidocs` with a line the CLI would refuse. */
export function checkCommand(command: string): CommandLineProblem | undefined {
  const args = archidocsArgs(command);
  if (!args) return undefined;
  const parsed = parseCommandLine(args);
  return parsed.ok ? undefined : { line: command.trim(), message: parsed.message };
}

/** Checks a code block's lines (a shell), its MCP server entries (JSON or TOML), or an inline code span. */
export function checkCode(code: string, { lang, inline }: { lang?: string | null; inline?: boolean }): CommandLineProblem[] {
  if (inline) return [checkCommand(code)].filter((p) => p !== undefined);
  const problems = lang && SHELL_LANGUAGES.has(lang) ? commandsInBlock(code).map(checkCommand) : lang && CONFIG_LANGUAGES.has(lang) ? commandsInConfig(code, lang).map(checkWords) : [];
  return problems.filter((p) => p !== undefined);
}

/** Every problem in a Markdown document's shell code blocks and inline code spans. */
export function checkMarkdown(markdown: string): CommandLineProblem[] {
  const problems: CommandLineProblem[] = [];
  const fence = /^(\s*)(`{3,}|~{3,})([^\n`]*)\n([\s\S]*?)^\1\2\s*$/gm;
  let rest = markdown;
  for (const m of markdown.matchAll(fence)) {
    problems.push(...checkCode(m[4]!, { lang: m[3]!.trim().split(/\s+/)[0] }));
    rest = rest.replace(m[0], "");
  }
  for (const m of rest.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)) problems.push(...checkCode(m[1]!, { inline: true }));
  return problems;
}
