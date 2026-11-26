/**
 * Which release the built site documents, for the line in its page footer.
 *
 * Production and PR Previews document the latest release: the root
 * `package.json`'s version. The staging site, beta.archidocs.dev, builds from
 * the `beta` branch, where `package.json` still holds the last stable version
 * (betas commit nothing back), so it names the branch and commit instead.
 * `.github/workflows/sites.yml` sets `ARCHIDOCS_DOCS_CHANNEL=beta` for that build.
 */
import { execFileSync } from "node:child_process";
import { REPO_ROOT, VERSION } from "./repo.ts";

export interface Release {
  /** `beta` for the staging build; anything else means the latest release. */
  channel: string | undefined;
  /** The version in the root `package.json`. */
  version: string;
  /** The short commit the site was built from, or undefined outside git. */
  commit: string | undefined;
}

export function releaseLine({ channel, version, commit }: Release): string {
  if (channel !== "beta") return `Documents Archidocs v${version}, the latest release.`;
  const at = commit ? ` at ${commit}` : "";
  return `Documents the beta branch${at}, ahead of the latest release, v${version}.`;
}

/** The release this build documents, read from the environment and the repo. */
export function currentRelease(): Release {
  const channel = process.env.ARCHIDOCS_DOCS_CHANNEL;
  return { channel, version: VERSION, commit: channel === "beta" ? shortCommit() : undefined };
}

function shortCommit(): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: new URL(REPO_ROOT), encoding: "utf8" }).trim() || undefined;
  } catch {
    return undefined;
  }
}
