# ADD-012: Phase 4 requirements: versioning and GitHub

| Field | Value |
|---|---|
| **Status** | Proposed |
| **Type** | Addition |
| **Proposed** | 2026-11-06 by Claude (Product Analyst agent) |
| **Decided** | |
| **Baseline** | PRD v1.7 |
| **Affected IDs** | RELI-15 (detailed); GIT-01..10, RELI-16, SEC-14, TEST-10, E2E-12..14, VR-15..16, BENCH-09, PH4-EXIT (all new); PH4-01..06, SEC-02, SEC-07, SEC-09, SEC-13, DIAG-12 |
| **PRD sections** | §5, §6, §7, §8, §11, §13 |

## Context

PRD §11 outlines Phase 4 in one line: "Revision comparisons, semantic diffs, recovery, Git branches, commits, PR integration, and validation workflows." Checklist 09 requires each later phase to be broken into detailed requirements by an addendum before work starts. This addendum does that for Phase 4. It also details RELI-15, which ADD-002 deferred to this phase.

What exists today:

- Saved files are identified by content hash (`sha256:…`, `src/server/persistence/revision.ts`). Drafts record the revision they were based on (RELI-10, RELI-11).
- Discovery skips hidden entries, including `.git` (§3). Nothing reads Git.
- The app writes only `.layout.yaml` files and drafts. It never writes canonical YAML or Markdown.
- Hosted read-only mode (SEC-13, ADD-010) refuses every write. ADD-010 noted that saving from a hosted deployment, for example by committing, "belongs to Phase 4".

§13 keeps two related items out of scope, and this addendum doesn't change that: "Advanced Git merge management" and "Additional source control providers". GitHub is the only hosting provider in scope.

The design keeps the principles of Phases 0–3: YAML is canonical, invalid data never overwrites valid data, all filesystem access (now including Git) goes through server-side repository services restricted to workspace roots, and nothing in the model or schema changes. Phase 4 needs no new resource kinds and no schema change.

**Open questions** are listed at the end, each with the default this addendum assumes. Accepting the addendum accepts those defaults unless the decision says otherwise.

## Change

### Git access

**GIT-01** (new): Repository detection. — P1, Phase 4

- For each workspace root, the server detects whether it is inside a Git work tree, and if so reports the repository's current branch (or detached `HEAD`), the `HEAD` commit, and any operation in progress (merge, rebase, cherry-pick, revert, bisect).
- A workspace that is not in a Git work tree, or a machine without a supported `git` binary (version 2.30 or later), works exactly as today. Phase 4 features are hidden or disabled there, with the reason.
- The workspace root may be a subdirectory of the repository. Phase 4 features only ever list, compare, restore, stage or commit files inside the workspace root, never other files in the repository.
- External Git operations (a commit, branch switch or pull in a terminal) are picked up like external file edits: the changed files reload through RELI-01..05, and the Git state refreshes without restarting (RELI-14).

**RELI-15** (detailed): Each discovered workspace file (YAML, Markdown and `.layout.yaml`) has a Git state: `unmodified` (matches `HEAD`), `modified`, `added` (staged, not in `HEAD`), `untracked`, `deleted` or `ignored`. Unsaved editor state and drafts stay distinct from these, as RELI-10 requires. The persistence API adds a `git` field next to `persistence.revision` and `persistence.draft`, as ADD-002 anticipated; it is absent outside a Git work tree. The workspace view shows a changed-files count, and each diagram shows whether its YAML or layout file has uncommitted changes. — P1, Phase 4

### Revision comparisons

**GIT-02** (new): File and resource history. For a diagram, entity, flow, document or decision, the user can list the commits that changed its file: short hash, author, date and subject, newest first, at most 200 per request with paging. History follows renames. — P1, Phase 4

**GIT-03** (new): Model at a revision. The server can load the workspace model as it was at any commit, from Git objects only, without checking anything out or changing the working tree. The files go through the same discovery rules, YAML limits (SEC-05, SEC-06), parsing, validation and normalization as the working tree. A revision whose files fail validation still loads, with diagnostics, as an invalid working tree does. The user can open any diagram or document read-only at a revision (DIAG-12 view route with a revision parameter): **Edit layout** is disabled with the reason "Viewing a past revision", and a banner names the revision and links back to the current version. — P1, Phase 4

### Semantic diffs

**GIT-04** (new): Semantic diff. The user can compare two model states, where each side is a commit, `HEAD` or the working tree (saved files). The diff is computed from the normalized models, not from text, and reports by stable ID: — P1, Phase 4

- Entities, relationships, diagrams, flows, documents and decisions that were added, removed or changed. For changed resources it lists the changed fields with their old and new values. For Markdown bodies it shows a line-level text diff.
- Moves of a resource between files (for example from an `Entity` file into an `EntitySet`) are reported as "moved", not as a removal plus an addition.
- Layout changes are summarized per diagram ("6 nodes moved, 2 edges restyled, settings changed"), not listed as coordinates.
- Diagnostics that appear or disappear between the two sides (for example a new broken reference).
- The diff is shown in the app and is also available as Markdown from the server and the command line (GIT-10), so it can be pasted into a pull request.

**GIT-05** (new): Visual diagram diff. On a diagram's view route, the user can compare it with another revision. Added nodes and edges are highlighted, removed ones are drawn as ghosts at their old positions, changed ones are marked, and nodes that only moved are optionally drawn with their old outline. Like the flow overlay (DIAG-15), the comparison is view state only: it is not saved and changes no file. — P2, Phase 4

### Recovery

**GIT-06** (new): Restore from a revision. The user can restore one workspace file, or the file that holds a chosen resource, to its content at an earlier commit, including a file that has since been deleted. — P1, Phase 4

- Before restoring, the app shows the semantic diff (GIT-04) between the current file and the version to be restored, and needs an explicit confirmation.
- The restored content is the exact bytes from Git, so the file isn't reformatted. It is validated against the current workspace before writing (RELI-09); a restore that would add errors is refused with the diagnostics, unless the user confirms again after seeing them.
- The write uses the existing atomic write, conflict detection and failure handling (RELI-06..08, RELI-12). If the file changed after the preview was shown, the restore is refused as a conflict.
- Restoring only writes the working tree. It never changes the index, history or branches (no reset, checkout or revert commit). The user commits the result like any other change (GIT-08).
- This is the first feature that writes canonical YAML or Markdown. It is limited to whole-file restores of earlier committed content; editing canonical files remains out of scope (SCOPE-01).

### Branches and commits

**GIT-07** (new): Branches. The app shows the current branch. The user can create a branch from `HEAD` and switch to an existing local branch. — P1, Phase 4

- Creating or switching is refused, with the reason, when the workspace has uncommitted changes, unsaved editor changes or drafts, when a Git operation is in progress, or when files outside the workspace root have uncommitted changes that a switch would affect.
- New branch names are checked with Git's own ref-name rules before use.
- After a switch, the workspace reloads (RELI-14). Deleting, renaming, merging and rebasing branches are out of scope.

**GIT-08** (new): Commits. The user can commit changed workspace files from the app. — P1, Phase 4

- The commit screen lists the changed workspace files (RELI-15) with the semantic diff for each, and the user picks which files to include and writes a message (subject required).
- The commit includes exactly the chosen files at their saved content, and nothing else that is staged in the repository is committed or unstaged.
- It uses the repository's configured author identity. If none is configured, the commit is refused with instructions; the app never sets Git configuration.
- Repository hooks run as they do for a commit from a terminal. A hook failure is reported with its output and leaves the working tree unchanged.
- Unsaved editor changes and drafts are not committed. The commit screen warns when the user has any.

**GIT-09** (new): Push and pull requests (GitHub only). — P2, Phase 4

- The user can push the current branch to its upstream, or to `origin` with upstream tracking set, using the credentials Git already has (credential helper or SSH agent). The app never asks for, stores or logs credentials, and runs Git with terminal prompts disabled, so missing credentials fail with an explanation instead of hanging.
- When `origin` is a GitHub repository, after a push the app offers **Open pull request**, which opens GitHub's compare page for the branch in the browser, pre-filled with the commit subject as title and the semantic diff (GIT-04) as body. No GitHub token or API call is involved.
- Force pushes, pulls, fetches and conflict resolution are out of scope. The user does them with Git directly; the app picks up the result (GIT-01).

### Validation workflows

**GIT-10** (new): Headless validation and diff. A command-line entry point runs the same domain code as the server, without starting it: — P1, Phase 4

- `archidoc validate [root…]` loads each workspace and reports diagnostics. It exits non-zero when there are errors, or when there are warnings with `--strict`. Output formats: human-readable (default), JSON, and GitHub Actions annotations (`::error file=…,line=…::message`) so diagnostics appear on the pull request's changed lines.
- `archidoc diff <base> [head]` prints the semantic diff (GIT-04) between two commits, or between a commit and the working tree, as Markdown or JSON.
- The repository documents an example GitHub Actions workflow that runs `validate` on pull requests and posts the `diff` Markdown as a job summary. The app doesn't install it in users' repositories.

### Reliability and security

**RELI-16** (new): Git failures are deterministic and safe. A Git command that fails, times out (default 30 s, 120 s for push and hooks), finds a lock file, or meets a merge or rebase in progress produces a clear error that names the cause, and leaves the working tree and index as they were. State-changing Git operations (GIT-06..09) are serialized per repository. — P1, Phase 4

**SEC-14** (new): Git access is confined. — P1, Phase 4

- Git runs only inside server-side repository services (SEC-09), as `git` with an argument list (never through a shell) and a fixed set of subcommands. Revisions from requests must be full or abbreviated hexadecimal hashes or names that already exist, checked by `git rev-parse --verify` with `--end-of-options`. Paths are passed as literal pathspecs and must resolve inside a workspace root (SEC-02..04).
- Output read from Git is size-limited, and file content read from history goes through the same YAML and Markdown limits as the working tree (SEC-05, SEC-06).
- Git runs with terminal prompts and pagers disabled, and without honouring environment overrides that would point it at another repository or work tree.
- `.git` is never served, discovered or exposed through the API; only the results of the allowed commands are.
- State-changing Git operations need the request-origin checks of SEC-07, and are refused in hosted read-only mode (SEC-13) with the read-only reason. In hosted mode, history and comparisons (GIT-02..05) are available only if the deployment contains Git history. Otherwise they are disabled with the reason.

### Testing and performance

**TEST-10** (new): Phase 4 test categories:

- Repository detection: no repository, workspace root in a subdirectory, detached `HEAD`, operations in progress, missing or old `git`.
- File states (RELI-15), including renames, deletions, ignored files and files outside the workspace root.
- Model at a revision: determinism, invalid historical files, limits applied to blobs, no change to the working tree or index.
- Semantic diff: every resource kind, moves between files, layout summaries, diagnostics appearing and disappearing, and the same result whatever the file order.
- Restore: preview, conflicts, refusal on new errors, exact bytes, deleted files.
- Commits and branches: only the chosen files, staged changes elsewhere left alone, missing identity, failing hooks, refusals on dirty trees, invalid ref names.
- Security: command and option injection through revisions, branch names and paths; pathspec confinement; output limits; read-only mode.
- `archidoc validate` and `archidoc diff`: exit codes and every output format.

Integration tests use temporary repositories created by the test, never the project's own repository.

New Playwright workflows:

- **E2E-12:** Change a layout and an entity file, see both in the changed-files list with their semantic diff, commit only the layout, and see its state become unmodified.
- **E2E-13:** Open a diagram's history, view it at an older revision with the visual diff, and restore the older layout after the preview.
- **E2E-14:** Create a branch, commit on it, and see the branch switch refused while a draft exists.

New visual regression snapshots: **VR-15** semantic diff view, **VR-16** diagram visual diff with added, removed and changed elements.

**BENCH-09** (new): Load the model at a past revision and compute its semantic diff with the working tree, for 1,000 entities and 2,000 relationships, in under 2 s on the reference machine (PERF-05).

### Sample workspace

The repository's own history serves as the Phase 4 example for manual checks. Automated tests build their own repositories (TEST-10). The example GitHub Actions workflow (GIT-10) is documented and also runs on this repository against the sample workspace.

### Phase 4 exit criterion

**PH4-EXIT** (new): A user can see what changed in the architecture model between any two revisions as a semantic and visual diff, restore earlier versions safely, commit chosen changes on a branch and open a pull request for them, and check every pull request automatically with the same validation the app uses, without the app rewriting history or touching files outside the workspace.

The outline items in checklist 09 map to these requirements: PH4-01 → GIT-02, GIT-03; PH4-02 → GIT-04, GIT-05; PH4-03 → GIT-06; PH4-04 → GIT-01, GIT-07, GIT-08, RELI-15; PH4-05 → GIT-09; PH4-06 → GIT-10.

### Out of scope for Phase 4

- Merging, rebasing, cherry-picking, resolving conflicts, resetting, reverting commits, stashing, force pushing, pulling and fetching (§13, "Advanced Git merge management"). The user does these with Git; the app reloads afterwards.
- Hosting providers other than GitHub (§13), and any GitHub API use: no tokens, no PR status, reviews or comments in the app.
- Committing or pushing from a hosted deployment (needs authentication, Phase 5).
- Editing canonical YAML or Markdown beyond whole-file restores (SCOPE-01).
- Installing or changing Git hooks, Git configuration or CI workflows in users' repositories.

## Open questions

Each has the default this addendum assumes.

1. **How the app talks to Git.** Default: the user's `git` binary (2.30+), run with argument lists. It behaves exactly like the user's own Git (configuration, credentials, hooks, LFS), at the cost of requiring Git to be installed. The alternative is a JavaScript implementation (isomorphic-git), which needs no binary but differs from Git in edge cases, doesn't run hooks and needs its own credential handling.
2. **Writing canonical files on restore.** Default: GIT-06 may restore any workspace file, including canonical YAML and Markdown, as exact bytes after a diff preview. Stricter alternative: restore only `.layout.yaml` files, and leave canonical files to `git restore` in a terminal.
3. **Repository hooks.** Default: hooks run on commits from the app, as on the command line. The alternative is to skip them (`--no-verify`), which is faster and runs no repository code but bypasses checks the team relies on.
4. **Pull request integration.** Default: open GitHub's compare page in the browser, pre-filled. No token or API. The alternative is to create PRs and show their checks through the GitHub API, which needs a token stored and protected by the app (SEC-08) and would be the app's first outbound network call.
5. **Branch switching.** Default: create and switch branches from the app, only when the workspace is clean. The alternative is to show the branch read-only and leave all branch operations to Git.
6. **Validation CLI packaging.** Default: a `bin` entry in this package (`pnpm archidoc …`, `npx archidoc …`) that reuses the domain code. The alternative is a separate published package or a GitHub Action, which is easier to use in other repositories but adds a release process.
7. **Priorities.** Default: everything P1 except the visual diagram diff (GIT-05) and push and pull requests (GIT-09), which are P2. Phase 4 can exit without a P2 item only if a later addendum defers it.

## Consequences

- **Schema and model:** no change. No new kinds, fields or `apiVersion`. Workspaces load exactly as before.
- **Architecture:** a new server-side Git service beside the filesystem repository, with the same confinement rules. The loader must accept a second file source (Git objects at a revision) besides the working tree, so discovery, parsing and validation are reused rather than duplicated.
- **Writes:** restores are the app's first writes to canonical files. They reuse the layout writer's atomic write and conflict checks.
- **Hosted mode:** unchanged for writes (SEC-13 refuses them). History needs the Git directory in the deployment, which Vercel builds don't include by default, so it is usually disabled there.
- **Testing:** integration tests need `git` on the CI runners (GitHub-hosted runners have it) and must create throwaway repositories.
- **Risks:** Git edge cases (submodules, sparse checkouts, LFS pointers, very large histories) are the most likely source of bugs. Submodules and sparse checkouts aren't supported in Phase 4: files in them are treated as outside the workspace and reported as such. Command injection through revisions, ref names and paths is the main security risk, so SEC-14 and TEST-10 cover it explicitly.

## Checklist updates

To do on acceptance (Product Analyst, in a follow-up PR):

- [ ] In `09-later-phases.md`, detail RELI-15, add GIT-01..10, RELI-16, SEC-14 and PH4-EXIT "(added by ADD-012)", and point PH4-01..06 at the new items
- [ ] Add TEST-10, E2E-12..14 and VR-15..16 to `06-testing.md`, and BENCH-09 to `07-performance.md`
- [ ] Record the new IDs in the allocated-IDs table in `addenda/README.md` as allocated (they are reserved while this is Proposed)
- [ ] Run `scripts/prd-progress.sh --write`
