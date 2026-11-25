# 18: "Set up your editor" and "Check a Workspace in CI"

Status: done
Blocked by: 07
Spec: [Docs rewrite proposal](../spec.md)

## What to build

Two guides, to the how-to template.

**`guides/model/set-up-your-editor`:** completion and validation as you type. The schemas ship in the npm package and are mentioned in one generated sentence.

- How to point a YAML language server at `workspace.schema.json`, `project.schema.json` and `model.schema.json`, for VS Code and for any editor that uses `yaml-language-server`.
- Try each setup before writing it down, and say which path or URL the schema is read from.
- It's best written after ticket 10, when hovering a field shows its description.

**`guides/publish/check-in-ci`:** run `archidocs check` on every pull request without publishing.

- GitHub: a workflow with `check --format github`, so issues appear as annotations. Keep the workflow in `examples/` and include it, as the tutorial's is.
- GitLab: the same job in `.gitlab-ci.yml`.
- `--strict`, and pinning the CLI version.
- Link PR previews as the next step.

## Acceptance criteria

- [x] Both pages exist and pass the template test.
- [x] The editor setup was tried in VS Code, and the page shows a field completing.
- [x] The CI workflow on the page is included from a file, not typed inline.
- [x] Every `archidocs …` line passes the CLI-line check.
