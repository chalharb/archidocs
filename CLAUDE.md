# Archidoc — Agent Instructions

Architecture Docs is a local-first architecture documentation app (Next.js, TypeScript, React Flow, ELK.js) with YAML files as the source of truth. Requirements live in `docs/`.

## Requirements: where to look

| What | Path |
|---|---|
| Approved baseline PRD (v1.7, consolidates ADD-001..008) — **read-only** | `docs/Archidocs-prd.md` |
| How the requirements docs work (full guide) | `docs/README.md` |
| Changes/pivots to the baseline | `docs/addenda/` (index in `docs/addenda/README.md`) |
| Progress tracking checklists | `docs/checklists/` (summary in `docs/checklists/README.md`) |

**The effective requirements = baseline PRD + every addendum with status `Accepted`.** Addenda marked `Consolidated into v1.7` are already part of the baseline. When an accepted addendum conflicts with the baseline, the addendum wins. A later addendum wins over an earlier one.

## Rules

1. **Never edit `docs/Archidocs-prd.md`** to change a requirement. Record changes as an addendum (see `docs/addenda/_TEMPLATE.md`). Typo fixes and the consolidation procedure in `docs/README.md` §3 (when the product owner asks for it) are the only exceptions.
2. **Before implementing a requirement**, check `docs/addenda/README.md` for addenda that touch its ID.
3. **Requirement IDs are permanent.** Never renumber or reuse an ID. New requirements continue the family's sequence (e.g. the next model requirement is `MODEL-11`; check addenda for IDs already allocated).
4. **When you finish work that satisfies a checklist item**, tick it (`- [x]`) and append evidence: `— ✅ <evidence>` (test file, PR, or commit). Don't tick items without automated tests where the PRD requires them.
5. **If you discover a requirement is wrong, ambiguous, or infeasible**, don't silently deviate. Draft an addendum with status `Proposed` and tell the user.
6. After changing checklists, run `scripts/prd-progress.sh --write` to refresh the progress summary.

## Non-negotiable principles (from PRD §1)

- YAML is canonical; layout/presentation is stored separately in `.layout.yaml`.
- Invalid data must never silently overwrite valid data.
- All filesystem access goes through server-side repository services, restricted to configured workspace roots.
- Tests are part of every epic, not deferred. Coverage: 95% critical domain, 85% overall, 85% branch.
