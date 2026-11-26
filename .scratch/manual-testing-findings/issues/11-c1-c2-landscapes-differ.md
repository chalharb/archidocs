# 11: C1 and C2 Landscapes differ

Status: needs-triage

## Problem

The C1 and C2 Landscapes look identical (same four Persons, the System, Entra ID). The only difference is C2's `+` to open a System.

## Cause

`src/core/views/generated.ts:15,48` builds both with `landscape()`: every top-level Element. C1 ignores `expand`; C2 honours it. With nothing expanded, they are the same picture.

## Decide

What C2 Landscape is for. Options:

- **C2 opens every System by default** (Services visible, Persons and externals around them) and `+`/`−` collapses. That's what C4's container level means and makes it clearly different from C1.
- **Drop the C2 Landscape** and let C1's `+` open Systems in place; the C2 rung becomes the per-System View (`c2/<system>`). Simpler, but Compare and saved links that use `c2` need a redirect.

Either way, 12 follows from the choice.
