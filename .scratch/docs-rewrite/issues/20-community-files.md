# 20: Contributor and community files

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

The files GitHub and adopters look for by name. The repo has none of them.

- **`CONTRIBUTING.md`:** how to set up, run the tests and the docs site, and open a pull request, moved from the README's Development section. It says how issues and specs are tracked in this repo.
- **`SECURITY.md`:** report a vulnerability through GitHub's private vulnerability reporting ([ticket 01](01-decisions.md)). The maintainer turns it on under the repo's **Settings › Security**; an agent can't.
- **`CODE_OF_CONDUCT.md`:** the Contributor Covenant. It needs a way to report conduct privately, and 01 chose to publish no address: ask the maintainer which channel to name before merging.
- **Issue templates:** a bug report (CLI version, the command, what was printed) and a feature request, under `.github/ISSUE_TEMPLATE/`.
- **`help/contributing` on the site:** one page: where to ask a question, how to report a bug, and links to the files above. It doesn't copy them.
- **README:** its Development section becomes two lines and a link.

## Acceptance criteria

- [ ] The four files and the issue templates exist, and GitHub's community profile shows them.
- [ ] The Help page links each file on GitHub.
- [ ] The commands in `CONTRIBUTING.md` match the scripts in `package.json`.
- [ ] Private vulnerability reporting is on for the repo, and `SECURITY.md` links its report form.
- [ ] No contact address is published that the maintainer didn't give.

## Comments

**Implementation (agent):** the files, the issue templates, the `help/contributing` page and the README's Development section are in the pull request. Status stays `ready-for-agent` until the maintainer does what an agent can't:

1. Name the private channel for conduct reports in `CODE_OF_CONDUCT.md`, in place of the marked placeholder under **Enforcement**. Ticket 01 chose to publish no address, so none was invented.
2. Turn on private vulnerability reporting under the repo's **Settings › Security**. Until then, the report form that `SECURITY.md` links doesn't accept reports.
3. After the merge, check that **Insights › Community standards** lists the four files and the issue templates, then set `Status: done`.
