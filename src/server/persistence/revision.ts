/** Content-hash revisions used for conflict detection (RELI-06). */
import { createHash } from "node:crypto";

export type Revision = `sha256:${string}`;

export function revisionOf(content: string): Revision {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}
