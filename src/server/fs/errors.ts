/** Filesystem errors with deterministic, user-facing codes (FAIL-04..07). */
export type FsErrorCode =
  | "INVALID_PATH"
  | "OUTSIDE_ROOT"
  | "SYMLINK_REJECTED"
  | "NOT_FOUND"
  | "NOT_A_FILE"
  | "TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "PERMISSION_DENIED"
  | "IO_ERROR";

/**
 * Brand shared by every copy of this module. Next.js can load it once per
 * bundle layer (SSR chunk vs. route handler), and the workspace service
 * singleton on `globalThis` may throw errors built by another copy, so
 * `instanceof` checks the brand instead of class identity.
 */
const FS_ERROR_BRAND = Symbol.for("archidoc.FsError");

export class FsError extends Error {
  readonly [FS_ERROR_BRAND] = true;

  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { [FS_ERROR_BRAND]?: unknown })[FS_ERROR_BRAND] === true
    );
  }

  constructor(
    readonly code: FsErrorCode,
    message: string,
    readonly path?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "FsError";
  }
}

/** Map a Node.js system error to an FsError. */
export function toFsError(err: unknown, relPath: string): FsError {
  if (err instanceof FsError) return err;
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  switch (code) {
    case "ENOENT":
    case "ENOTDIR":
      return new FsError("NOT_FOUND", `File not found: ${relPath}`, relPath, { cause: err });
    case "EACCES":
    case "EPERM":
      return new FsError("PERMISSION_DENIED", `Permission denied: ${relPath}`, relPath, {
        cause: err,
      });
    case "ELOOP":
      return new FsError("SYMLINK_REJECTED", `Refusing to follow symlink: ${relPath}`, relPath, {
        cause: err,
      });
    case "EISDIR":
      return new FsError("NOT_A_FILE", `Not a regular file: ${relPath}`, relPath, { cause: err });
    default:
      return new FsError(
        "IO_ERROR",
        `I/O error on ${relPath}: ${(err as Error)?.message ?? String(err)}`,
        relPath,
        {
          cause: err,
        },
      );
  }
}
