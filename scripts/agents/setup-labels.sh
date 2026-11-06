#!/usr/bin/env bash
# Create or update the labels the agent workflows use as their state machine (docs/agents.md).
# Idempotent. Needs the GitHub CLI authenticated with write access to the repository.
# Usage: scripts/agents/setup-labels.sh [owner/repo]
set -euo pipefail

repo="${1:-${GITHUB_REPOSITORY:-}}"
repo_args=()
[[ -n "$repo" ]] && repo_args=(--repo "$repo")

while IFS='|' read -r name color description; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  gh label create "$name" --color "$color" --description "$description" --force "${repo_args[@]}"
done <<'EOF'
# Work item structure
type:feature|5319e7|A user-visible capability; parent of type:task sub-issues
type:task|1d76db|Smallest independently deployable piece of work; one PR
type:requirements|c5def5|Proposed addendum or requirement clarification for the product owner
priority:p1|b60205|Do next
priority:p2|d93f0b|Do soon
priority:p3|fbca04|Do later
size:xs|c2e0c6|Under ~50 changed lines
size:s|a2eeef|Under ~200 changed lines
size:m|7057ff|Under ~400 changed lines; split anything bigger
# Assignment
agent:dev-1|0e8a16|Assigned to the Dev 1 agent
agent:dev-2|006b75|Assigned to the Dev 2 agent
# Issue state
status:ready|bfdadc|Groomed and assigned; the dev agent will start it
status:in-progress|fef2c0|A dev agent is working on it
# Pull request state
status:needs-review|1d76db|Waiting for the Code Reviewer agent
status:changes-requested|e99695|Code Reviewer asked for changes; dev agent will fix
status:needs-qa|5319e7|Code review passed; waiting for the QA agent
status:qa-failed|e99695|QA found gaps against the issue; dev agent will fix
status:ready-to-merge|0e8a16|Reviewed and QA-approved; waiting for the product owner
# Escape hatches
needs-human|b60205|Agents stop on this item until a person removes the label
update-visual-baselines|f9d0c4|Regenerate Linux Playwright screenshot baselines on CI and commit them
blocked|000000|Waiting on another issue or decision
EOF
