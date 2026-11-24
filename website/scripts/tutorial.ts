/**
 * Runs the tutorial "Model your first system" end to end, as a reader would:
 * every shell block on the page in order, with every file the page shows
 * written where it says, in a temp folder. The `archidocs` it runs is this
 * repo's CLI, so the viewer must be built first (`pnpm build:viewer`).
 *
 *   node website/scripts/tutorial.ts [--keep]
 *
 * It fails when a command fails, when the files the page shows don't add up
 * to the finished Workspace in `examples/tutorial/`, or when the built site
 * is missing the Model. With `--keep` it leaves the temp folder in place.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { repoPath } from "../src/lib/repo.ts";
import { extractRegion, readSample, sampleRef } from "../src/lib/samples.ts";

const PAGE = "website/src/content/docs/docs/start/tutorial.mdx";
const EXAMPLE = "examples/tutorial/";

/** Lines a reader runs but the test can't: installing from npm, the dev server, pushing to GitHub. Each must still be on the page. */
const SKIPPED: readonly RegExp[] = [/^npm install --global archidocs$/, /^archidocs dev$/, /^git push\b/];

const SHELL = new Set(["sh", "bash", "shell"]);
const EOF = "ARCHIDOCS_TUTORIAL_EOF";

export interface TutorialScript {
  script: string;
  /** Files the page shows, by their path in the repo the reader builds. */
  files: string[];
}

/** The page as one shell script: its shell blocks, and a heredoc for each file it shows. */
export function tutorialScript(page: string): TutorialScript {
  const lines = ["set -eu"];
  const written = new Set<string>();
  const skipped = new Set<RegExp>();
  for (const m of page.matchAll(/^(`{3,}|~{3,})(\S*)([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm)) {
    const [, , lang = "", meta = "", body = ""] = m;
    const ref = sampleRef(meta);
    if (ref) {
      if (!ref.file.startsWith(EXAMPLE)) continue;
      const path = ref.file.slice(EXAMPLE.length);
      const { text } = readSample(ref);
      const append = ref.region !== undefined && written.has(path);
      lines.push(`mkdir -p "$(dirname ${path})"`, append ? `{ echo; cat; } >> ${path} <<'${EOF}'` : `cat > ${path} <<'${EOF}'`, text, EOF);
      written.add(path);
    } else if (SHELL.has(lang)) {
      for (const line of body.replace(/\\\n\s*/g, " ").split("\n").map((l) => l.trim())) {
        if (!line || line.startsWith("#")) continue;
        const skip = SKIPPED.find((re) => re.test(line));
        if (skip) skipped.add(skip);
        else lines.push(line);
      }
    }
  }
  const unused = SKIPPED.filter((re) => !skipped.has(re));
  if (unused.length > 0) throw new Error(`The tutorial no longer has a line matching ${unused.join(", ")}; drop it from SKIPPED.`);
  return { script: `${lines.join("\n")}\n`, files: [...written] };
}

/** The files of the finished repo in `examples/tutorial/`, by their path in it, without region markers. */
function finishedRepo(): Map<string, string> {
  const root = repoPath(EXAMPLE);
  const files = new Map<string, string>();
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    files.set(file, extractRegion(readFileSync(join(root, file), "utf8"))!);
  }
  return files;
}

export function runTutorial({ keep = false } = {}): void {
  if (!existsSync(repoPath("dist/viewer/index.html"))) throw new Error("The viewer is not built; run `pnpm build:viewer` first.");
  const { script, files } = tutorialScript(readFileSync(repoPath(PAGE), "utf8"));
  const tmp = mkdtempSync(join(tmpdir(), "archidocs-tutorial-"));
  try {
    // `archidocs` on the PATH is this repo's CLI.
    const bin = join(tmp, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "archidocs"), `#!/bin/sh\nexec "${process.execPath}" "${repoPath("src/cli/main.ts")}" "$@"\n`);
    chmodSync(join(bin, "archidocs"), 0o755);
    const home = join(tmp, "home");
    mkdirSync(home);
    const done = join(tmp, "repo-path");
    writeFileSync(join(tmp, "tutorial.sh"), `${script}pwd > "${done}"\n`);
    execFileSync("bash", [join(tmp, "tutorial.sh")], {
      cwd: home,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env["PATH"] ?? ""}`,
        HOME: home,
        GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
        GIT_AUTHOR_NAME: "Tutorial",
        GIT_AUTHOR_EMAIL: "tutorial@example.com",
        GIT_COMMITTER_NAME: "Tutorial",
        GIT_COMMITTER_EMAIL: "tutorial@example.com",
      },
    });
    const repo = readFileSync(done, "utf8").trim();

    // The files the page shows add up to the finished Workspace, so a reader who follows it ends where the example does.
    const finished = finishedRepo();
    const missing = [...finished.keys()].filter((f) => !files.includes(f));
    if (missing.length > 0) throw new Error(`The tutorial never shows ${missing.join(", ")}, which examples/tutorial/ has.`);
    for (const [path, text] of finished) {
      if (readFileSync(join(repo, path), "utf8").trimEnd() !== text.trimEnd()) throw new Error(`${path} as the tutorial builds it differs from ${EXAMPLE}${path}.`);
    }

    // The site holds the viewer and the Model.
    const site = join(repo, "_site");
    for (const file of ["index.html", "workspace.bundle.json", "bundles/index.json"]) {
      if (!existsSync(join(site, file))) throw new Error(`The tutorial's site has no ${file}.`);
    }
    const bundle = readFileSync(join(site, "workspace.bundle.json"), "utf8");
    for (const id of ["digital:customer", "digital:spa", "digital:api", "digital:database"]) {
      if (!bundle.includes(`"${id}"`)) throw new Error(`The tutorial's Bundle has no ${id}.`);
    }
    console.log(`The tutorial ran end to end in ${repo}.`);
  } finally {
    if (keep) console.log(`Kept ${tmp}.`);
    else rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { keep: { type: "boolean", default: false } } });
  runTutorial({ keep: values.keep });
}
