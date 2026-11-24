/**
 * Finds every `archidocs …` command line in a page and checks it against
 * the CLI's structured definitions with `parseCommandLine`, without running
 * anything. An unknown command or flag, or a flag missing its value, is a
 * problem. Shell code blocks are read line by line; inline code counts when
 * it is a whole command line.
 */
import { parseCommandLine } from "../../../src/cli/commands.ts";

/** Code block languages whose lines are shell commands. */
export const SHELL_LANGUAGES: ReadonlySet<string> = new Set(["sh", "bash", "shell", "zsh", "console", "shellsession"]);

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

/** The words after `archidocs`, if `command` runs it. */
export function archidocsArgs(command: string): string[] | undefined {
  const match = COMMAND.exec(command.trim());
  return match ? shellWords(match[1]!) : undefined;
}

/** Checks one command; returns a problem if it runs `archidocs` with a line the CLI would refuse. */
export function checkCommand(command: string): CommandLineProblem | undefined {
  const args = archidocsArgs(command);
  if (!args) return undefined;
  const parsed = parseCommandLine(args);
  return parsed.ok ? undefined : { line: command.trim(), message: parsed.message };
}

/** Checks a code block's lines (when its language is a shell) or an inline code span. */
export function checkCode(code: string, { lang, inline }: { lang?: string | null; inline?: boolean }): CommandLineProblem[] {
  if (inline) return [checkCommand(code)].filter((p) => p !== undefined);
  if (!lang || !SHELL_LANGUAGES.has(lang)) return [];
  return commandsInBlock(code)
    .map(checkCommand)
    .filter((p) => p !== undefined);
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
