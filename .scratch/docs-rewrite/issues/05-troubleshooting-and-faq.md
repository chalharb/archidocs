# 05: Troubleshooting and FAQ

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

A new Help sidebar group with two pages.

**`help/troubleshooting`:** one entry per problem, each with the symptom as printed, the cause and the fix. Take the symptoms from the errors the code really prints (`UsageError` and friends in `src/`). At least:

- "No workspace.yaml found in this folder, its archidocs/ folder, or any folder above."
- The viewer is empty after `archidocs init`.
- The published site has no history, or `archidocs diff` can't find a ref: the CI checkout is shallow.
- A PR preview has no base to Compare against: `origin/<base>` wasn't fetched.
- `archidocs dev` can't start: the port is in use.
- The Node.js version is too old.
- `check` passes locally and fails in CI: different CLI versions.

**`help/faq`:** short answers that link out: does Archidocs host anything, can the viewer edit the Model, one repo or many, does it read my code, where do diagrams' positions come from.

## Acceptance criteria

- [ ] Both pages exist under a Help group, last in the sidebar.
- [ ] A test checks that every error message quoted on the troubleshooting page appears verbatim in `src/`, so a reworded error fails the build.
- [ ] Each troubleshooting entry links the guide or reference page that covers its fix.
