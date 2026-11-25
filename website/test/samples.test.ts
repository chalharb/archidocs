import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { repoPath } from "../src/lib/repo.ts";
import { extractRegion, fillSamples, sampleFences, sampleTitle } from "../src/lib/samples.ts";

const run = promisify(execFile);

/** Every file under `dir` (absolute) whose name ends with one of `exts`. */
const filesUnder = (dir: string, exts: string[]): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => exts.some((ext) => f.endsWith(ext)))
    .map((f) => join(dir, f))
    .sort();

/** The hand-written Markdown: every page under src/content/docs/ and every intro under src/intros/. */
const handWritten = [...filesUnder(repoPath("website/src/content/docs"), [".md", ".mdx"]), ...filesUnder(repoPath("website/src/intros"), [".md"])].map((path) => ({
  path: relative(repoPath(""), path),
  text: readFileSync(path, "utf8"),
}));

/** The folder holding the Workspace a sample file belongs to: the one above its `archidocs/` folder. */
function sampleWorkspace(file: string): string {
  for (let dir = dirname(repoPath(file)); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "archidocs/workspace.yaml"))) return dir;
  }
  throw new Error(`${file} is in no sample Workspace (a folder holding archidocs/workspace.yaml).`);
}

/** The rule ids `archidocs check` reports for the Workspace in `dir`. */
async function checkRules(dir: string): Promise<string[]> {
  const cli = repoPath("src/cli/main.ts");
  const result = await run(process.execPath, [cli, "check", "--format", "json"], { cwd: dir }).catch((error: { stdout: string; code: number }) => {
    if (error.code !== 1) throw error;
    return { stdout: error.stdout };
  });
  return (JSON.parse(result.stdout) as { issues: { rule: string }[] }).issues.map((i) => i.rule);
}

const failing = handWritten.flatMap((page) => sampleFences(page.text).flatMap((fence) => (fence.fails ? [{ page, fence }] : [])));

describe("samples that are wrong on purpose", () => {
  it("has some, each in website/samples/", () => {
    expect(failing.length).toBeGreaterThan(0);
    for (const { fence } of failing) expect(fence.file).toMatch(/^website\/samples\//);
  });

  it.each(failing.map(({ page, fence }) => [fence.file, fence.fails!, page] as const))("%s fails check with exactly %s, and its page links that rule", async (file, rule, page) => {
    expect([...new Set(await checkRules(sampleWorkspace(file)))]).toEqual([rule]);
    expect(page.text, `${page.path} names the rule`).toContain(`(/docs/reference/rules/${rule}/)`);
  });

  it("are all shown on a page", () => {
    const shown = new Set(failing.map(({ fence }) => relative(repoPath(""), sampleWorkspace(fence.file))));
    const samples = readdirSync(repoPath("website/samples"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `website/samples/${d.name}`);
    expect(samples.filter((s) => !shown.has(s))).toEqual([]);
  });
});

/** The top-level keys of the Model YAML files: Workspace, Project and the rest of a Project's files. */
const MODEL_KEYS = new Set(["teams", "environments", "people", "systems", "services", "components", "targets", "deployments", "views"]);

describe("YAML samples on hand-written pages", () => {
  it("are never typed inline: every Model YAML sample comes from a file", () => {
    const typed: string[] = [];
    for (const page of handWritten) {
      for (const m of page.text.matchAll(/^[ \t]*(`{3,}|~{3,})(ya?ml)\b([^\n]*)\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm)) {
        if (/\bfile=/.test(m[3]!)) continue;
        let data: unknown;
        try {
          data = parse(m[4]!);
        } catch {
          continue;
        }
        if (data === null || typeof data !== "object" || Array.isArray(data)) continue;
        const keys = Object.keys(data);
        const project = keys.includes("id") && keys.includes("owner");
        if (project || keys.some((k) => MODEL_KEYS.has(k))) typed.push(`${page.path}: ${m[4]!.split("\n")[0]}`);
      }
    }
    expect(typed).toEqual([]);
  });

  it("name files and regions that exist", () => {
    // The build fails on these too; this names every one at once.
    for (const page of handWritten) for (const fence of sampleFences(page.text)) expect(fillSamples(`\`\`\`${fence.lang} file="${fence.file}"${fence.region ? ` region="${fence.region}"` : ""}${fence.fails ? ` fails="${fence.fails}"` : ""}\n\`\`\``), `${page.path}: ${fence.file}`).not.toContain("file=");
  });
});

describe("sample regions", () => {
  const text = ["a: 1", "#region outer", "b:", "  # #region inner", "  c: 2", "  # #endregion", "#endregion", "d: 3", ""].join("\n");

  it("takes the lines of a named region, moved to the left margin, without any region markers", () => {
    expect(extractRegion(text, "outer")).toBe("b:\n  c: 2");
    expect(extractRegion(text, "inner")).toBe("c: 2");
    expect(extractRegion(text)).toBe("a: 1\nb:\n  c: 2\nd: 3");
    expect(extractRegion(text, "missing")).toBeUndefined();
  });

  it("reads a Markdown region", () => {
    expect(extractRegion("x\n<!-- #region frontmatter -->\n---\nstatus: accepted\n---\n<!-- #endregion -->\ny", "frontmatter")).toBe("---\nstatus: accepted\n---");
  });

  it("titles a sample with its path in the Workspace", () => {
    expect(sampleTitle("examples/big-bank/archidocs/payments/model.yaml")).toBe("payments/model.yaml");
    expect(sampleTitle("examples/big-bank/archidocs/workspace.yaml")).toBe("workspace.yaml");
  });

  it("titles a sample that is wrong on purpose with the rule it fails", () => {
    expect(fillSamples('```yaml file="website/samples/unknown-environment/archidocs/shop/project.yaml" fails="unknown-environment"\n```')).toContain('title="shop/project.yaml · fails check: unknown-environment"');
  });

  it("fills a page's sample fences for its Markdown copy", () => {
    expect(fillSamples('Intro\n\n```yaml file="examples/kitchen-sink/archidocs/sink/project.yaml"\n```\n')).toBe('Intro\n\n```yaml title="sink/project.yaml"\nid: sink\nname: Kitchen Sink\nowner: core\n```\n');
  });
});
