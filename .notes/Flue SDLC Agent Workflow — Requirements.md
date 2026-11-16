# Flue SDLC Agent Workflow — Requirements

Nov 15, 2026 · @Logan

## 1. Summary

Build a self-running SDLC loop on **Flue** (TypeScript agent framework from the Astro team) where a **PM agent** owns a GitHub Projects backlog, dispatches **Dev agents** that implement issues and open PRs, and dispatches a **Reviewer/QA agent** that verifies each PR against the issue's acceptance criteria. The PM picks the model tier for every unit of work. A human makes the final merge.

**Decisions so far**

| Topic           | Decision                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Runtime         | Hosted Flue server on Cloudflare (Workers + Durable Objects) receiving GitHub webhooks                        |
| Models          | Anthropic only for now (Haiku / Sonnet / Opus), mapped to 3 tiers in one config file                          |
| Human gates     | Agents create issues, code and review; **a human approves and merges**                                        |
| Target codebase | One greenfield TypeScript/Node repo on a personal GitHub account; Slack for intake, notifications and control |
| Commits         | Conventional Commits, enforced by tooling, squash-merge on PR title                                           |
| Tests           | Vitest (unit) + Playwright (e2e), required CI checks                                                          |

Items marked **\[verify\]** depend on Flue behaviour not confirmed in the docs and should be spiked first.

## 1A. Target project: Archidocs

The agents build **Archidocs**, defined in [Archidocs — Requirements](https://claude.ai/artifact/MwGi9XbYeV5fvxmbPd5ZMZ): an npm package (`archidocs`) whose CLI (`init`, `validate`, `dev`, `build`) turns a repo of FINOS CALM architecture files into a read-only static site. Stack from its Decisions table: Vite + React SPA, TanStack Router, shadcn/ui + Tailwind + React Flow, elkjs at build time only, a bundled Node CLI. First release = R1–R19 in four slices.

### How the workflow adapts to it

- **ARC-1 Source of truth.** The requirements doc is canonical. The PM seeds the backlog from it: one epic per build slice, one issue per requirement (R15 split into `init`/`validate` and `dev`/`build`). Each requirement's **Check** column becomes the issue's acceptance criteria, and the issue cites the Job it serves.
- **ARC-2 Slice gate.** The PM won't start slice N+1 until you confirm slice N works on the reference model (`@pm slice 1 done`). This is the doc's “thin slices” principle; within a slice the normal loop runs.
- **ARC-3 No job, no issue.** Every new issue cites J1–J14 or a named user request, otherwise the PM pushes back.
- **ARC-4 Non-goals enforced.** The PM flags requests that hit a non-goal (browser editing, server-side state, built-in sign-in…); the Reviewer flags scope creep against them and against “read-only” and “static first”.
- **ARC-5 Decisions as ADRs.** Phase 0 writes one ADR in `docs/adr` per row of the Decisions table. A PR that adds a dependency or a technology choice must add an ADR; the Reviewer checks.
- **ARC-6 Code explains itself.** Comments and test names describe behaviour and never mention issue numbers or requirement ids. Traceability lives in the PR body's AC → test table (§8 TS-3).
- **ARC-7 Design in the repo.** Agents can't open the claude.ai prototype from a sandbox, so Phase 0 exports it to `docs/design/` (screenshots, colour/type/spacing tokens, Geist fonts) along with the Doorway-tile logo assets. Viewer issues link these; “match the design, not the pixels”.
- **ARC-8 No deployment, no paid service.** Every check runs from a clean checkout in GitHub Actions. E2E runs against `build` output behind a plain static file server.

### Requirement checks → tests

| Area               | Requirements     | Tests                                                                                                                         |
| ------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| CLI and validation | R1, R2, R16, R18 | Vitest fixture tests: each invalid fixture gives the expected report and exit code; one fixture per health rule               |
| Layout             | R4, R19          | Snapshot of elk output; a geometry test over every fixture view (overlaps, containment, edges through nodes, label placement) |
| Viewer logic       | R6–R13           | Vitest units (owner inheritance, target-view rule, ordering, search matching, ADR parser, URL state, git diff)                |
| Viewer behaviour   | R3, R6–R13       | Playwright against the built folder                                                                                           |
| Accessibility      | R14              | axe scan in Playwright on every page type, plus a contrast check, from slice 2 on                                             |
| Packaging          | R15              | Pack test: `npm pack`, install into an empty temp folder, `init` → `build`, serve, load                                       |
| Hosting            | R17              | Playwright runs twice: at `/` and under a sub-path                                                                            |
| History            | R12              | CI checks out with full history; fixtures use a scripted git repo; a shallow clone must fail loudly                           |

### Starting tiers (PM re-scores with the rubric)

| Tier     | Requirements                                                   | Why                                                                                     |
| -------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Fast     | R8, R9, R16                                                    | Small, well specified; R16's schema is already written                                  |
| Standard | R1, R2, R3, R5, R6, R7, R10, R11, R13, R14, R15 (×2), R17, R18 | Typical feature work with clear checks                                                  |
| Frontier | R4, R12, R19                                                   | Layout pipeline, git-history diffing, geometry rules: hard to get right, costly to redo |

Rough cost with the §10A estimates: about $65 for the first release before rework, so roughly **4–6 working days of the $20 budget**, spread across the slice gates.

**Phase 0 scaffold** (package layout, CLI + prebuilt-viewer bundling, CI) is done by you with Claude Code, using the prompt in Appendix A.

### Reference model repo (`archidocs-reference`)

The agents build the reference model too, in its own public repo, as the requirements doc's “reference model first” principle asks.

- **REF-1** A realistic, fictional bank modelled in FINOS CALM, at about the size of “Big Bank plc”: a handful of people and external systems, \~4 software systems, \~10 containers, components inside 1–2 containers, owners on elements, and 5–8 decision records in `docs/adr`.
- **REF-2** Built in small PRs (one system or one decision per PR) so the repo gets a realistic git history; R12 and J6 need that history to demo anything.
- **REF-3** Same Project board, same three GitHub Apps, same Slack threads. The reconciler polls both repos; every issue's repo is explicit.
- **REF-4** CI validates every file with the FINOS CALM CLI from day one **\[verify package and command\]**. After slice 1 it also runs `archidocs validate`; after slice 2 it builds the site and publishes it to GitHub Pages (free and static, which meets success criterion 1).
- **REF-5** Modelling issues start on Standard. The Reviewer checks CALM validity and that the model tells a coherent story: plausible relationships, owners and decisions.
- **REF-6** The reference-model epic runs alongside slice 1, so each slice gate has a real model to try. Rough cost: 8–12 Standard issues, about $25–35.

## 2. Flue primer (what this design relies on)

Current line is Flue 2.x (`@flue/runtime`, `@flue/cli`). Core model: _Agent = Model + Harness_, built on the Pi harness, Vite build, Durable Streams for the event log.

- **Agents** — a module starting with `'use agent'` exporting a function. Hooks inside set behaviour; the return value is the system prompt. Agents are durable, stateful and addressable at `POST /agents/<name>/<id>`.
- **Hooks used here** — `useModel(id)`, `useSandbox(...)`, `useTool(...)` / `defineTool(...)`, `useSubagent(...)` / `defineSubagent(...)`, `usePersistentState(key, default)`, `useAgentStart(cb)`.
- **Models** — provider-prefixed ids, e.g. `anthropic/claude-sonnet-4-6`, `moonshot/kimi-k2`. Any provider.
- **Subagents** — the parent's model calls a built-in `task` tool. A subagent can set its own `model` and `thinkingLevel`, **but the model is fixed when mounted, not chosen per call.** Child sees no parent history; only its final message returns. Max 4 levels deep. Shares the parent's sandbox.
- **Tools** — `defineTool({ name, description, input, run })` with Valibot schemas. `harness: true` gives the tool `harness.prompt(..., { result: schema })` for typed sub-prompts. `durable: true` + `step.do(...)` for side effects that must complete exactly once.
- **Sandboxes** — one per agent: `bash()` (in-memory, no real processes — not suitable for git/npm/Playwright), `local()` (host shell, Node only, env must be passed explicitly), or remote adapters (Daytona, E2B, Modal, Cloudflare Sandbox). A remote factory keyed on instance id gives a durable per-issue workspace.
- **Skills** — Markdown know-how in `.agents/skills/<name>/SKILL.md`, shareable with interactive coding agents.
- **GitHub channel** — `flue add channel github`; verifies signed webhooks (`GITHUB_WEBHOOK_SECRET`), maps each issue/PR to one agent instance via `channel.instanceId(...)`. **Out of the box it only handles `issue_comment` and `pull_request_review_comment` (created)** — we must extend it. GitHub needs a 2xx within 10 s and the channel doesn't dedupe deliveries.
- **Durability** — every session is an append-only stream; interrupted sessions resume. Needs a DB (`flue add database postgres`).
- **Observability** — OpenTelemetry, Braintrust, Sentry integrations via `flue add tooling ...`.
- **Maturity** — young and fast-moving (1.0 beta June 2026, 2.x since). Pin versions; expect breaking changes.

## 3. System architecture

```
You ── Slack (@pm mentions, threads, /agents) ──┐
                                               ▼
Flue on Cloudflare Workers ── Durable Objects (sessions) + D1 (work_items, budgets, meters)
   ├─ PM agent        id: pm:<repo>          orchestrator, GitHub tools only
   ├─ Dev agent       id: dev:<issue#>       Cloudflare Sandbox per issue
   ├─ Reviewer agent  id: review:<pr#>:<n>   fresh Cloudflare Sandbox per review
   └─ Reconciler      Cron Trigger, plain code: polls GitHub, diffs vs D1, signals PM
                                               │ Octokit (3 GitHub Apps, ETag-cached reads)
                                               ▼
                         GitHub (issues, PRs, checks, Project v2) — no inbound webhooks in v1
```

**Requirements**

- **A-1** Flue Cloudflare target: each agent instance is a Durable Object; one Cloudflare account and one bill for compute, state and sandboxes.
- **A-2** Durable Object SQLite for Flue sessions; D1 for app tables: `work_items` (issue → status, tier, attempts, cost, last-seen GitHub state), `budgets`, `infra_meters`, `slack_events` (dedupe).
- **A-3 Three kinds of trigger, no GitHub webhooks in v1:**
  - **Human → agents:** Slack only (`@pm` mentions, replies in an issue's thread, `/agents`). The only path from a person to an agent.
  - **Agent → agent:** internal. Dev and Reviewer results return to the PM through Flue dispatch/signals, never by watching GitHub.
  - **GitHub → system:** a **reconciler** (plain code, no model) on a Cron Trigger every 2 min while work is in flight, every 10 min when idle. It reads Project items, open PRs, check runs, reviews and merges, diffs them against `work_items`, and sends the PM a signal only when something changed (CI finished, you merged, you left a PR comment, a card moved).
- **A-4** The reconciler is level-based: it compares current state to stored state, so a missed or repeated poll is harmless and there's no ordering, dedupe or 10-second-ack problem. Reads use conditional requests (ETag) to stay far inside GitHub's API limits.
- **A-5** PM, Dev and Reviewer are **separate top-level agents**, not subagents, so each can run long, have its own sandbox and be resumed independently. The PM starts them via a `dispatch_agent` tool.
- **A-6** Dev and Reviewer use **Cloudflare Sandbox**, built from our own image with Node 22, git, gh and Playwright Chromium baked in (see Sandbox image below). Sandbox disk is ephemeral, so Dev pushes WIP commits to its branch as its checkpoint and a fresh sandbox re-clones from there; Reviewer always starts fresh. Sandbox lifetime is capped (§10B).
- **A-7 Optional later:** one GitHub webhook (e.g. `check_suite` completed) used purely as a _poke_ that runs the reconciler immediately. Its payload is ignored, so it adds speed without adding edge cases.

### Sandbox image (Playwright in Cloudflare Sandbox)

**Finding:** Cloudflare's docs don't show Playwright in Sandbox, but nothing blocks it. Sandbox images are Ubuntu 22.04 with apt available, can be extended with a Dockerfile, and Playwright's `--with-deps` install supports Ubuntu 22.04. Instances go up to 4 vCPU / 12 GiB / 20 GB. A short spike confirms it before agents are built.

```dockerfile
# sandbox/Dockerfile — pin the base to the current release [verify tag]
FROM docker.io/cloudflare/sandbox:0.7.0

# Node 22 (base ships Node 20), git, GitHub CLI
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y nodejs git gh \
 && rm -rf /var/lib/apt/lists/*

# Chromium + system libs, baked in so runs never download browsers.
# Pin to the exact @playwright/test version in the archidocs repo.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
RUN npx -y playwright@1.x.y install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*
```

- **SB-1 Instance:** `standard-2` (1 vCPU, 6 GiB, 12 GB) to start. Chromium, a Vite build and Vitest fit comfortably; move to `standard-3` only if e2e is slow.
- **SB-2 Version lock:** the Playwright version in the image must match the repo's `@playwright/test`. A Renovate/Dependabot bump of one without the other fails the spike test below, so the image is rebuilt in the same PR.
- **SB-3 Ephemeral disk:** a sandbox that sleeps comes back with a fresh disk. Dev commits and pushes WIP to its branch at each milestone; a resumed run re-clones and runs `npm ci` (browsers are already in the image).
- **SB-4 Network:** outbound allowlist = GitHub, the npm registry, NodeSource and Ubuntu apt (build time only). The site under test is served from inside the sandbox, so e2e needs no outside access.
- **SB-5 Cost:** at the `standard-2` size a 45-minute Dev run is roughly a dime of compute, well inside the $3/day infra ceiling (§10B). The meter in §10B tracks actual seconds.

**Spike (Phase 1, \~1 hour):** deploy the image with one Worker, start a sandbox, clone `archidocs`, run `npm ci && npm run build && npm run test:e2e && npm run test:pack`, and record wall time, peak memory and the Playwright report. Pass = all green on `standard-2` in under 10 minutes. If it fails, the fallback is Daytona or E2B behind the same Flue sandbox interface.

## 4. Agent roles

### 4.1 PM agent (orchestrator)

One long-lived instance per repo (`pm:<owner>/<repo>`). Default tier: Standard. No code sandbox.

- **PM-1 Intake** — turns human requests (Slack message, `/pm` issue comment, or a linked PRD) into issues using the issue form. Every issue has: user story, numbered acceptance criteria (`AC-1`, `AC-2`… in Given/When/Then), test plan (unit vs e2e per AC), out-of-scope list, dependencies.
- **PM-2 Decomposition** — splits anything larger than size L into child issues (GitHub sub-issues) that can each land in one PR.
- **PM-3 Grooming** — sets Project fields: Status, Type, Size, Priority, **Tier**, and writes a one-line **tier rationale** in the issue.
- **PM-4 Scheduling** — picks the next `Ready` issue by priority and dependency order, respects the WIP limit, and dispatches a Dev agent with the chosen tier.
- **PM-5 Review routing** — when a PR is marked ready and CI is green, dispatches the Reviewer with its tier.
- **PM-6 Loop control** — on `REQUEST_CHANGES` re-dispatches Dev with the review findings; applies escalation rules (§6); moves stuck items to `Blocked` and pings a human.
- **PM-7 Reporting** — daily digest (Slack or a pinned issue): done, in flight, blocked, spend per issue.
- **PM-8 Limits** — PM may create/edit issues and Project items and comment; it may **not** push code, approve PRs or merge.

**PM tools:** `create_issue`, `update_issue`, `create_sub_issue`, `set_project_fields`, `list_backlog`, `dispatch_agent({ role, tier, issue, context })`, `escalate_tier`, `comment`, `notify_human`, `get_budget`.

### 4.2 Dev agent

One instance per issue (`dev:<issue#>`), model set from the tier the PM chose.

- **DEV-1** Clone repo into its sandbox, branch `<type>/<issue#>-<slug>` from `main`.
- **DEV-2** Read `AGENTS.md`, the issue and its ACs before writing code. If ACs are ambiguous, comment a question and return `status: needs_clarification` instead of guessing.
- **DEV-3** Implement the smallest change that satisfies the ACs; no unrelated refactors.
- **DEV-4** Write/extend tests so **every AC maps to at least one test**, listed in the PR body's AC → test table. Test names describe behaviour, not ticket ids.
- **DEV-5** Run `lint`, `typecheck`, `test:unit`, and `test:e2e` (for UI/API ACs) locally in the sandbox before pushing.
- **DEV-6** Commit with Conventional Commits; commitlint must pass locally.
- **DEV-7** Open a PR using the template: conventional title, `Closes #<n>`, AC → test table, notes on risk. Open as draft, flip to ready only when local checks pass.
- **DEV-8** If CI fails, read logs and fix; max 3 CI-fix attempts before returning `status: stuck`.
- **DEV-9** Never edit `.github/`, branch protection, lint config, or delete/skip existing tests unless the issue says so.
- **DEV-10** Returns a typed result: `{ status, prUrl, testsAdded, acCoverage, notes, tokensUsed }`.

Optional subagents (same sandbox, cheaper model): `test_writer`, `ci_log_reader`.

### 4.3 Reviewer / QA agent

One instance per review round (`review:<pr#>:<round>`), separate GitHub App identity, fresh sandbox, read-only contents.

- **QA-1** Load the issue ACs, PR diff, PR description and CI results.
- **QA-2** **AC verification matrix**: for each AC — test exists? test asserts the behaviour (not a tautology)? passes? Post as a table in the review.
- **QA-3** Re-run unit + e2e in its own sandbox; flag flakiness separately from failures.
- **QA-4** Code review: correctness, edge cases, error handling, security (injection, secrets, authz), performance, consistency with repo conventions, scope creep beyond the issue.
- **QA-5** Conventions: PR title and commits are Conventional, branch name, `Closes #n`, no `.only`/`.skip`, no lowered coverage thresholds, no edits to protected paths.
- **QA-6** Submits a real GitHub review: `APPROVE` or `REQUEST_CHANGES` with line comments; blocking vs non-blocking findings labelled.
- **QA-7** Returns `{ verdict, blocking[], nonBlocking[], acMatrix, flaky[] }` to the PM.
- **QA-8** Cannot push commits or merge.

## 5. Workflow and state machine

The GitHub Project **Status** field is the single source of truth; agents move cards, humans can override any time.

| Status            | Entered when                     | Owner    | Exit                                                  |
| ----------------- | -------------------------------- | -------- | ----------------------------------------------------- |
| Inbox             | Human request or new issue       | PM       | PM grooms → Backlog or asks questions                 |
| Backlog           | Groomed, has ACs + tier          | PM       | Prioritised and deps met → Ready                      |
| Ready             | Next up                          | PM       | PM dispatches Dev → In Progress                       |
| In Progress       | Dev working                      | Dev      | PR ready + CI green → In Review                       |
| In Review         | Reviewer dispatched              | Reviewer | Approve → Awaiting Human; changes → Changes Requested |
| Changes Requested | Review blocking findings         | PM → Dev | Dev pushes fixes → In Review                          |
| Awaiting Human    | Agent approved + CI green        | Human    | Human merges → Done; or comments → Changes Requested  |
| Blocked           | Clarification, stuck, budget hit | Human    | Human answers → PM resumes                            |
| Done              | PR merged, issue closed          | —        | —                                                     |

**Happy path:** request → PM writes issue (Inbox→Backlog→Ready) → PM dispatches Dev at tier T → Dev opens PR → CI green → PM dispatches Reviewer → APPROVE → human merges → issue auto-closes.

**Rules**

- **WF-1** WIP limit (default 3 concurrent Dev agents); PM won't dispatch past it.
- **WF-2** Human comment on a PR after agent approval is treated as a blocking review and routed back through the PM.
- **WF-3** Every transition is written as an issue comment by the acting agent (audit trail).
- **WF-4** A `needs-human` or `agent:stop` label pauses all agent activity on that item.

## 6. Model tier policy

### 6.1 Tiers (multi-provider, one config file)

```ts
// src/config/tiers.ts — Anthropic only for now; confirm exact Flue model strings [verify]
export const TIERS = {
  fast: {
    model: "anthropic/claude-haiku-5-5",
    fallback: "anthropic/claude-haiku-4-5",
    maxUsdPerRun: 0.5,
  },
  standard: {
    model: "anthropic/claude-sonnet-5-5",
    fallback: "anthropic/claude-sonnet-4-6",
    maxUsdPerRun: 2.5,
  },
  frontier: {
    model: "anthropic/claude-opus-5-5",
    fallback: "anthropic/claude-opus-4-7",
    maxUsdPerRun: 6.0,
  },
} as const;

// src/config/budget.ts
export const BUDGET = {
  dailyUsd: 20, // hard cap, resets 00:00 America/Chicago
  pmOverheadUsd: 2, // PM grooming, scheduling, digest
  finishReserveUsd: 3, // only for rework/review on in-flight items
  perIssueCapUsd: 8, // 40% of daily; above this the PM splits the issue or asks a human
  admissionMargin: 1.3, // dispatch only if remaining >= estimate x margin
} as const;
```

- **T-1** Tiers are abstract names; swapping a provider is a config change, not a prompt change.
- **T-2** Each tier falls back to the previous-generation Anthropic model on rate limits or model-specific errors. A full Anthropic outage pauses dispatching and posts to Slack. Adding another provider later is a config change.

### 6.2 How the PM chooses

The PM scores each issue and records the score and rationale on the issue:

| Factor                        | 0         | 1                 | 2                    |
| ----------------------------- | --------- | ----------------- | -------------------- |
| Files/modules touched         | 1 file    | 1 module          | cross-module         |
| New dependency or API surface | none      | internal          | public API / new dep |
| Data / schema / migration     | none      | read-only         | migration            |
| Security / auth / payments    | none      | adjacent          | direct               |
| Ambiguity of ACs              | crisp     | some judgement    | design needed        |
| Test difficulty               | unit only | unit + simple e2e | complex e2e / mocks  |

**0–3 → Fast** (docs, copy, config, small bug) · **4–7 → Standard** (typical feature/bugfix) · **8+ or any factor = 2 on security/migration → Frontier**.

- **T-3 Reviewer tier** = max(Standard, Dev tier). Reviewer is never cheaper than the author.
- **T-4 Escalation**: Dev returns `stuck`, or 2 review rounds fail at the same tier → PM bumps one tier and records why. A failure at Frontier → Blocked + human.
- **T-5 De-escalation**: PM may drop subagents (test writer, log reader) to Fast regardless of parent tier.
- **T-6** PM itself runs on Standard; grooming of epics/decomposition may use Frontier.
- **T-7** Tier, attempts and spend are written to Project fields so the rubric can be tuned from real data.

### 6.3 Implementing tier choice in Flue **\[verify\]**

Flue fixes a subagent's model at mount time, so the PM can't pass a model per `task` call. Two options:

1. **Preferred:** single `Dev` agent; the PM's `dispatch_agent` passes `tier` in the instance's `initialData`, and the agent calls `useModel(TIERS[tier].model)` from it. Needs confirmation that initial data is readable inside hooks.
2. **Fallback:** a factory registers three agents (`DevFast`, `DevStandard`, `DevFrontier`, same for Reviewer) and the PM dispatches the one matching the tier.

## 7. Conventional commits and branching

- **CC-1** Format: `type(scope)!: subject` with types `feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert`. Breaking changes use `!` and a `BREAKING CHANGE:` footer.
- **CC-2** Enforced three ways: husky `commit-msg` hook + `@commitlint/config-conventional` (local and in the Dev sandbox), a CI commitlint job over the PR range, and a PR-title check (e.g. `amannn/action-semantic-pull-request`).
- **CC-3** **Squash merge only**; the squash commit uses the PR title, so `main` history is clean Conventional Commits even if branch commits are messy.
- **CC-4** Issue Type field maps to commit type (Feature → `feat`, Bug → `fix`, etc.); the PM sets it, the Dev must use it.
- **CC-5** Scope = top-level module/package name; allowed scopes listed in `commitlint.config.ts`.
- **CC-6** Branch name `<type>/<issue#>-<kebab-slug>`; PR body contains `Closes #<issue#>`.
- **CC-7** Optional: `release-please` generates CHANGELOG and semver tags from `main`.
- **CC-8** A shared `conventional-commits` skill (`.agents/skills/`) teaches agents the rules and examples, so interactive coding agents use the same guidance.

## 8. Testing requirements

**Product code (target repo)**

- **TS-1** Unit/integration: **Vitest** with coverage (v8). Thresholds enforced in config; CI fails if global coverage drops, and **diff coverage on changed lines ≥ 80%**.
- **TS-2** E2E: **Playwright**, run against a locally started app in CI (and in agent sandboxes). Required for any AC that describes user-visible UI or API behaviour.
- **TS-3** Traceability: the PR body has an AC → test table naming the test file and test for each AC. Test names describe behaviour (e.g. `reports the file and line of a dangling relationship id`) and never include issue or requirement ids. The Reviewer builds the AC matrix from the table and checks each test really asserts the AC.
- **TS-4** Lint rules ban `.only` and `.skip` (`vitest/no-focused-tests`, Playwright `forbidOnly`).
- **TS-5** Flaky policy: Playwright retries = 2 in CI; a test that passes only on retry is reported as flaky by the Reviewer and gets a follow-up issue from the PM.
- **TS-6** Required CI checks on every PR: `lint`, `typecheck`, `test:unit`, `test:e2e`, `commitlint`, `pr-title`. Playwright report and coverage uploaded as artifacts for the Reviewer.
- **TS-7** Scripts are standardised in `package.json` (`lint`, `typecheck`, `test:unit`, `test:e2e`, `test`) so agents never guess commands; listed in `AGENTS.md`.

**Agents themselves**

- **TS-8** Unit tests for custom tools (GitHub wrappers, tier scoring, state transitions) with mocked Octokit.
- **TS-9** Evals (Braintrust): a golden set of \~20 past issues with known-good outcomes; measure PM tier choice accuracy, Dev pass rate per tier, Reviewer catch rate on seeded bugs. Run on every prompt/skill change.
- **TS-10** A sandbox repo (fork) for end-to-end dry runs before pointing agents at the real repo.

## 9. GitHub setup

**Project (v2) fields**

| Field            | Type          | Values                                                                                          |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| Status           | single select | Inbox, Backlog, Ready, In Progress, In Review, Changes Requested, Awaiting Human, Blocked, Done |
| Type             | single select | Feature, Bug, Chore, Docs, Refactor, Test, Perf                                                 |
| Priority         | single select | P0–P3                                                                                           |
| Size             | single select | XS, S, M, L, XL                                                                                 |
| Tier             | single select | Fast, Standard, Frontier                                                                        |
| Tier score       | number        | 0–12                                                                                            |
| Attempts         | number        | dev + review rounds                                                                             |
| Agent cost (USD) | number        | running total                                                                                   |

**Repo configuration**

- **GH-1** Issue forms: `feature.yml`, `bug.yml`, `chore.yml` with required AC and test-plan fields.
- **GH-2** PR template with AC → test table, risk notes, `Closes #`.
- **GH-3** Ruleset on `main`: PR required, squash only, linear history, required checks (§8 TS-6), **1 human approval from CODEOWNERS**, dismiss stale approvals, no force-push, no bypass for bots.
- **GH-4** CODEOWNERS on `.github/**`, `commitlint.config.*`, test configs, `AGENTS.md` → human only.
- **GH-5** Labels: `agent:in-progress`, `agent:stop`, `needs-human`, `needs-clarification`, `flaky`.

**Identities — three GitHub Apps**

GitHub doesn't let a PR author approve their own PR, so Dev and Reviewer must be different identities. Separate apps also keep permissions least-privilege.

| App             | Permissions                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `flue-pm`       | Issues RW, Projects RW, Pull requests R, Metadata R                          |
| `flue-dev`      | Contents RW, Pull requests RW, Issues R, Checks R                            |
| `flue-reviewer` | Pull requests RW (reviews), Contents R, Checks R, Actions R (logs/artifacts) |

**Events:** no inbound webhooks in v1. The Apps only need API permissions; the reconciler (§3 A-3) reads GitHub state on a schedule.

**Personal-account notes**

- **GH-6** User-owned Projects don't emit webhooks anyway; the reconciler polls the Project via GraphQL along with PRs and checks.
- **GH-7** **Public repo**: branch rulesets, required checks and required CODEOWNERS review are available on the free plan, so “human merges” is enforced. GitHub Actions minutes are free for public repos.
- **GH-8** The three GitHub Apps are created under your account and installed only on the two Archidocs repos (\`archidocs\`, \`archidocs-reference\`).
- **GH-9 Public-repo safety:** anyone can open issues, comment or send PRs. Because agents are only ever started from Slack or by the PM, strangers can't trigger them. The PM treats outside issues as Inbox suggestions (it can draft them, never auto-start them), ignores PRs from forks, and the reconciler only counts PR comments and reviews from allowlisted GitHub users (you). Secrets never go to fork PR workflows.

## 9A. Slack integration

Slack is the PM's front door: you give it work, it reports back, and you control the system from one slash command. Built with Flue's Slack channel (`flue add channel slack`).

### Channels

- **SL-1** `#agents` — intake and conversation with the PM. A message here (or a DM to the bot) becomes an Inbox item; the PM replies in thread with the drafted issue link and any questions.
- **SL-2** `#agents-alerts` — Awaiting Human (with PR link), Blocked, budget 80%/100%, circuit breaker trips, daily digest.

### Slash command: `/agents <subcommand>`

| Command              | What it does         | Details                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/agents start`      | Resume the system    | Clears a `stop`. PM resumes grooming and dispatching from the backlog. Refused while the killswitch is engaged (“use `/agents killswitch off` first”). Optional `start #123` moves an issue to the top of Ready.                                                             |
| `/agents stop`       | Graceful pause       | No new dispatches. Runs in progress finish their current step, checkpoint and park; nothing is lost and `start` picks up where they left off. PM still answers Slack and keeps reporting.                                                                                    |
| `/agents status`     | Live run status      | Running / stopped / killed; each active agent (issue, role, tier, current step, elapsed, spend so far); next 3 Ready items; today's model spend vs $20 and infra vs $3; breaker state.                                                                                       |
| `/agents killswitch` | Emergency hard stop  | Asks for a confirm button. Then within seconds: aborts in-flight model calls, destroys all sandboxes, sets `AGENTS_PAUSED`, halts the cron loop (except budget/infra reporting). Stays off until `/agents killswitch off` plus a second confirm. Posts what was interrupted. |
| `/agents stats`      | Performance and cost | Default last 7 days; `stats today` / `stats 30d`. Issues done, PRs merged, cost per merged PR (incl. rework), review rounds per tier, escalation rate, tier mix, model + infra spend, items deferred for budget.                                                             |

### Requirements

- **SL-3** Verify every request with the Slack signing secret; reject replays older than 5 minutes.
- **SL-4** Only allowlisted Slack user IDs (you, for now) can run `/agents`; everyone else gets a polite refusal. `killswitch` and `killswitch off` always need a confirm click.
- **SL-5** Acknowledge within Slack's 3-second window, then post results via `response_url` or in thread.
- **SL-6** `start`, `stop`, `status`, `killswitch` and `stats` are **plain code: no model calls**, so they cost nothing against the $20 and work even when the budget is exhausted or Anthropic is down.
- **SL-7** The killswitch path has no dependency on the PM agent: it writes the pause flag in D1 and calls sandbox destroy directly, so it works even if an agent is stuck.
- **SL-8** Every command is logged (who, when, result) and echoed to `#agents-alerts`.
- **SL-9** Free-text messages to the PM go through the model and count against PM overhead ($2/day).

### Talking to the agents

- **SL-10** One Slack app, one bot: **`@pm`**. The PM owns tier and budget decisions, so all requests go through it.
- **SL-11** Each issue gets **one Slack thread** in `#agents`. Agents post there under their own name and icon (“PM”, “Dev #12”, “Reviewer #12”) using `chat:write.customize`, so it reads like talking to separate agents.
- **SL-12** Replying in an issue's thread talks to whichever agent is working on it. The PM routes the message: a clarification goes to the running Dev, “make this Frontier” becomes a tier change the PM checks against budget.
- **SL-13** Examples: `@pm add a dark-mode toggle to settings` (new issue), `@pm what's blocking #14?`, `@pm bump #14 to Frontier`, `@pm split #20`.
- **SL-14** Ignore Slack events from bots (including our own) and dedupe on Slack `event_id` so the bot can never trigger itself.

## 10. Guardrails, cost and security

**Security**

- **SEC-1 Trusted triggers only** — agents act on issues/comments from repo collaborators (or items a human moved to Ready). Text from anyone else is never an instruction.
- **SEC-2 Untrusted content** — issue bodies, PR comments, dependency READMEs and CI logs are treated as data in prompts; the system prompt says so explicitly.
- **SEC-3 Scoped credentials** — each agent gets only its own App's short-lived installation token, passed explicitly to its sandbox env. No provider API keys inside sandboxes; model calls happen in the Flue server.
- **SEC-4 Sandbox network allowlist** — npm registry, GitHub, Playwright browser CDN; nothing else by default.
- **SEC-5 Protected paths** — Dev can't change `.github/**` or test/lint config (CODEOWNERS + Reviewer check + ruleset).
- **SEC-6 Secrets scanning** — GitHub secret scanning and push protection on.

**Cost and runaway control**

- **COST-1** **$20/day hard cap** across all agents, plus per-run caps per tier (§6.1) and a per-issue cap of $8. Full rules in §10A.
- **COST-2** The PM only starts work it can afford to finish that day (§10A admission control).
- **COST-3** WIP limit (§5 WF-1) and per-agent timeout (Dev 45 min, Reviewer 20 min).
- **COST-4** Kill switch: `AGENTS_PAUSED=true` env flag and `agent:stop` label.
- **COST-5** Spend per issue written to the Project `Agent cost` field; rework cost is attributed back to the issue that caused it.

**Reliability**

- **REL-1** Webhook dedupe on `deliveryId`; idempotent tools (check before creating a PR/issue/comment).
- **REL-2** GitHub side effects wrapped as durable tool steps so a restart never double-posts.
- **REL-3** Provider fallback per tier; exponential backoff on 429/5xx.
- **REL-4** Cron sweep finds items stuck in a status > N hours and asks the PM to act.

**Observability**

- **OBS-1** OpenTelemetry traces per agent run (issue #, tier, model, tokens, cost, outcome); Sentry for errors; Braintrust for evals and prompt traces.
- **OBS-2** Weekly metrics: lead time, PRs merged without human changes, review rounds per tier, escalation rate, cost per merged PR.

## 10A. Daily budget ($20/day)

**Goal:** get the most _finished, merge-ready_ work out of $20 a day. The measure is **cost per merged PR including rework**, not cost per run. A cheap run that causes a second review round, a revert or a follow-up bug costs more overall.

### Quality floor (budget can never override these)

- **BUD-1** The rubric tier (§6.2) is a **minimum**. The PM never drops an issue to a cheaper tier to save money.
- **BUD-2** Budget never skips or shortens tests, e2e, the AC matrix or the Reviewer step.
- **BUD-3** When money runs short, work is **deferred, not degraded**: the item waits for tomorrow's budget at full quality.

### How the $20 is split

| Bucket         | Amount | Use                                                      |
| -------------- | ------ | -------------------------------------------------------- |
| PM overhead    | $2     | Grooming, scheduling, daily digest                       |
| New work       | $15    | Dev + Reviewer runs for newly started issues             |
| Finish reserve | $3     | Only for rework and re-review on items already in flight |

Unused reserve rolls into new work after 6 pm local time. Nothing carries over to the next day. **The $20 is model (LLM) spend only.** Infrastructure is capped separately in §10B.

### Admission control (don't start what you can't finish)

- **BUD-4** For each Ready issue the PM estimates the full cost: Dev run + Reviewer run + expected rework, using the historical median for that tier and size. Until there is history, it uses defaults (Fast/XS ≈ $0.40, Standard/M ≈ $3, Frontier/L ≈ $7).
- **BUD-5** It dispatches only if _remaining new-work budget ≥ estimate × 1.3_. Half-finished work is waste: a branch nobody can merge still costs a re-read tomorrow.
- **BUD-6** Estimates above the $8 per-issue cap mean the issue is too big: the PM splits it into sub-issues, or marks it `needs-human` if it can't be split.

### Picking what to do with the money

- **BUD-7** Rank Ready issues by _priority weight ÷ estimated cost_ (P0=8, P1=4, P2=2, P3=1), respecting dependencies. P0 always goes first, whatever it costs.
- **BUD-8** In-flight work beats new work: review rounds and fixes on open PRs are funded before anything new starts.
- **BUD-9** When the remaining budget can't cover the cheapest Ready item, the PM stops dispatching and posts the end-of-day digest.

### Spend less without cutting corners

- **EFF-1 No model call where code will do.** Webhook routing, status moves, label changes, dedupe and CI-status checks are plain TypeScript. Only judgement goes to a model.
- **EFF-2 Free checks first.** Dev runs lint, typecheck and unit tests in the sandbox before pushing. The Reviewer is dispatched only after CI is fully green, so model money is never spent reviewing broken code.
- **EFF-3 Prompt caching.** System prompts, skills and `AGENTS.md` are stable and placed first so provider caches hit. Cached input is a fraction of normal price on major providers **\[verify Flue passes cache hints through\]**.
- **EFF-4 Tight context.** Dev gets the issue, `AGENTS.md` and the files it searches for, not the whole repo. Reviewer gets the diff, the ACs and CI output, and reads more only where needed.
- **EFF-5 Cheap helpers for mechanical work.** CI log triage and summarisation run as Fast-tier subagents; the reasoning stays on the issue's tier.
- **EFF-6 Spend upstream to save downstream.** Clear ACs and small issues are the biggest saver, because vague issues cause rework. The PM's grooming stays on Standard even when money is tight.
- **EFF-7 Batch PM work.** The PM grooms on a schedule (e.g. every 30 min) in one run covering all new items, instead of waking for every event. Use provider batch pricing for non-urgent grooming if Flue supports it **\[verify\]**.
- **EFF-8 Reuse workspaces.** Browsers and toolchain are baked into the sandbox image, so a rework round only re-clones its branch and runs npm ci.
- **EFF-9 Bounded retries.** Max 3 CI-fix attempts and 2 review rounds per tier (§6 T-4) stop a run from spending all day on one issue.

### Mid-run and end of day

- **BUD-10** If a run hits its per-run cap or the daily cap, it checkpoints (Flue durable session), the item moves to `Blocked: budget`, and it resumes first thing the next day. No half-done PR is opened.
- **BUD-11** The $20 is a hard ceiling. The budget check runs before every model call, not just at dispatch.

### Learning loop

- **BUD-12** Each merged PR records: tier, size, total cost, review rounds, and any follow-up bug or revert within 14 days (charged back to the original issue).
- **BUD-13** Weekly, the PM proposes rubric and estimate changes from that data, e.g. “Fast-tier M issues escalate 40% of the time, so start them on Standard.” A human approves the change.
- **BUD-14** The daily digest shows: spent vs $20, PRs merged, cost per merged PR, rework cost, and items deferred for budget.

## 10B. Infrastructure cost guardrails (no surprise bills)

**Goal:** infra should cost a predictable few dollars a month, and a bug must never be able to run up a large bill. Cloudflare's budget alerts only send an email; they don't pause or cap usage. So we layer alerts, hard blocks where Cloudflare offers them, and our own circuit breaker for everything else.

### Layer 1 — Cloudflare account settings (day one)

- **INF-1 Budget alerts** on account-wide usage spend at **$10, $25 and $50** per billing period, emailed to you.
- **INF-2 Hard blocks** via Cloudflare spend policies (`usage_block`) on `workers` and `durable_objects` at **$75/month**, plus `notification` policies at $15 and $40. A block stops that product until the billing period ends, so it's a last-resort ceiling set well above normal use, not a day-to-day control.
- **INF-3** Usage-based billing notifications for Workers CPU, and a weekly look at the Billable Usage dashboard (the PM links it in the Monday digest).

### Layer 2 — Our own circuit breaker (covers what Cloudflare can't block)

Sandbox/Containers, D1, KV, R2 and Queues have no hard block, so the app meters itself.

- **INF-4** Every billable action increments a counter in `infra_meters`: sandbox start + seconds alive, DO storage writes, D1 writes, queue ops, outbound requests. A price table converts these to an estimated $.
- **INF-5** Daily infra ceiling of **$3/day** (≈$90/month worst case). At 80% the PM pings you; at 100% the breaker trips: no new sandboxes, no new dispatches, cron keeps running only to report. It resets the next day or when you clear it.
- **INF-6** Burst limits catch runaways in minutes instead of days: max 30 agent wake-ups per issue per hour, max 200 webhook dispatches per hour overall, max 5 sandboxes alive at once. Exceeding any trips the breaker and pings you.

### Layer 3 — Design out the usual causes of runaway bills

- **INF-7 No self-triggering.** Events caused by our own GitHub Apps (bot comments, labels, pushes) are dropped before any dispatch, so an agent can't wake itself in a loop. This is the most likely surprise-bill bug.
- **INF-8 Dedupe and idempotency** on every webhook (`deliveryId`) and every GitHub write.
- **INF-9 Bounded retries** with exponential backoff and a max attempt count; no unbounded Durable Object alarms or tight retry loops.
- **INF-10 Sandbox lifecycle:** standard-2 instance (§3 SB-1); hard wall-clock limit (Dev 45 min, Reviewer 20 min); idle sandboxes destroyed after 15 min; Dev sandbox destroyed when its PR merges or closes; a nightly sweep kills anything orphaned.
- **INF-11 Storage hygiene:** keep agent sessions 30 days then prune; test artifacts (Playwright reports, coverage) live in GitHub Actions artifacts, not R2.

### Layer 4 — Backstops outside Cloudflare

- **INF-12 Model providers:** set a monthly spend limit on each provider's API key/project (≈$650) as a backstop to the app's $20/day cap, in case of a budget-check bug.
- **INF-13 GitHub Actions:** keep the Actions overage budget at $0 (or a small fixed amount) so CI minutes can't run up a bill.
- **INF-14 Kill switch:** one command (`wrangler secret put AGENTS_PAUSED true` or a D1 flag) stops all dispatches and sandbox starts within one request.

### Reporting

- **INF-15** The daily digest shows estimated infra spend today and month-to-date next to model spend. Each Monday the PM compares its estimate with Cloudflare's billable usage and flags any gap over 20%.

## 11. Repo layout

**Orchestrator repo (`sdlc-agents`)**

```
src/
  agents/pm.ts            'use agent' — PM
  agents/dev.ts           'use agent' — Dev (tier from initialData or factory)
  agents/reviewer.ts      'use agent' — Reviewer/QA
  tools/github/*.ts       issues, projects (GraphQL), PRs, reviews, checks
  tools/dispatch.ts       dispatch_agent, escalate_tier
  channels/github.ts      extended webhook router + dedupe
  config/tiers.ts         tier → model map, caps
  config/rubric.ts        tier scoring
  sandboxes/remote.ts     Daytona/E2B factory keyed on instance id
  app.ts                  HTTP entry (webhooks, cron, health)
.agents/skills/
  write-issue/  tier-rubric/  implement-issue/
  conventional-commits/  review-pr/  qa-acceptance/
flue.config.ts  Dockerfile  evals/
```

**Target repo additions**

```
AGENTS.md                      commands, architecture map, conventions
.github/ISSUE_TEMPLATE/*.yml   feature, bug, chore forms
.github/pull_request_template.md
.github/workflows/ci.yml       lint, typecheck, unit, e2e, commitlint
.github/workflows/pr-title.yml
.github/CODEOWNERS
commitlint.config.ts  .husky/commit-msg
vitest.config.ts  playwright.config.ts
```

## 12. Rollout phases

| Phase               | Scope                                                                                                                                                                            | Exit criteria                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 0. Repo hygiene     | Scaffold the greenfield repo (TS, Vitest, Playwright, scripts), CI, commitlint, PR-title check, ruleset, issue forms, `AGENTS.md`, Project fields, Slack app + `/agents` command | Humans ship 3 PRs through the new gates   |
| 1. Spikes           | Verify tier-from-initialData, sandbox runs Playwright, channel extension, Projects webhooks                                                                                      | All **\[verify\]** items resolved         |
| 2. PM only          | PM grooms backlog and writes issues; humans implement                                                                                                                            | 80% of PM issues accepted without rewrite |
| 3. Dev on Fast tier | Dev agent on XS/S issues only, human review                                                                                                                                      | 5 merged agent PRs                        |
| 4. Reviewer/QA      | Reviewer added; human still merges                                                                                                                                               | Reviewer catches seeded bugs in evals     |
| 5. Full tiers       | Standard + Frontier, escalation, budgets, WIP                                                                                                                                    | Cost and pass rate stable for 2 weeks     |
| 6. Tune             | Adjust rubric from Project data; consider auto-merge for Fast-tier docs/chores                                                                                                   | —                                         |

## 13. Open questions

1. **Sandbox fit** — docs say yes (Ubuntu image with apt, custom Dockerfile); run the one-hour spike in §3 before building agents. Fallback: Daytona or E2B.
2. **WIP limit** — how many issues in flight at once (default 3)?
3. **Weekends** — same $20/day agent budget on weekends, or pause?
4. **Slack** — which workspace, and are `#agents` / `#agents-alerts` the right channel names?

**Resolved**

- Project: Archidocs (§1A), plus an agent-built reference model repo.
- Phase 0 scaffold: you, with Claude Code (Appendix A).
- Models: Anthropic only for now.
- Account: personal GitHub account, **public** repos.
- Triggers: Slack for people, internal dispatch between agents, polling reconciler for GitHub (no webhooks in v1).
- Intake and notifications: Slack.
- E2E environment: built site behind a local static server only; no deployments (Archidocs principle).
- Release process: no release automation until someone depends on it; Conventional Commits keep release-please an easy add later.
- Cloudflare: on Workers Paid; §10B ceilings confirmed.

## 14. Sources

- [Flue docs — home](https://flueframework.com/)
- [Flue — Subagents](https://flueframework.com/docs/guide/subagents/)
- [Flue — Sandboxes](https://flueframework.com/docs/guide/sandboxes/)
- [Flue — GitHub channel](https://flueframework.com/docs/ecosystem/channels/github/)
- [Flue — GitHub Actions deploy](https://flueframework.com/docs/ecosystem/deploy/github-actions/)
- [Flavio Copes — Flue: the open framework for building AI agents](https://flaviocopes.com/flue-framework/)
- [Flue on GitHub](https://github.com/withastro/flue)

## Appendix A. Phase 0 prompt for Claude Code

Before running it: export the Archidocs requirements doc as Markdown to `.notes/requirements.md` in an empty `archidocs` repo, and replace `<you>` with your GitHub username.

```text
You are setting up Phase 0 of Archidocs: the repo foundation that AI agents
will build on. Read .notes/requirements.md first; it is the source of truth.
Do NOT implement R1-R19. Build only the foundation and a walking skeleton.
Work in small Conventional Commits. Ask me before any choice the
requirements doc leaves open that would be costly to change later.

## 1. Package and layout
- One npm package named `archidocs`, Node 22, TypeScript strict, ESM.
- Layout:
  src/cli/      bin `archidocs`: init, validate, dev, build (stubs for now)
  src/core/     config loading + schema, CALM model loading, shared types
  src/layout/   elkjs layout, build time only
  viewer/       Vite + React SPA: TanStack Router, Tailwind, shadcn/ui,
                React Flow. Prebuilt at publish time and shipped in the
                package; consumers never run a bundler.
  tests/fixtures/models/   valid-minimal plus a couple of invalid models
- Bundle the CLI before publishing (tsup or similar). `files` in
  package.json ships only dist/ (CLI + prebuilt viewer) and README.
- Add a test that fails if elkjs ends up in the viewer bundle.

## 2. Config schema (R16)
- Implement the config schema from docs/requirements.md exactly.
- One source of truth produces both the JSON Schema and the
  `defineConfig` TypeScript type, so they cannot drift. Unknown keys are
  rejected, and errors name the field at fault. Unit-test it.

## 3. Walking skeleton (smoke only, no features)
- `archidocs init` writes a starter config and a tiny valid CALM file.
- `archidocs build` copies the prebuilt viewer to an output folder and
  writes the model as a data file; the viewer loads it and lists view
  names. Must work from a plain static file server, at / and under a
  sub-path, using the configured base path.
- `archidocs validate` and `archidocs dev` can be stubs that exit cleanly.

## 4. Tests and tooling
- ESLint (flat config) + Prettier. Lint bans .only / .skip in tests.
- Vitest with v8 coverage and thresholds in config.
- Playwright with two projects: site served at / and at /docs/archi/
  (static server, no app server). Wire @axe-core/playwright with one
  smoke a11y test.
- Pack test: `npm pack`, install the tarball into an empty temp folder,
  run init then build, serve the output, assert the page loads.
- package.json scripts: lint, typecheck, test:unit, test:e2e, test:pack,
  build, test (runs all).
- Test names describe behaviour. No issue numbers or requirement ids in
  test names or code comments.

## 5. Conventional Commits
- commitlint (@commitlint/config-conventional) + husky commit-msg hook.
- Allowed scopes: cli, core, layout, viewer, config, ci, docs, deps.

## 6. GitHub
- .github/workflows/ci.yml on pull_request and push to main: jobs for
  lint, typecheck, test:unit (upload coverage), test:e2e (install
  browsers, upload Playwright report), test:pack, commitlint over the
  PR range. Checkout with fetch-depth: 0. No secrets, no paid services.
- .github/workflows/pr-title.yml: semantic PR title check.
- Issue forms: feature, bug, chore. Required fields: Job (J1-J14 or
  named request), acceptance criteria, test plan, out of scope.
- PR template: Conventional title reminder, `Closes #`, an
  "AC -> test" table (AC | test file | test name), risk notes.
- CODEOWNERS: .github/**, AGENTS.md, docs/adr/**, eslint, commitlint,
  vitest and playwright configs -> @<you>.
- scripts/setup-github.sh using the gh CLI, for me to review and run
  (do not run it): labels (agent:in-progress, agent:stop, needs-human,
  needs-clarification, flaky), a ruleset on main (PR required, squash
  only, linear history, required checks from ci.yml + pr-title, 1
  CODEOWNERS approval, no force push, no bypass), and a user-owned
  Project with fields Status, Type, Priority, Size, Tier, Tier score,
  Attempts, Agent cost (values in docs/sdlc.md if present, else ask).

## 7. Docs for agents
- AGENTS.md: what Archidocs is (2 lines), exact commands, a map of the
  layout, conventions (Conventional Commits, branch
  <type>/<issue#>-<slug>, behaviour-named tests, no ticket ids in code),
  the principles and non-goals from docs/requirements.md, protected
  paths agents must not edit, and how to run e2e locally.
- docs/adr/: one ADR (MADR format, status Accepted) per row of the
  Decisions table in docs/requirements.md.
- docs/design/README.md: placeholders for the prototype export
  (screenshots, colour/type/spacing tokens, Geist fonts) and the
  Doorway-tile logo assets. Set up Tailwind theme tokens for the dark
  theme with TODO values that I will fill in.

## 8. Done when
- `npm run test` passes locally, and CI is green on a PR you open.
- `git log` on main is all Conventional Commits.
- You give me a short summary: the decisions you made, anything you
  stubbed, and the exact steps left for me (run setup-github.sh, fill
  design tokens, install the GitHub Apps).

## Part B: reference model repo (only after Part A is done)
In a sibling repo `archidocs-reference`, set up only the shell the agents
will fill: README, architectures/ (empty), docs/adr/ (empty), AGENTS.md
(what the repo is, CALM conventions, one system or decision per PR),
the same commitlint/husky/PR-title setup, issue and PR templates, and a
CI job that validates every CALM file with the official FINOS CALM CLI.
Check the CLI's current package name and command before using them.
Do not write any model content.
```
