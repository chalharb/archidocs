# ADD-002: Defer Git-committed revision state (RELI-10) to Phase 4

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Deferral |
| **Proposed** | 2026-11-05 by Claude (Phase 0 implementation) |
| **Decided** | 2026-11-05 by Logan Harber |
| **Baseline** | PRD v1.6 |
| **Affected IDs** | RELI-10, RELI-15 (new) |
| **PRD sections** | §5, §11 |

## Context

RELI-10 asks Phase 0 to "distinguish unsaved editor state, autosaved drafts, and Git-committed revisions". Phase 0 implements the first two layers plus the saved file:

- **Unsaved editor state** lives in the client (Phase 1 editor).
- **Autosaved drafts** live in `.archidoc/drafts/<diagram>.json` with the layout revision they were based on, and are reported as `recoverable`, `conflict`, `incompatible` or `corrupt`.
- **Saved files** are identified by content hash (`sha256:…`), which also drives conflict detection.

Knowing whether the saved file matches a *Git commit* requires reading the repository (HEAD, index, status). That is the subject of Phase 4 ("Versioning and GitHub": revision comparisons, Git branches, commits). Doing it in Phase 0 would add a Git dependency and a second filesystem surface (`.git/`) before the security model for it is designed.

## Change

### RELI-10 (modified)

> **Before:** Distinguish unsaved editor state, autosaved drafts, and Git-committed revisions.

> **After:** Distinguish unsaved editor state, autosaved drafts, and saved file revisions (content hashes). Distinguishing Git-committed revisions is deferred to Phase 4 (RELI-15).

### RELI-15 (new)

> Distinguish Git-committed revisions from saved but uncommitted file revisions — Priority: P1, Phase 4

## Consequences

- No schema or data-model impact: drafts and revisions already carry content hashes that Phase 4 can compare with Git blob contents.
- The Phase 0 API exposes `persistence.revision` and `persistence.draft` per diagram; Phase 4 can add a `committed` field without breaking clients.

## Checklist updates

Done on acceptance (2026-11-05):

- [x] Amended RELI-10 in `docs/checklists/04-reliability.md` with "(amended by ADD-002)" and ticked it with the existing evidence
- [x] Added RELI-15 to the Phase 4 section of `docs/checklists/09-later-phases.md` and to the allocated-IDs table
- [x] Ran `scripts/prd-progress.sh --write`
