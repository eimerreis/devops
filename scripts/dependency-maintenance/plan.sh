#!/usr/bin/env bash
# Lists the open Dependabot pull requests this run should handle and writes them as a JSON matrix.
# Env: GH_TOKEN, REPOSITORY, MAJORS (merge|review|ignore), E2E, LIMIT, GITHUB_OUTPUT.
set -euo pipefail

case "$MAJORS" in
  merge | review | ignore) ;;
  *) echo "::error::majors must be merge, review, or ignore, got '$MAJORS'" && exit 1 ;;
esac
if [ "$MAJORS" = merge ] && [ -z "$E2E" ]; then
  echo "::error::majors: merge needs e2e commands; major updates are merged only after end-to-end tests pass"
  exit 1
fi

gh label create needs-human --repo "$REPOSITORY" --color B60205 \
  --description "Dependency maintenance could not repair this pull request" 2>/dev/null || true
gh label create ready-for-review --repo "$REPOSITORY" --color 0E8A16 \
  --description "Verified major update waiting for the owner" 2>/dev/null || true

# Dependabot records the update type of every bumped dependency in the commit message.
# A grouped pull request counts as major when any of its updates is major.
# Commits are read per pull request because listing them for all at once exceeds GraphQL node limits.
pull_requests=$(gh pr list --repo "$REPOSITORY" --author app/dependabot --state open --limit 100 \
  --json number,headRefName,mergeable,labels)
matrix=$(
  jq -c '.[]' <<<"$pull_requests" | while IFS= read -r entry; do
    number=$(jq -r .number <<<"$entry")
    major=$(gh pr view "$number" --repo "$REPOSITORY" --json commits \
      --jq 'any(.commits[]; .messageBody | test("update-type: version-update:semver-major"))')
    jq -c --argjson major "$major" \
      '{number, branch: .headRefName, mergeable, labels: [.labels[].name], major: $major}' <<<"$entry"
  done | jq -sc --arg majors "$MAJORS" --argjson limit "$LIMIT" '
    map(select((.labels | index("needs-human") | not) and (.labels | index("ready-for-review") | not)))
    | map(select($majors != "ignore" or (.major | not)))
    | sort_by(.major, .number)
    | .[:$limit]'
)

# Dependabot resolves conflicts itself when asked; the next run picks the rebased branch up.
for number in $(jq -r '.[] | select(.mergeable == "CONFLICTING") | .number' <<<"$matrix"); do
  echo "#$number conflicts with the base branch, asking Dependabot to rebase"
  gh pr comment "$number" --repo "$REPOSITORY" --body "@dependabot rebase"
done

matrix=$(jq -c 'map(select(.mergeable != "CONFLICTING") | {number, branch, major})' <<<"$matrix")
echo "Pull requests to handle: $matrix"
echo "pull-requests=$matrix" >>"$GITHUB_OUTPUT"
