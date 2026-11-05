# Filesystem Synchronization and Recovery

Source: PRD §5. Conventions: [checklists/README.md](README.md). All items are Phase 0 (epics P0-11, P0-12).

## External modification handling

- [x] **RELI-01** — Detect external changes to workspace YAML files — ✅ src/server/workspace/repository.integration.test.ts › file watching (88ddabb, 7b2ae36)
- [x] **RELI-02** — Validate externally modified files before updating the active model — ✅ src/server/workspace/snapshot.test.ts, repository.integration.test.ts › stale handling (88ddabb)
- [x] **RELI-03** — Auto-refresh valid changes when no conflicting local modifications exist — ✅ repository.integration.test.ts › detects external edits and refreshes (88ddabb)
- [x] **RELI-04** — Keep the last valid model on failed reload and clearly mark it stale — ✅ src/server/workspace/snapshot.test.ts, repository.integration.test.ts › keeps the last valid model (88ddabb)
- [x] **RELI-05** — Show actionable file and schema diagnostics — ✅ diagnostics with file/line/path/hint; src/domain/parse.test.ts, src/components/workspace-summary.test.tsx (71ac6c9, 376c8e5)
- [x] **RELI-06** — Detect conflicts using file revision info or content hashes — ✅ sha256 content revisions; persistence.integration.test.ts (61a78db)
- [x] **RELI-07** — Prevent silent overwrites of externally modified files — ✅ persistence.integration.test.ts › refuses to overwrite an externally modified file (61a78db)

## Persistence and recovery

- [x] **RELI-08** — Temporary files + atomic replacement where supported — ✅ src/server/fs/fs.integration.test.ts › atomicWriteFile (0b9418e)
- [x] **RELI-09** — Validate proposed changes before writing — ✅ persistence.integration.test.ts › prepareLayout: validate before write (61a78db)
- [x] **RELI-10** — Distinguish unsaved editor state, autosaved drafts, and saved file revisions (content hashes) (amended by ADD-002) — ✅ drafts in .archidoc/drafts with base revision; `persistence.revision`/`persistence.draft` per diagram; src/server/persistence/persistence.integration.test.ts › drafts, repository.integration.test.ts (61a78db, 88ddabb)
- [x] **RELI-11** — Recover compatible autosaved drafts after interruption — ✅ repository.integration.test.ts › keeps a recoverable draft (88ddabb)
- [x] **RELI-12** — Preserve valid files when a write fails — ✅ fs.integration.test.ts › failure injection, persistence.integration.test.ts › preserves the previous file (0b9418e, 61a78db)
- [x] **RELI-13** — Detect orphaned architecture and diagram references after deletion — ✅ repository.integration.test.ts › deleted file → missing-reference diagnostics (88ddabb)
- [x] **RELI-14** — Workspace reload without restarting the app — ✅ repository.integration.test.ts › reload without restart; POST /api/workspaces/[ws]/reload (88ddabb, 58c2506)

## Failure behavior

- [x] **FAIL-01** — Malformed YAML never crashes the application — ✅ parse.test.ts › never throws (fast-check fuzz), repository.integration.test.ts › hostile files (71ac6c9, 88ddabb)
- [x] **FAIL-02** — Failed layout save reports the failure and retains recoverable unsaved changes — ✅ repository.integration.test.ts › keeps a recoverable draft when the write fails (88ddabb)
- [x] **FAIL-03** — External edits conflicting with local layout changes require explicit resolution — ✅ persistence.integration.test.ts › assessDraft conflict; repository.integration.test.ts › flags drafts that conflict (61a78db)
- [x] **FAIL-04** — Deterministic errors for file deletion — ✅ repository.integration.test.ts › deleted file; persistence.integration.test.ts › deleted layout (88ddabb, 61a78db)
- [x] **FAIL-05** — Deterministic errors for file rename — ✅ repository.integration.test.ts › renamed file (88ddabb)
- [x] **FAIL-06** — Deterministic errors for permission failures — ✅ fs.integration.test.ts › permission failures; repository.integration.test.ts › unreadable files (0b9418e, 7b2ae36)
- [x] **FAIL-07** — Deterministic errors for interrupted saves — ✅ fs.integration.test.ts › rename fails (interrupted save) (0b9418e)
