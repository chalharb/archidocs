# 03: Installation page

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

A new `start/installation` page, placed before the quick start. Installing is two lines in the quick start today.

- **Requirements:** Node.js 22.18 or later, and git.
- **Install:** tabs for npm, pnpm and npx, global and as a dev dependency of the Workspace repo.
- **Verify:** `archidocs version`, with its output.
- **Upgrade:** how to upgrade, then re-run `archidocs init` to refresh the skill stubs (today only `guides/agents/install-skill` says so). Link the Changelog.
- **Pin a version in CI:** the Action's and the GitLab template's `version` input.
- **Uninstall.**

The quick start and tutorial link here for requirements and keep one install line each.

## Acceptance criteria

- [ ] The page exists and is second in the Start here group.
- [ ] Every `archidocs …` line passes the CLI-line check.
- [ ] The Node.js version on the page is read from `package.json` `engines`, or a test fails when they differ.
