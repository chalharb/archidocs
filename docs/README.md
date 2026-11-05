# Requirements Documentation Guide

This folder holds the product requirements for Architecture Docs and the tools for tracking changes and progress against them.

```
docs/
├── README.md                 ← this guide
├── Archidocs-prd.md          ← approved baseline PRD v1.6 (frozen)
├── addenda/
│   ├── README.md             ← addenda index and change log
│   ├── _TEMPLATE.md          ← copy this to create a new addendum
│   └── ADD-NNN-<slug>.md     ← one file per change
└── checklists/
    ├── README.md             ← progress summary (generated) and conventions
    ├── 00-phase-0-backlog.md ← Phase 0 epics + Definition of Done
    ├── 01-model-and-schema.md
    ├── 02-diagrams.md
    ├── 03-layout.md
    ├── 04-reliability.md
    ├── 05-security.md
    ├── 06-testing.md
    ├── 07-performance.md
    ├── 08-ci-quality-gates.md
    └── 09-later-phases.md
```

---

## 1. The three layers

| Layer | Purpose | Changes how? |
|---|---|---|
| **Baseline PRD** | The approved v1.6 requirements. | Frozen. Only typo fixes. |
| **Addenda** | Every change, clarification, pivot, deferral, or removal after the baseline. | New file per change; statuses move forward. |
| **Checklists** | Trackable checkbox version of the effective requirements. | Ticked as work lands; updated when an addendum is accepted. |

**Effective requirements = baseline + all `Accepted` addenda, applied in number order.**

---

## 2. Reading the requirements

1. Find the requirement ID in the baseline PRD (e.g. `LAYOUT-08`).
2. Search the addenda for that ID: `grep -rn "LAYOUT-08" docs/addenda/`.
3. If an accepted addendum touches it, the addendum's text governs.
4. The checklist item for the ID will also carry a note such as `(amended by ADD-003)`.

### Requirement ID families

| Prefix | Area | PRD section | Checklist |
|---|---|---|---|
| `MODEL-` | Architecture repository | §2.1 | 01 |
| `SCHEMA-` | YAML schema consistency | §3 | 01 |
| `DIAG-` | Diagram visualization | §2.2 | 02 |
| `LAYOUT-` | Layout editor and persistence | §2.3, §4 | 03 |
| `RELI-` | Filesystem sync and recovery | §5 | 04 |
| `SEC-` | Local application security | §6 | 05 |
| `TEST-` | Automated testing | §7 | 06 |
| `PERF-` | Performance | §8 | 07 |
| `P0-` | Phase 0 backlog epics | §9 | 00 |
| `CI-` | CI quality gates (IDs assigned in checklist; PRD §10 lists them unnumbered) | §10 | 08 |

IDs are permanent. A removed requirement keeps its ID with status "Removed by ADD-NNN"; the ID is never reused.

---

## 3. Changing requirements (addenda)

Use an addendum for anything that alters what the baseline says: new requirements, changed scope, priority changes, deferrals, technology swaps, clarifications that resolve ambiguity, or removals.

### Workflow

1. **Copy** `addenda/_TEMPLATE.md` to `addenda/ADD-NNN-<short-slug>.md`, using the next free number (see `addenda/README.md`).
2. **Fill in** the context, the change, every affected requirement ID, and the impact on checklists.
3. **Set status** to `Proposed` and add a row to the index in `addenda/README.md`.
4. **Decide.** The product owner moves it to `Accepted` or `Rejected` and records the date.
5. **On acceptance**, update the checklists in the same change:
   - **Modified** requirement → edit the item's text, append `(amended by ADD-NNN)`.
   - **New** requirement → add an item with a new ID and `(added by ADD-NNN)`.
   - **Removed or deferred** → strike it through and note it: `- [ ] ~~**DIAG-06** ...~~ (deferred by ADD-NNN)`. Removed items don't count toward progress.
   - Already-ticked items affected by the change → untick them if the existing work no longer satisfies the amended requirement.
6. Run `scripts/prd-progress.sh --write`.

### Statuses

| Status | Meaning |
|---|---|
| `Proposed` | Drafted, not yet in effect. |
| `Accepted` | In effect; overrides the baseline. |
| `Rejected` | Considered and declined; kept for the record. |
| `Superseded` | Replaced by a later addendum (link to it). |

Don't delete addenda. Rejected and superseded ones explain why things are the way they are.

### Consolidating into a new baseline

When the addenda pile up (roughly 10+ accepted, or before a major phase starts), fold them into a new PRD version (e.g. v1.7): copy the PRD, apply all accepted addenda, bump the version, and mark those addenda `Consolidated into v1.7` in the index. The old baseline stays in git history.

---

## 4. Tracking progress (checklists)

### Item format

```markdown
- [ ] **MODEL-01** `P0` `Phase 0` — Support individual `Entity` YAML resources
- [x] **MODEL-02** `P0` `Phase 0` — Support grouped `EntitySet` YAML resources — ✅ tests/schema/entity-set.test.ts, PR #12
```

- Tick an item only when it is **done and verified**: implementation merged, required tests passing, and the epic's acceptance criteria met.
- Always add **evidence** after the ✅: test file paths, PR number, or commit hash.
- Partial progress goes in nested sub-items, not in a third checkbox state:

  ```markdown
  - [ ] **RELI-01** ... 
    - [x] chokidar watcher for workspace roots
    - [ ] debounce + batch change events
  ```

- Blocked items: append `⛔ blocked: <reason>`.

### Progress summary

`scripts/prd-progress.sh` counts open and ticked items per checklist, ignoring struck-through (removed or deferred) items.

```sh
scripts/prd-progress.sh          # print the table
scripts/prd-progress.sh --write  # also update checklists/README.md
```

---

## 5. Instructions for AI agents

The repository-root `CLAUDE.md` gives agents the short version of these rules. In particular, an agent must never edit the baseline PRD to change a requirement, and must propose an addendum instead of silently deviating.
