---
name: concurrent-model-writes
description: Checks that the Model write tools (the YAML writer in src/writer/ behind the MCP server's upsert_*, remove_*, propose_adr and create_project tools) stay safe when two writes run at once, by exploring every interleaving of the real write() code's file-system calls. Use when changing src/writer/**, src/mcp/writes.ts, src/mcp/http.ts, src/core/fs.ts or Load's file reads, when adding a write tool, or when touching the write queue or the atomic file write.
---

# Concurrent Model writes

## The promise

**Property.** When two Model writes run at the same time, the result is the same as running them one at a time in some order, and a Workspace with no errors still has none afterwards.

**Harm when it breaks.** An agent is told its write succeeded, but the Element, Relationship or ADR is gone, or the checkout on disk now fails `archidocs check`, and nothing reports it.

Two writes do run at once. `serveHttp` (src/mcp/http.ts) builds a fresh server for each request, so several agents on `archidocs mcp --http --allow-writes` write concurrently. One client can also send overlapping tool calls over stdio.

Each write (`writeNow` in src/writer/index.ts) loads the Workspace, plans the edit, re-checks with Load over an overlay, then calls `fs.writeFile`, awaiting the file system at every step. Two things keep writes from interfering:
- **The queue in `write()`:** one promise chain per resolved Workspace root, so each write starts only after the previous write on that root has finished.
- **The atomic file write:** `nodeFileSystem().writeFile` (src/core/fs.ts) writes a hidden temp file and renames it over the target, so a file is never left half written.

## Run it

```bash
pnpm formal:writes                                    # every scenario, ≤2 preemptions, stops at the first failing schedule
node scripts/formal/concurrent-writes.ts --all        # keep going; count failing schedules
node scripts/formal/concurrent-writes.ts --bound 0    # one-at-a-time only: the writer's own guards
node scripts/formal/concurrent-writes.ts --bound 3 --scenario two-adds-one-file
```

The script needs only Node 22.18+ and the repo's dependencies. A run takes under 3 seconds. It exits 0 when every scenario passes and 1 when any fails.

## How it works

- `scripts/formal/schedule.ts` is a bounded systematic scheduler, in the style of CHESS:
  - Every `readFile`, `readDir`, `exists` and `writeFile` a task makes waits until the scheduler releases it.
  - A task waiting on something other than the file system, such as the write queue, counts as blocked.
  - It runs every schedule with at most `--bound` preemptions. A preemption is a switch away from a task that could have continued.
  - Each schedule starts from a fresh in-memory copy of the files.
- `scripts/formal/concurrent-writes.ts` holds the scenarios. Each is a starting Workspace plus two `WriteRequest`s, which run through the real `write()`; only the file system is replaced. It explores both start orders, because a task queued behind another is only ever second.
- For each schedule, it checks two properties:
  - **VALID:** Load of the final files reports no `error` issue. Each scenario starts with none.
  - **SERIAL:** each write's result (action and subject, or refusal code) and the final files equal one of the two one-at-a-time orders. Those orders come from the same harness at bound 0.

| Scenario | Writes | Starts from |
| --- | --- | --- |
| `remove-while-referenced` | `remove-element shop:db` ∥ `upsert-relationship shop:web → db` | web and db in separate files |
| `two-adds-one-file` | `upsert-element shop:cart` ∥ `upsert-element shop:search` | both land in shop/model.yaml |
| `two-adrs-one-project` | `propose-adr` ∥ `propose-adr` in shop | no ADRs yet |

## Status at the sync commit: PASSES

Every scenario passes at `--bound 3`. Because of the queue, the second write never starts until the first finishes, so each start order has exactly one schedule. `PASS … 2 schedules` is expected, not a sign that the explorer stopped working.

Without the queue, if `write()` calls `writeNow` directly, all three scenarios fail from one preemption up. This is how the bug was found. In each case writer 1 finishes its reads and its validation, writer 2 runs from start to finish, and then writer 1 writes files built from what it read earlier.

| Scenario | Broken without the queue | What happens | Schedules broken (≤2 preemptions) |
| --- | --- | --- | --- |
| `remove-while-referenced` | VALID | Both succeed. web.yaml gets `- to: db` and db.yaml loses `db`, so the Relationship points at nothing. | 128/964 |
| `two-adds-one-file` | SERIAL | Both report `created`, but writer 1's model.yaml replaces writer 2's, so `search` is lost. | 392/732 |
| `two-adrs-one-project` | VALID | Both take `shop:0001` (the next number comes from `edit.ws.adrs`), so check reports `duplicate-adr-number`. | 672/732 |

Before the fix, two parallel `upsert_element` calls against a real disk both returned `created`. shop/model.yaml lost one Service and ended with a stray `rch` from the two interleaved `writeFile` calls. Two things now guard against this:
- The test "runs overlapping writes one at a time, so neither undoes the other" in test/mcp/writes.test.ts covers the end-to-end behaviour.
- The atomic rename prevents torn files.

Never weaken a property, drop a scenario, or change a starting Workspace to make the check pass.

## When your change touches this

1. Check whether the diff touches a file in the coverage record below. If so, run `node scripts/formal/concurrent-writes.ts --all --bound 3`.
2. Read the result:
   - **All PASS:** the property still holds.
   - **FAIL at `--bound 0`:** a regression in the writer's one-at-a-time guards, such as Load's check or a reference check in a remove. At bound 0 the check is ordinary sequential behaviour, so treat it as a real bug.
   - **FAIL only above bound 0:** two writes can interleave again. Usually the queue in `write()` was bypassed or keyed differently, or a write path now calls `writeNow` or `fs.writeFile` outside it.
3. To tell a real bug from a modeling error, read the printed schedule.
   - **Real bug:** each file-system call in the schedule matches one the code makes, and the final files would also come out of real `node:fs` in that order.
   - **Modeling error:** the harness throws `stuck:` or `two file-system calls at once`, or a scenario's starting Workspace has errors. Fix the harness, not the product code.
   - The scheduler assumes each task has at most one file-system call in flight. If the writer starts using `Promise.all` over fs calls, extend `scheduledFs` to queue several calls per task rather than turning that error off.
4. When you add a write tool or a new write path, such as a new `op` in `WriteRequest`, add a scenario that pairs it with a write that touches the same file or the same reference.
5. If you change the queue or the atomic write, also run `npx vitest run test/mcp/writes.test.ts -t overlapping`. It sends parallel calls through the real MCP server to a real disk.

## Coverage record

| Covered code | What the check relies on |
| --- | --- |
| src/writer/index.ts: `write` (the `queues` map), `writeNow`, `upsertElement`, `upsertRelationship`, `removeElement`, `introducedErrors` | one queue per resolved root; load → plan → overlay check → `writeFile` inside it |
| src/writer/adrs.ts: `proposeAdr` | next ADR number taken from the loaded Workspace |
| src/writer/overlay.ts: `overlayFileSystem` | the check-time reads go through the shared fs |
| src/writer/document.ts: `YamlFile` | whole-file rewrite from the text read at load |
| src/core/load.ts: `loadDetailed` | its fs calls are sequential (one in flight per task) |
| src/core/fs.ts: `nodeFileSystem` | `writeFile` is temp file + rename, which matches the model's atomic write |
| src/mcp/writes.ts: `registerWriteTools` | each tool calls `write()`, never `writeNow` |
| src/mcp/http.ts: `serveHttp` | one server per request, so requests run concurrently |

Not covered:
- deployments.ts, views.ts and workspace.ts in src/writer have no scenario of their own. They go through the same `write()` queue, but no scenario exercises them.
- Three or more writers.
- git operations, which the writer never runs.
- **Separate processes.** The queue is in-process only, so two `archidocs mcp` processes writing to one checkout can still interleave and lose an update. The atomic rename keeps every file whole, but the later write can still undo the earlier one. Fixing that needs a lock file or a compare-before-write, and the scheduler models only one process.

**Last in sync:** the last commit that changed this file. Find it with `git log -1 --format=%h -- .claude/skills/concurrent-model-writes/SKILL.md`. To move the sync point forward:
1. Run the check against the new code.
2. Confirm that every row of the coverage record still describes the code.
3. Commit an edit to this file, at least to the status section.

To see what changed since the sync commit:

```bash
git diff "$(git log -1 --format=%h -- .claude/skills/concurrent-model-writes/SKILL.md)" -- src/writer src/mcp/writes.ts src/mcp/http.ts src/core/fs.ts src/core/load.ts
```

## Bounds and assumptions

- Two writers, three scenarios, at most 2 preemptions by default. A pass covers those schedules of those scenarios only, not every Workspace or every number of writers.
- Interleaving happens only at file-system calls. That is exact within one Node process using `fs/promises`, where code between awaits cannot be interrupted.
- Each `writeFile` is atomic in the model. On a real disk that holds because of the temp-file rename in `nodeFileSystem`. If that rename goes, the model no longer matches the disk.
- The queue is keyed by `resolve(root)`. Two different roots for the same folder, such as through a symlink, would get separate queues.
