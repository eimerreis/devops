# v1.0.0 implementation plan

The [confirmed design](delivery-baseline.md) is the requirements brief. GitHub issues track implementation, acceptance evidence, and dependencies; a separate PRD is not needed.

[v1.0.0 milestone](https://github.com/eimerreis/devops/milestone/1) · [All v1 issues](https://github.com/eimerreis/devops/issues?q=is%3Aissue+milestone%3Av1.0.0)

## Backlog

Dependencies are recorded both below and through GitHub's native blocked-by relationships. Each issue includes acceptance criteria and links to the relevant design section.

| Issue | Deliverable | Blocked by |
| --- | --- | --- |
| [#1](https://github.com/eimerreis/devops/issues/1) | Define the application delivery contract and release-unit fixtures | None |
| [#2](https://github.com/eimerreis/devops/issues/2) | Implement shared validation and the manual Mac mini runner fallback | [#1](https://github.com/eimerreis/devops/issues/1) |
| [#3](https://github.com/eimerreis/devops/issues/3) | Bootstrap the release App, caller environments, and native repository gates | [#1](https://github.com/eimerreis/devops/issues/1) |
| [#4](https://github.com/eimerreis/devops/issues/4) | Prepare and persist releases with Changesets before build and deployment | [#1](https://github.com/eimerreis/devops/issues/1), [#3](https://github.com/eimerreis/devops/issues/3) |
| [#5](https://github.com/eimerreis/devops/issues/5) | Build prepared revisions and retain private GHCR artifacts by digest | [#1](https://github.com/eimerreis/devops/issues/1), [#4](https://github.com/eimerreis/devops/issues/4) |
| [#6](https://github.com/eimerreis/devops/issues/6) | Deploy by digest with version-aware health checks and verified rollback | [#1](https://github.com/eimerreis/devops/issues/1), [#5](https://github.com/eimerreis/devops/issues/5) |
| [#7](https://github.com/eimerreis/devops/issues/7) | Implement durable release holds, pinned retries, and owner supersession | [#4](https://github.com/eimerreis/devops/issues/4), [#5](https://github.com/eimerreis/devops/issues/5), [#6](https://github.com/eimerreis/devops/issues/6) |
| [#8](https://github.com/eimerreis/devops/issues/8) | Publish verified releases and automate reviewed baseline upgrades | [#2](https://github.com/eimerreis/devops/issues/2), [#3](https://github.com/eimerreis/devops/issues/3), [#4](https://github.com/eimerreis/devops/issues/4), [#6](https://github.com/eimerreis/devops/issues/6), [#7](https://github.com/eimerreis/devops/issues/7) |
| [#9](https://github.com/eimerreis/devops/issues/9) | Rehearse the full contract and pilot adoption in djlib | [#1](https://github.com/eimerreis/devops/issues/1), [#2](https://github.com/eimerreis/devops/issues/2), [#3](https://github.com/eimerreis/devops/issues/3), [#4](https://github.com/eimerreis/devops/issues/4), [#5](https://github.com/eimerreis/devops/issues/5), [#6](https://github.com/eimerreis/devops/issues/6), [#7](https://github.com/eimerreis/devops/issues/7), [#8](https://github.com/eimerreis/devops/issues/8) |

## Starting point

Start with [#1: the application contract](https://github.com/eimerreis/devops/issues/1). Validation and App/bootstrap work can then proceed against that agreed interface. The issue graph orders preparation, artifacts, deployment, recovery, and publication before the pilot.

## v1 acceptance

- Prove the shared contract with isolated validation, runner-fallback, artifact, health-failure, rollback, retry, and supersession rehearsals.
- Complete the reviewed djlib adoption changes while preserving existing version history and application-owned platform distribution.
- Respect the pilot application's production-approval requirements and complete one verified production release.
- Keep broader application enrollment behind that pilot acceptance.

The GitHub App, protected-branch rules, billing controls, and application deployments are implementation work tracked by these issues. Repository setup publishes the design and backlog.
