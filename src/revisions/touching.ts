/**
 * The Revisions whose changed ids satisfy `matches`, newest first as the
 * index lists them. `matches` is usually core's `scopeMatcher`.
 */
export function touching<R extends { changedIds: string[] }>(revisions: readonly R[], matches: (ids: string[]) => boolean): R[] {
  return revisions.filter((r) => matches(r.changedIds));
}
