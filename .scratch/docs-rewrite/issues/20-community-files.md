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
