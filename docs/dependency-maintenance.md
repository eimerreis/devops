# Dependency maintenance

A nightly shared workflow that keeps Dependabot pull requests moving ([ADR-0020](adr/0020-repair-dependency-updates-with-an-ai-agent.md)).
It merges updates that pass the caller's checks and lets [opencode](https://opencode.ai) repair the ones that fail.

## What a run does

1. **Plan.** List open Dependabot pull requests. Skip those labelled `needs-human` or `ready-for-review`, and majors when the policy is `ignore`. Ask Dependabot to rebase conflicting ones.
2. **Verify.** For each remaining pull request, one at a time, run `verify` in a checkout of its branch. Major updates also run `e2e`.
3. **Merge** when the local checks pass and no CI run on the head commit failed. Auto-merge is used when the repository allows it, so required checks still gate the merge.
4. **Repair** otherwise. opencode gets the local and CI failure logs and edits the checkout. The workflow re-runs the checks and pushes the fix only if they pass. The next run merges it once CI is green.
5. **Escalate** when the repair fails: comment with the agent's notes and add `needs-human`. Remove the label to let a later run try again.

A pull request the bot pushed to is no longer rebased by Dependabot. Close it to get a fresh one from Dependabot.

## Major updates

Each caller chooses with `majors`:

| Policy | Behaviour |
| --- | --- |
| `review` (default) | Verify and repair like any update, then label `ready-for-review` and leave the merge to the owner. |
| `merge` | Merge after `verify` and `e2e` pass. Requires `e2e`; the plan job fails without it. |
| `ignore` | Leave majors alone. |

A grouped pull request counts as major when any update in it is major, as Dependabot records in its commit message.

## Inputs

| Input | Default | Purpose |
| --- | --- | --- |
| `verify` | required | Install, build, and test. Exit code 0 means safe to merge. |
| `e2e` | empty | End-to-end tests, run for majors in addition to `verify`. |
| `majors` | `review` | See above. |
| `runs-on` | `"ubuntu-latest"` | Runner labels as JSON. |
| `node-version` | `24` | Always installed, because opencode runs on Node.js. |
| `bun-version` | empty | Installs Bun when set. |
| `setup` | empty | Extra toolchain commands, for example `corepack enable`. |
| `model` | `anthropic/claude-opus-5-5` | opencode model. `anthropic/claude-sonnet-5-5` costs half. |
| `max-pull-requests` | `10` | Limit per run. |
| `timeout-minutes` | `60` | Limit per pull request. |

## Adopt it in a repository

1. Copy [`examples/callers/dependency-maintenance.yml`](../examples/callers/dependency-maintenance.yml), pin the baseline commit, and set the commands.
2. Add the secrets:

   ```sh
   repo=eimerreis/example
   gh secret set ANTHROPIC_API_KEY --repo "$repo"
   gh secret set DEPENDENCY_BOT_TOKEN --repo "$repo"
   ```

   `ANTHROPIC_API_KEY` is an Anthropic Console API key; set a monthly spend limit there.
   `DEPENDENCY_BOT_TOKEN` is a fine-grained personal access token limited to the participating repositories, with Contents, Pull requests, and Workflows set to read and write.
   A push made with `GITHUB_TOKEN` would not start CI on the fixed branch.
3. Run it once with **Run workflow** and read the comments it leaves.

## Trust boundary

The agent runs with `--auto`, so it can edit files and run shell commands without approval.
It reads dependency release notes and CI logs, which are untrusted.
It therefore gets the Anthropic key and nothing else: the checkout keeps no credentials, and the GitHub tokens are removed from its environment.
The workflow, not the agent, commits and pushes, and only after the caller's checks pass.
