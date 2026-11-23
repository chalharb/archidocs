# Propose an ADR

An ADR records one architecture decision in `<project>/adr/NNNN-slug.md`. Proposing writes it with `status: proposed`; accepting is a status and date edit made in the pull request.

## Steps

1. **Gather** the decision, the options considered and the trade-offs, from the user and the conversation so far. Resolve the affected Elements and Deployment Targets with `search_elements`, and Saved Views with `list_views`. Find the ADRs it replaces with `list_adrs`.
2. **Draft** the body. Leave `body` out to fill the template: the Project's `adr/template.md`, else the Workspace's `adr-template.md`, else MADR minimal (Context and Problem Statement, Considered Options, Decision Outcome, Consequences). Pass `body` to write your own under the `# ` title.
3. **Write** `propose_adr(project, title, elements?, views?, supersedes?, body?)`. `project` owns the decision; `supersedes` takes `NNNN` in this Project or `project:NNNN`. The tool takes the next free number and today's date.
4. **Hand over.** Show the diff, run `check`, and suggest a branch, PR title and body. Reviewers accept it in the PR by setting `status: accepted` and the date.

`superseded` is derived once an accepted ADR lists the old one in `supersedes`; leave the old ADR's `status` as it is.
