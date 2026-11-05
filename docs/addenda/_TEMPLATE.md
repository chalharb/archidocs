# ADD-NNN: <Short title>

| Field | Value |
|---|---|
| **Status** | Proposed <!-- Proposed · Accepted · Rejected · Superseded by ADD-NNN --> |
| **Type** | Change <!-- Addition · Change · Removal · Deferral · Clarification · Pivot --> |
| **Proposed** | YYYY-MM-DD by <name> |
| **Decided** | YYYY-MM-DD by <name> <!-- leave blank while Proposed --> |
| **Baseline** | PRD v1.6 |
| **Affected IDs** | e.g. LAYOUT-08, LAYOUT-23 |
| **PRD sections** | e.g. §2.3, §4 |

## Context

Why is this change needed? What was learned, what changed, or what was ambiguous?

## Change

State exactly what changes. Quote the baseline text and give the replacement.

### LAYOUT-08 (modified)

> **Before:** Persist manual overrides in separate `.layout.yaml` files

> **After:** <new requirement text>

### MODEL-11 (new)

> <new requirement text> — Priority: P0/P1

### DIAG-06 (removed / deferred to Phase N)

> Reason: ...

## Consequences

- Impact on architecture, data model, or YAML schema compatibility (PRD §13: future changes must preserve the canonical model and versioned schema).
- Impact on existing work, tests, or fixtures.
- Risks and follow-ups.

## Checklist updates

Done in the same change as acceptance:

- [ ] Updated items in `docs/checklists/<file>.md`
- [ ] Added new IDs to the "Allocated requirement IDs" table in `addenda/README.md`
- [ ] Unticked completed items that no longer satisfy the amended requirement
- [ ] Ran `scripts/prd-progress.sh --write`
