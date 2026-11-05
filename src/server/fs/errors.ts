/** Filesystem errors with deterministic, user-facing codes (FAIL-04..07). */
export type FsErrorCode =
  | "INVALID_PATH"
  | "OUTSIDE_ROOT"
  | "SYMLINK_REJECTED"
  | "NOT_FOUND"
  | "NOT_A_FILE"
  | "TOO_LARGE"
  | "PERMISSION_DENIED"
  | "IO_ERROR";

export class FsError extends Error {
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
