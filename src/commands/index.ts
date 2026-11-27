/**
 * The CLI's commands as functions over a Checkout: each takes options and
 * returns a tagged result, for `run` to format or for the docs site to use.
 * Node-only. None writes to a stream or reads `process`; an expected outcome
 * is a result, and only unexpected failures (git, the disk) throw.
 */
export { check, type CheckResult } from "./check.ts";
export { build, type BuildOptions, type BuildResult } from "./build.ts";
export { exportViews, type ExportOptions, type ExportResult, type ExportedFile } from "./export.ts";
export { diff, type DiffResult, type DiffSide } from "./diff.ts";
export { buildHistory, type BuildHistoryOptions, type BuildHistoryResult } from "./history.ts";
export { gaps, type GapsResult } from "./gaps.ts";
