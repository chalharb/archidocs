/**
 * Workspace images (SEC-12): read through the WorkspaceRoot, so the same
 * confinement and symlink rules apply (SEC-02..04), limited to a fixed set of
 * image types and a per-file size.
 */
import path from "node:path";
import { FsError } from "./errors";
import type { WorkspaceRoot } from "./workspace-root";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Allowed image extensions (lower-case) and the Content-Type they are served with. */
export const IMAGE_CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);

/** Content-Type for an allowed image path, or null for any other file type. */
export function imageContentType(rel: string): string | null {
  return IMAGE_CONTENT_TYPES.get(path.extname(rel).toLowerCase()) ?? null;
}

export interface WorkspaceImage {
  bytes: Buffer;
  contentType: string;
}

/**
 * Read an image by workspace-relative path. Path and type are checked before
 * any filesystem access; hidden directories and files (e.g. `.git`, `.archidoc`)
 * are never served, matching discovery.
 */
export async function readWorkspaceImage(
  root: WorkspaceRoot,
  rel: string,
  maxBytes: number = MAX_IMAGE_BYTES,
): Promise<WorkspaceImage> {
  const abs = root.lexical(rel);
  const parts = path.relative(root.realPath, abs).split(path.sep);
  if (parts.some((p) => p.startsWith("."))) {
    throw new FsError("INVALID_PATH", `Hidden paths are not served: ${rel}`, rel);
  }
  const contentType = imageContentType(abs);
  if (!contentType) {
    throw new FsError("UNSUPPORTED_TYPE", `Not an allowed image type: ${rel}`, rel);
  }
  return { bytes: await root.readBytes(rel, maxBytes), contentType };
}
