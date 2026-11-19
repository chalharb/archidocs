# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase. Layout: **single-context**.

## Before exploring, read these

- **`.notes/requirements.md`**: the source of truth for what to build.
- **`GLOSSARY.md`** at the repo root.
- **`.notes/adr/`**: decision records (MADR format). Read the ones that touch the area you're
  about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't
suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and
`/improve-codebase-architecture`) creates them lazily when terms or decisions actually get
resolved.

## File structure

```
/
├── GLOSSARY.md
├── .notes/
│   ├── requirements.md
│   └── adr/
│       ├── README.md
│       ├── 0001-first-user.md
│       └── ...
└── src/
```

## Decision records

`.notes/adr/` is a protected path. Add a new record rather than changing an accepted one,
and only when asked. A record's number never changes; to reverse a decision, add a new record
and mark the old one "Superseded by NNNN". See `.notes/adr/README.md`.

## Use the glossary's vocabulary

When your output names a domain concept (in a task title, a refactor proposal, a hypothesis,
a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary
explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing decision record, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-0012 (layout engine), but worth reopening because…_
