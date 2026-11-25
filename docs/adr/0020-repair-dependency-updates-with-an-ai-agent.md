# Repair dependency updates with an AI agent

Status: Accepted, 2026-11-25.

Dependabot pull requests pile up when a bump breaks the build, and green ones still wait for someone to press merge. A shared nightly workflow now merges updates that pass the caller's own checks and gives failing ones to opencode, an AI coding agent, which edits the checkout until those checks pass. The workflow, not the agent, decides: it re-runs the checks and pushes only on success, and anything it can't fix is labelled `needs-human`.

Majors are a per-repository policy, because their risk depends on how much a repository's tests cover. A repository may let majors merge automatically only if it declares end-to-end tests that run before the merge; otherwise majors are verified and left for review.

The agent reads untrusted text (release notes, CI logs) and runs commands, so it gets the model API key and no GitHub credentials. Pushing uses a fine-grained personal access token held by the workflow, because pushes with `GITHUB_TOKEN` don't start CI. A dedicated GitHub App, like the Release App in ADR-0008, would avoid a user-bound token and can replace it later.

## Consequences

- Model usage is billed per token on the caller's Anthropic account. Green updates cost nothing because the agent runs only on failures.
- A pull request the bot pushed to is no longer rebased by Dependabot.
- The checks the caller passes in are the safety net. Weak tests let a wrong fix through, and the agent is told not to weaken them, not prevented from doing so.
