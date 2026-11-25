/**
 * The one rule for which files make up a Workspace: `load`'s walk, the
 * Checkout's fingerprint and (later) dev's watcher all use it. Pure and
 * browser-safe, so core can use it.
 */

/** Whether `load` skips a folder or file by its name: hidden ones (`.git`, editor swap files) and `node_modules`. */
export function isSkippedName(name: string): boolean {
  return name.startsWith(".") || name === "node_modules";
}

/**
 * Whether a path, relative to the Workspace root and `/` or `\` separated,
 * is a Workspace file: no part of it is skipped, and it is a `.yaml` model
 * file or an `.md` ADR.
 */
export function isWorkspaceFile(path: string): boolean {
  const parts = path.split(/[\\/]/).filter((part) => part !== "");
  if (parts.length === 0 || parts.some(isSkippedName)) return false;
  return path.endsWith(".yaml") || path.endsWith(".md");
}
