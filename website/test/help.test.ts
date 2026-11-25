/**
 * The Troubleshooting page quotes the CLI's errors. Each quote must still be
 * an error the CLI prints, so rewording a message in `src/` fails here until
 * the page is updated. It reads the files; it never builds the site.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/lib/repo.ts";

const PAGE = "website/src/content/docs/docs/help/troubleshooting.mdx";
/** The CLI's own prefix on every error it prints (`src/cli/main.ts`). */
const PREFIX = "archidocs: ";

const page = readFileSync(repoPath(PAGE), "utf8");

/** Each line of a code block that starts with the CLI's error prefix, without the prefix. */
function quotedErrors(text: string): string[] {
  return [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```$/gm)].flatMap((m) =>
    m[1]!
      .split("\n")
      .filter((line) => line.startsWith(PREFIX))
      .map((line) => line.slice(PREFIX.length)),
  );
}

/** A message the source can print: the pattern it matches in full, and how much of it is fixed text. */
interface Message {
  pattern: RegExp;
  fixed: number;
}

/**
 * Every string and template literal in the TypeScript source, as a message a
 * printed line must match in full: each `${…}` in a template stands for any text.
 */
function messages(source: string): Message[] {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const unescape = (s: string) => s.replace(/\\(.)/g, "$1");
  const literal = (parts: string[]): Message => ({
    pattern: new RegExp(`^${parts.map((part) => escape(unescape(part))).join(".+")}$`),
    fixed: parts.reduce((n, part) => n + unescape(part).length, 0),
  });
  const strings = [...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => literal([m[1]!]));
  const templates = [...source.matchAll(/`((?:[^`\\]|\\.)*)`/g)].map((m) => literal(m[1]!.split(/\$\{[^}]*\}/)));
  return [...strings, ...templates];
}

/**
 * Whether the source prints `quote`. Most of the quote must be the message's
 * fixed text, so a template that is all placeholders, such as `${a}: ${b}`, matches nothing.
 */
const prints = (all: Message[], quote: string): boolean => all.some((m) => m.fixed * 2 >= quote.length && m.pattern.test(quote));

const sourceFiles = readdirSync(repoPath("src"), { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".ts"))
  .map((f) => readFileSync(join(repoPath("src"), f), "utf8"));
const printed = sourceFiles.flatMap(messages);

describe("the Troubleshooting page", () => {
  const quotes = quotedErrors(page);

  it("quotes the CLI's errors", () => {
    expect(quotes.length).toBeGreaterThan(0);
  });

  it.each(quotes)("quotes an error the CLI prints: %s", (quote) => {
    expect(prints(printed, quote), `not found in src/: ${quote}`).toBe(true);
  });

  it("links a guide or reference page from every entry", () => {
    const entries = page.split(/^## /m).slice(1);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      // A Glossary link explains a term; it doesn't cover a fix.
      expect(entry, entry.split("\n")[0]).toMatch(/\]\(\/docs\/(?:guides\/|reference\/(?!glossary\/)|start\/)/);
    }
  });
});

describe("matching a quote to the source", () => {
  it("matches a template's text around its placeholders, in full", () => {
    const source = messages("throw new UsageError(`Port ${port} is in use; pick another with --port.`);");
    expect(prints(source, "Port 4321 is in use; pick another with --port.")).toBe(true);
    expect(prints(source, "Port 4321 is busy; pick another with --port.")).toBe(false);
    expect(prints(source, "Port 4321 is in use.")).toBe(false);
  });

  it("never matches a template that is mostly placeholders", () => {
    expect(prints(messages("const line = `${name}: ${message}`;"), "Port 4321 is in use; pick another with --port.")).toBe(false);
  });

  it("reads escapes in a string literal as the characters they print", () => {
    expect(prints(messages('const m = "Say \\"hi\\".";'), 'Say "hi".')).toBe(true);
  });

  it("finds only error lines in code blocks", () => {
    const text = ["```text", "archidocs: Oops.", "Usage:", "```", "", "archidocs: not in a block", "```bash", "archidocs dev", "archidocs: Also.", "```"].join("\n");
    expect(quotedErrors(text)).toEqual(["Oops.", "Also."]);
  });
});
