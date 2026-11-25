import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutAt } from "../../src/workspace/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { writeWorkspace, type Files } from "../support/workspace.ts";

/** The viewer the global setup builds, as `build` copies it into a site. */
export const VIEWER_DIR = fileURLToPath(new URL("../../dist/viewer/", import.meta.url));

/** Two errors in two files. */
export const brokenWorkspace: Files = {
  ...validWorkspace,
  "shop/more.yaml": "services:\n  cart:\n    name: Cart\n    owner: storefront\n",
  "shop/services.yaml": "services:\n  web:\n    name: Web\n    techology: Next.js\n",
};

/** A fixture Workspace in a fresh git repo with no commits, and its Checkout. */
export async function checkoutOf(files: Files) {
  const { repoRoot, root } = await writeWorkspace(files);
  return { repoRoot, root, checkout: checkoutAt(root) };
}

/** A fixture Workspace outside git, and its Checkout. */
export async function checkoutOutsideGit(files: Files) {
  const { repoRoot, root } = await writeWorkspace(files);
  await rm(join(repoRoot, ".git"), { recursive: true });
  return { root, checkout: checkoutAt(root) };
}
