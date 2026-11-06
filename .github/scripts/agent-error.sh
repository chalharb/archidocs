#!/usr/bin/env bash
# Surfaces why a claude-code-action run failed. The action hides Claude's output by default
# (it can contain repository content), so on failure print only the final result message and
# Claude's last text reply as an error annotation and in the job summary.
set -uo pipefail

file="${RUNNER_TEMP:-/tmp}/claude-execution-output.json"
if [[ ! -f "$file" ]]; then
  echo "::error title=Agent failed::No Claude execution output; the failure happened before Claude started (see the steps above)."
  exit 0
fi

result="$(jq -r '[.[] | select(.type == "result")] | last | (.result // .errors // .subtype // "unknown") | tostring' "$file")"
last_text="$(jq -r '[.[] | select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text] | last // ""' "$file" | tail -c 2000)"

echo "::error title=Agent failed::${result//$'\n'/ }"
{
  echo "### Agent failed"
  echo
  echo "**Result:** ${result}"
  if [[ -n "$last_text" ]]; then
    echo
    echo "**Claude's last message:**"
    echo
    echo '```'
    echo "$last_text"
    echo '```'
  fi
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
