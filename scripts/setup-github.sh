#!/usr/bin/env bash
# One-time GitHub setup for this repository: merge settings, labels, a ruleset on
# main and a user-owned Project. Review it, then run it yourself with the gh CLI
# signed in as the repository owner:
#
#   REPO=chalharb/archidocs ./scripts/setup-github.sh
#
# Each step is safe to re-run: existing labels, rulesets and projects are updated
# or skipped rather than duplicated.
set -euo pipefail

REPO="${REPO:-chalharb/archidocs}"
OWNER="${REPO%%/*}"
PROJECT_TITLE="${PROJECT_TITLE:-Archidocs}"

echo "==> Repository merge settings (squash only, delete merged branches)"
gh repo edit "$REPO" \
  --enable-squash-merge=true --enable-merge-commit=false --enable-rebase-merge=false \
  --squash-merge-commit-message pr-title-description \
  --delete-branch-on-merge

echo "==> Labels"
label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force; }
label "agent:in-progress" "1d76db" "An agent is working on this"
label "agent:stop" "b60205" "Pause all agent activity on this item"
label "needs-human" "d93f0b" "Waiting on a person"
label "needs-clarification" "fbca04" "The issue is ambiguous; a question is open"
label "flaky" "c5def5" "A test that passes only on retry"

echo "==> Ruleset on main"
RULESET_NAME="main protection"
RULESET_JSON=$(cat <<JSON
{
  "name": "$RULESET_NAME",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "lint" },
          { "context": "typecheck" },
          { "context": "test:unit" },
          { "context": "test:e2e" },
          { "context": "test:pack" },
          { "context": "commitlint" },
          { "context": "pr-title" }
        ]
      }
    }
  ]
}
JSON
)
EXISTING_ID=$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$RULESET_NAME\") | .id" | head -n1)
if [ -n "$EXISTING_ID" ]; then
  echo "$RULESET_JSON" | gh api -X PUT "repos/$REPO/rulesets/$EXISTING_ID" --input - >/dev/null
  echo "Updated ruleset $EXISTING_ID"
else
  echo "$RULESET_JSON" | gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null
  echo "Created ruleset"
fi

echo "==> Project (user-owned)"
# The gh token needs the "project" scope: gh auth refresh -s project
PROJECT_NUMBER=$(gh project list --owner "$OWNER" --format json --jq ".projects[] | select(.title == \"$PROJECT_TITLE\") | .number" | head -n1)
if [ -z "$PROJECT_NUMBER" ]; then
  PROJECT_NUMBER=$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json --jq .number)
  echo "Created project #$PROJECT_NUMBER"
else
  echo "Using existing project #$PROJECT_NUMBER"
fi
gh project link "$PROJECT_NUMBER" --owner "$OWNER" --repo "$REPO" || true

field() { # name option1,option2,...
  gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" --name "$1" \
    --data-type SINGLE_SELECT --single-select-options "$2" >/dev/null || echo "  (field $1 may already exist)"
}
number_field() {
  gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" --name "$1" --data-type NUMBER >/dev/null \
    || echo "  (field $1 may already exist)"
}
field "Type" "Feature,Bug,Chore,Docs,Refactor,Test,Perf"
field "Priority" "P0,P1,P2,P3"
field "Size" "XS,S,M,L,XL"
field "Tier" "Fast,Standard,Frontier"
number_field "Tier score"
number_field "Attempts"
number_field "Agent cost"

# New projects come with a built-in Status field (Todo, In Progress, Done); replace its options.
STATUS_FIELD_ID=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --jq '.fields[] | select(.name == "Status") | .id')
gh api graphql -f query='
  mutation($field: ID!) {
    updateProjectV2Field(input: {
      fieldId: $field,
      singleSelectOptions: [
        {name: "Inbox", color: GRAY, description: "New request, not groomed"},
        {name: "Backlog", color: GRAY, description: "Groomed, has criteria and a tier"},
        {name: "Ready", color: BLUE, description: "Next up"},
        {name: "In Progress", color: YELLOW, description: "Being implemented"},
        {name: "In Review", color: PURPLE, description: "Under review"},
        {name: "Changes Requested", color: ORANGE, description: "Review found blocking issues"},
        {name: "Awaiting Human", color: PINK, description: "Approved, waiting for a person to merge"},
        {name: "Blocked", color: RED, description: "Needs an answer or a decision"},
        {name: "Done", color: GREEN, description: "Merged and closed"}
      ]
    }) { projectV2Field { ... on ProjectV2SingleSelectField { id } } }
  }' -f field="$STATUS_FIELD_ID" >/dev/null
echo "Status options set"

echo "Done. Remaining by hand: create the GitHub Apps and install them on this repository."
