# 01: Decide what the proposal reopens

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

Nothing. The maintainer answers the questions below, and the answers are written into the spec under a "Decisions" heading. Each answer unblocks the tickets named beside it.

**Reopened from the [docs site spec](../../docs-site/spec.md):**

1. **Viewer manual:** add a "Use the viewer" guide group with generated screenshots? Unblocks 15 and 16.
2. **Contributor files:** add `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` and issue templates? If yes, also say how security reports arrive: GitHub private vulnerability reporting or an address. Unblocks 20.
3. **MCP reference:** one page per tool, with `read-tools` and `write-tools` kept as indexes? Unblocks 12.
4. **Page tree:** accept the tree in the spec, including the renamed guide and the new Help group? Unblocks 08.

**Open questions:**

5. **Spelling:** US or British? If US, add a ticket for one pass over every hand-written page, `guide/`, `GLOSSARY.md` and the generated descriptions.
6. **Quick start:** ticket 02 pastes three files. Is an `archidocs init --example` flag also wanted? If yes, add a ticket for it; 02 doesn't wait.
7. **MCP clients:** which get a tab on `connect-mcp`? Unblocks 06.
8. **Comparison:** does "Why Archidocs" name Structurizr, LikeC4 and Backstage, or name no one? Unblocks 17.

## Acceptance criteria

- [x] Each of the eight questions has an answer recorded in the spec.
- [x] A follow-up ticket exists for each answer that needs one (a spelling pass, `init --example`).
- [x] A "no" sets the tickets it blocks to `wontfix`.

## Answer

Answered by the maintainer on 2026-11-24.

1. **Viewer manual:** yes. Tickets 15 and 16 are unblocked.
2. **Contributor files:** yes. Security reports arrive through GitHub's private vulnerability reporting; no address is published. Ticket 20 is unblocked.
3. **MCP reference:** yes, a page per tool, with the two pages kept as indexes. Ticket 12 is unblocked.
4. **Page tree:** yes, as proposed, including the one URL move. Ticket 08 now waits only for 07.
5. **Spelling:** US. Ticket [21](21-us-spelling.md) is the pass.
6. **Quick start:** paste only. No `init --example` flag, so no new ticket.
7. **MCP clients:** Claude Code, Cursor, VS Code / Copilot and Codex. Ticket 06 is unblocked.
8. **Comparison:** name no one. Ticket 17 is unblocked, without the comparison.

No answer was a "no" to a ticket, so none is `wontfix`.
