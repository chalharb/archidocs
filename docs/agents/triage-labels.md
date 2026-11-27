# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                                                        |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue                                        |
| `needs-info`               | `needs-triage`       | Waiting on the reporter for more information                                   |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent                                        |
| `ready-for-human`          | `needs-human`        | Needs a human: dashboard work, credentials or a decision no agent should make |
| `wontfix`                  | `wontfix`            | Will not be actioned                                                           |

They are options of the Archidocs Project's `Status` field, not issue labels. Two roles are named differently:

- **`needs-info`** shares `needs-triage`. A skill that applies `needs-info` sets `needs-triage` and posts a comment saying what it's waiting for.
- **`ready-for-human`** is `needs-human`.

The field has four more options, which aren't triage roles:

- **`backlog`**: where every new spec, map and issue starts, before anyone has looked at it. Triage moves it to one of the roles above.
- **`in-progress`** (claimed, being worked), **`in-review`** (PR open) and **`done`** (PR merged).

The columns run `backlog` → `needs-triage` → `ready-for-agent` / `needs-human` → `in-progress` → `in-review` → `done`, with `wontfix` beside them.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.
