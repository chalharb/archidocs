/**
 * YAML samples on hand-written pages are included from files, never typed:
 * a code fence with no body names a file in `examples/` (checked and built
 * on every PR) or in `website/samples/` (wrong on purpose, and tested to
 * fail with the rule the page names), and optionally a named region of it.
 *
 *   ```yaml file="examples/big-bank/archidocs/payments/model.yaml" region="fraud"
 *   ```
 *
 *   ```yaml file="website/samples/via-on-sync/archidocs/shop/model.yaml" fails="via-on-sync"
 *   ```
 *
 * A region is the lines between `#region <name>` and `#endregion` comments
 * (`<!-- #region <name> -->` in Markdown), moved left as far as they go.
 * Region markers are never shown.
 */
import { existsSync, readFileSync } from "node:fs";
import { repoPath } from "./repo.ts";

/** Folders a sample may come from, relative to the repo root. */
export const SAMPLE_ROOTS = ["examples/", "website/samples/"] as const;

/** The attributes of a sample fence's meta string. */
export interface SampleRef {
  /** The file, relative to the repo root. */
  file: string;
  region?: string;
  /** The one rule a wrong-on-purpose sample fails with. */
  fails?: string;
  /** A title the page gives the sample instead of its path in the Workspace. */
  title?: string;
}

const ATTRIBUTE = /([a-z]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

/** Every `key=value` in a fence's meta string, quoted or not. */
export function parseMeta(meta: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const m of meta.matchAll(ATTRIBUTE)) attributes.set(m[1]!, m[2] ?? m[3] ?? m[4]!);
  return attributes;
}

/** The sample a fence's meta names, if it names one with `file=`. */
export function sampleRef(meta: string | null | undefined): SampleRef | undefined {
  const attributes = parseMeta(meta ?? "");
  const file = attributes.get("file");
  if (file === undefined) return undefined;
  const region = attributes.get("region");
  const fails = attributes.get("fails");
  const title = attributes.get("title");
  return { file, ...(region ? { region } : {}), ...(fails ? { fails } : {}), ...(title ? { title } : {}) };
}

/** A region marker line: `# #region name`, `#region name`, `#endregion`, `<!-- #region name -->`. */
const MARKER = /^\s*(?:#|<!--)\s*#?(end)?region\b\s*([\w-]*)\s*(?:-->)?\s*$/;

/** The lines of `text` in region `name`, or all of it, without any region markers. */
export function extractRegion(text: string, name?: string): string | undefined {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const out: string[] = [];
  let depth = 0;
  let found = name === undefined;
  let inside = name === undefined;
  for (const line of lines) {
    const marker = MARKER.exec(line);
    if (marker) {
      const [, end, label] = marker;
      if (!end && !inside && label === name) {
        found = true;
        inside = true;
        depth = 0;
      } else if (inside && name !== undefined) {
        if (end && depth === 0) inside = false;
        else depth += end ? -1 : 1;
      }
      continue;
    }
    if (inside) out.push(line);
  }
  return found ? dedent(out).join("\n") : undefined;
}

/** Lines with their common leading whitespace removed, so a nested region reads from the left margin. */
function dedent(lines: string[]): string[] {
  const indents = lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length);
  const common = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(common));
}

/** The title a sample shows: its path inside the Workspace folder, such as `payments/model.yaml`. */
export function sampleTitle(file: string): string {
  const at = file.lastIndexOf("archidocs/");
  return at >= 0 ? file.slice(at + "archidocs/".length) : file.slice(file.lastIndexOf("/") + 1);
}

/** Reads a sample, or throws with what is wrong with its reference. */
export function readSample(ref: SampleRef): { text: string; title: string } {
  const where = `the sample file="${ref.file}"${ref.region ? ` region="${ref.region}"` : ""}`;
  if (!SAMPLE_ROOTS.some((root) => ref.file.startsWith(root)) || ref.file.includes("..")) {
    throw new Error(`${where}: samples come from ${SAMPLE_ROOTS.join(" or ")}.`);
  }
  if (ref.file.startsWith("website/samples/") && !ref.fails) {
    throw new Error(`${where}: a sample in website/samples/ is wrong on purpose, so name the rule it fails with fails="<rule-id>".`);
  }
  if (ref.fails && !ref.file.startsWith("website/samples/")) {
    throw new Error(`${where}: only samples in website/samples/ fail on purpose; move it there.`);
  }
  const path = repoPath(ref.file);
  if (!existsSync(path)) throw new Error(`${where}: no such file.`);
  const text = extractRegion(readFileSync(path, "utf8"), ref.region);
  if (text === undefined) throw new Error(`${where}: the file has no #region ${ref.region}.`);
  const title = ref.title ?? sampleTitle(ref.file);
  // A sample that is wrong on purpose says so, so nobody copies it.
  return { text, title: ref.fails ? `${title} · fails check: ${ref.fails}` : title };
}

/** A fence in a Markdown document that includes a sample. */
export interface SampleFence extends SampleRef {
  lang: string;
}

/** Every sample fence in a Markdown document, in order. */
export function sampleFences(markdown: string): SampleFence[] {
  const fences: SampleFence[] = [];
  for (const m of markdown.matchAll(/^\s*(`{3,}|~{3,})(\S*)[ \t]+([^\n]*)$/gm)) {
    const ref = sampleRef(m[3]);
    if (ref) fences.push({ lang: m[2]!, ...ref });
  }
  return fences;
}

/**
 * A page's Markdown with each sample fence filled from its file and titled,
 * as the `.md` copy of the page shows it. Fences whose sample can't be read
 * are left as they are; the site build has already failed on them.
 */
export function fillSamples(markdown: string): string {
  return markdown.replace(/^([ \t]*)(`{3,}|~{3,})(\S*)[ \t]+([^\n]*)\n[ \t]*\2[ \t]*$/gm, (whole, indent: string, fence: string, lang: string, meta: string) => {
    const ref = sampleRef(meta);
    if (!ref) return whole;
    try {
      const { text, title } = readSample(ref);
      const body = text
        .split("\n")
        .map((line) => (line ? indent + line : line))
        .join("\n");
      return `${indent}${fence}${lang} title="${title}"\n${body}\n${indent}${fence}`;
    } catch {
      return whole;
    }
  });
}
