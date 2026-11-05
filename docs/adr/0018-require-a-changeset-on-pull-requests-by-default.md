# Require a changeset on pull requests by default

Status: Accepted, 2026-11-05. Amends the pull-request part of ADR-0004.

ADR-0004 accepted a missing changeset as a valid no-release signal, so nothing caught a change that should have released but whose author forgot to say so. Pull requests now must add a changeset by default; each repository can turn this off with an explicit per-repository option. A pull request that ships nothing adds an empty changeset, which makes "no release" a stated decision rather than an omission. Dependency-update pull requests, titled `chore(deps)` or `chore(deps-dev)`, are exempt because Dependabot can't write a changeset. Their changes ship with the next release of the affected unit.

The requirement applies only to pull requests. On the default branch, having no pending release changesets still skips production deployment and release creation, as ADR-0004 says.

## Consequences

- Authors must add a changeset even for documentation or CI changes. We accept this small cost in exchange for never losing release intent silently.
- Enforcement needs the check to be required in the repository's rulesets. Open pull requests report it only after their next push or title edit, so make it required once the workflow is on the default branch.
- A title exemption can be claimed by anyone who can edit the title. Workflow definitions and contributors are already trusted (ADR-0005), and reviewers see the title.
