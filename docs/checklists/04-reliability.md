# Filesystem Synchronization and Recovery

Source: PRD §5. Conventions: [checklists/README.md](README.md). All items are Phase 0 (epics P0-11, P0-12).

## External modification handling

- [ ] **RELI-01** — Detect external changes to workspace YAML files
- [ ] **RELI-02** — Validate externally modified files before updating the active model
- [ ] **RELI-03** — Auto-refresh valid changes when no conflicting local modifications exist
- [ ] **RELI-04** — Keep the last valid model on failed reload and clearly mark it stale
- [ ] **RELI-05** — Show actionable file and schema diagnostics
- [ ] **RELI-06** — Detect conflicts using file revision info or content hashes
- [ ] **RELI-07** — Prevent silent overwrites of externally modified files

## Persistence and recovery

- [ ] **RELI-08** — Temporary files + atomic replacement where supported
- [ ] **RELI-09** — Validate proposed changes before writing
- [ ] **RELI-10** — Distinguish unsaved editor state, autosaved drafts, and Git-committed revisions
- [ ] **RELI-11** — Recover compatible autosaved drafts after interruption
- [ ] **RELI-12** — Preserve valid files when a write fails
- [ ] **RELI-13** — Detect orphaned architecture and diagram references after deletion
- [ ] **RELI-14** — Workspace reload without restarting the app

## Failure behavior

- [ ] **FAIL-01** — Malformed YAML never crashes the application
- [ ] **FAIL-02** — Failed layout save reports the failure and retains recoverable unsaved changes
- [ ] **FAIL-03** — External edits conflicting with local layout changes require explicit resolution
- [ ] **FAIL-04** — Deterministic errors for file deletion
- [ ] **FAIL-05** — Deterministic errors for file rename
- [ ] **FAIL-06** — Deterministic errors for permission failures
- [ ] **FAIL-07** — Deterministic errors for interrupted saves
