# 06: `dev` reloads only on Workspace files, and the docs say which files those are

Status: ready-for-agent
Blocked by: 03
Spec: [Workspace checkout](../spec.md)

## What to build

The one user-visible change in this spec, in its own PR so release-please gives it a changelog line. PR title: `fix(dev): reload only when a Workspace file changes`.

- `src/cli/dev.ts:159-163`: the watcher calls `isWorkspaceFile` (from the Checkout module, ticket 03) on the changed path, relative to the Workspace root, instead of its own hidden-folder and `node_modules` check. A change to any other file (`notes.txt`, `package.json`, a `.json` file) no longer reloads the page.
- A watch event with no file name (`name` is null on some platforms) still reloads, as today.

### Docs

- `src/cli/commands.ts:175`, `dev`'s `description`. It feeds the CLI's usage text, the `dev` reference page and the CLI index. Change it to say that `dev` reloads when a Workspace file changes, for example "Serve the viewer locally and reload it when a `.yaml` or `.md` file in the Workspace changes." Keep it one line; the wording rules in `pnpm docs:test` check it.
- `website/src/reference/cli.ts`: add a section "Which files are read" to the CLI reference index, after "How the Workspace is found". Say which files under the Workspace root are read: `.yaml` files (the Model) and `.md` files (ADRs), skipping any folder or file whose name starts with `.` and any `node_modules` folder. Say that `check`, `build`, `export`, `mcp` and `dev` all read the same files, and that `dev` reloads only when one of them changes. Today this rule is undocumented even for `check`. Give the section a stable anchor, as `WORKSPACE_SECTION` does, and link it from the `dev` page's "See also" the way `WORKSPACE_SECTION` is linked (`cli.ts:155`).
- Leave unchanged: the pages that say the viewer "reloads as you edit" (`start/quick-start.mdx:79`, `start/tutorial.mdx:118`, `help/troubleshooting.mdx:38`, `README.md:167`, `CONTRIBUTING.md:27`). They stay true.

## Tests

- `test/cli/dev.test.ts`: writing `notes.txt` in the Workspace sends no reload; writing a `.yaml` file still does; writing a `.yaml` file under a hidden folder or `node_modules` doesn't.
- `website/test/reference.test.ts`: the CLI index has the "Which files are read" section, and the `dev` page links it.
- `pnpm docs:test` passes, including the wording rules on the new text.

## Acceptance criteria

- [ ] `grep -rn 'startsWith(".")' src` finds only `core/workspace-files.ts`.
- [ ] `archidocs dev` doesn't reload on a non-Workspace file, and does on a `.yaml` or `.md` one.
- [ ] The usage text and the generated `dev` page show the new description.
- [ ] The CLI reference index has "Which files are read", linked from the `dev` page.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e`, `pnpm docs:test` and `pnpm docs:build` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
