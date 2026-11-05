# Delivery baseline design

Confirmed by the repository owner on 2026-11-03 after the design interview. The shared understanding is agreed; implementation and pilot verification remain to be done.

## Purpose and ownership

Create a public, MIT-licensed `eimerreis/devops` repository for generic delivery automation and documentation. Keep host operations in `mac-mini` and application configuration and secrets in the application repositories.

Start with application repositories deploying to the Mac mini. Use native GitHub mechanisms and established tools wherever they meet the contract; custom orchestration must address a concrete uncovered requirement. Changesets' CLI is the selected version/changelog engine.

An application declares its release units: one per repository by default, with explicit additional units for independently versioned products. Applications own their language, framework, setup, and validation/build/deployment commands. The shared baseline owns the common delivery contract.

The shared production-release flow covers containers. Apple/App Store distribution remains application-owned, runs after release, and consumes the verified version and source commit. Applicable platform validation remains part of the shared gates.

## Participation and enforcement

- Join through an explicit adoption PR, and enable mandatory gates after adoption is verified. Runner access and App installation do not automatically enroll a repository.
- Ordinary code changes reach the default branch through PRs with passing required checks. The App's generated release-metadata commits are the direct-push exception.
- Use native personal-account rulesets and required checks. Workflow definitions and repository administrators are trusted; a required check name does not independently prove that a particular central workflow ran.
- The repository owner is the v1 operator for manual recovery, supersession, and runner-mode changes.
- Keep the initial App release-only. Installation-driven enrollment and rule administration are future extensions requiring explicit permission expansion.

## Validation and execution

Require format/lint checks, type checks where applicable, automated tests, and a build. Applications declare exceptions explicitly and supply the commands.

Prefer GitHub-hosted PR validation where technically supported and covered by the included allowance. When that allowance is exhausted, the owner manually selects the Mac mini for new runs through native runner configuration; v1 has no automatic billing router. Mac mini fallback is restricted to private, same-repository PRs. Fork PRs must not use the production host, including when free hosted capacity is unavailable.

Native spending-stop setup and proof that a new fallback run reports the correct required PR checks are implementation acceptance criteria. Changing a runner variable must not be assumed to reroute an existing run.

## Application release flow

Each release uses the complete selected default-branch snapshot, including accumulated changes without their own changesets. Changesets declare bump intent and release notes; they do not select which source files ship.

1. Run CI for ordinary code changes, including changes that request no release.
2. On default-branch arrival, inspect pending release changesets. With none, skip production deployment and release creation. This holds however the commit arrived.
3. Serialize release workflows per repository. Do not cancel an in-progress production deployment. Check for an unresolved release hold before advancing release bookkeeping.
4. Use Changesets' CLI to generate versions/changelogs and consume changesets. The App commits the generated metadata to the default branch before the release build and deployment.
5. Build and validate that recorded prepared revision. Push version-tagged private images to GHCR and retain their immutable digests.
6. Deploy by digest. An application-owned automated health check must confirm that the expected version is serving correctly.
7. After successful verification, update `latest` and publish the application release tags and GitHub Release. Application-owned platform distribution can then consume the verified version and source commit.

There is no separate release PR. Adoption and baseline-upgrade PRs remain required. Pull requests must add a changeset by default, and an empty changeset states that nothing ships. Dependency updates titled `chore(deps)` or `chore(deps-dev)` are exempt, and each repository can turn the requirement off with an explicit per-repository option ([ADR-0018](adr/0018-require-a-changeset-on-pull-requests-by-default.md)). Version/bump accuracy and release-note completeness remain responsibilities of the reviewed changeset declarations.

## Recovery and artifact identity

- After preparation succeeds, rerun failed build/deployment/publication jobs against the same prepared commit and version, without another changeset or silently switching to newer default-branch code.
- Use the recorded GHCR digest for deployment retries after a successful build. Durable registry artifacts must survive local image cleanup.
- If deployment verification fails, attempt to restore the last verified application image when available and verify its health. The attempted release remains failed and held even if rollback succeeds.
- Database restoration remains operator-controlled. Applications must keep migrations compatible with the previous application version and stage destructive changes across releases; compatibility validation is application-owned.
- A failed prepared version holds subsequent releases in that repository until recovery succeeds or the owner explicitly supersedes it. Native concurrency serialization alone does not provide this cross-run guard.
- Supersession leaves the failed version unpublished, preserves its history, and carries its unreleased notes into the replacement. Version-number gaps are acceptable.

## App authority and credentials

Create the App and enroll repositories with the [release App guide](release-app.md).

The dedicated GitHub App is installed only on participating repositories and receives an explicit branch-protection exception for release bookkeeping. Its maximum permissions are Contents: write and Workflows: write, with no Administration permission. Mint narrower installation tokens for each job.

Workflow-write authority supports publication/retry against older prepared commits when GitHub requires it, but also permits editing workflow files. GitHub attaches the bypass to the App identity, not to a metadata-only file list; the trusted workflow must validate and restrict its writes.

Each caller repository keeps App credentials in a release-only GitHub environment restricted to its actual default branch and explicitly passes only the required secrets. Personal accounts have no native cross-repository Actions secret store. Narrowing job tokens does not narrow the copied App private key's authority across its installations.

Environment restrictions control GitHub secret availability, not isolation of the persistent Mac user account or Docker access. The same-repository fallback rule is a trusted-contributor boundary.

## Baseline releases and upgrades

- Pin shared workflows to exact revisions associated with tagged baseline releases.
- Use Dependabot to open upgrade PRs for baseline references and dependencies, preserving SHA pins. Require owner review and keep auto-merge disabled in v1.
- Maintain only the current baseline major version. Deliver fixes through reviewed upgrade PRs, prioritizing critical fixes.
- Do not add a live minimum-version or expiry gate in v1. An older pinned pipeline does not fail merely because of its age or a changed central support policy.
- License the public baseline under the standard MIT license.

## Pilot and rollout

Pilot in djlib. Other applications wait until isolated failure/retry/rollback rehearsals and one verified production pilot release pass. Each later application adopts through its own reviewed PR.

Reconcile each application's existing release history and declare the initial version for each release unit in its adoption changes. The migration must not silently reset an existing published version sequence.

## Design tree status

- Scope -> separate public baseline -> MIT license: settled.
- Participation -> checked ordinary PRs -> trusted native enforcement -> owner-only manual operations: settled.
- Release units -> authored changesets -> no release PR -> release intent required on PRs by default -> committed preparation: settled.
- Prepared revision -> GHCR digest -> verified production deployment -> publication -> app-owned distribution: settled.
- Failure -> rollback and hold -> same-version retry or explicit supersession: settled.
- Execution -> included hosted capacity -> manual trusted Mac fallback: settled.
- App identity -> permissions -> caller environments -> future enrollment deferred: settled.
- Versioned baseline -> Dependabot upgrade PRs -> current-major support -> no runtime expiry: settled.
- Adoption -> djlib pilot -> isolated rehearsals and verified live release -> later repos: settled.

## Implementation checks

These are implementation and verification tasks, not unresolved policy questions.

They are tracked in the [v1.0.0 implementation plan](implementation-plan.md) and its linked GitHub issues.

- Prove Changesets configuration for release units and migration from existing versions, including packages that should not be independently released.
- Define thin caller interfaces and shared workflow topology. Shared helper code must execute from the reviewed pinned baseline revision.
- Reject unexpected non-metadata writes before using the App bypass. Prevent metadata-generated events from recursively preparing another release.
- Prove the preparation commit, build output, registry digest, health evidence, and publication all refer to the intended source revision.
- Demonstrate ordinary PR gates, explicit exceptions, the changeset requirement and its opt-out, no-changeset skips, and correct required-check results under path/matrix/skip conditions.
- Validate hosted spending-stop setup and the manual fallback path against the correct PR revision, including rejection of fork PR fallback.
- Define owner-only retry/supersession controls and the cross-run release hold; handle preparation races, partially completed publication, and retry idempotency.
- Verify rollback health, migration compatibility, notes carried during supersession, and retention of required recovery evidence/artifacts.
- Set up the App, caller environments, explicit secret passing, narrow tokens, and key rotation/revocation procedures.
- Complete isolated rehearsals and the djlib adoption PR before the verified production pilot release and wider rollout.
- Validate the baseline's own generic workflow contracts before publishing tagged revisions for application adoption.

## Decision records

- [Scope](adr/0001-scope-of-the-application-delivery-baseline.md)
- [Separate baseline and host operations](adr/0002-separate-the-delivery-baseline-from-host-operations.md)
- [Explicit shared workflow upgrades](adr/0003-adopt-shared-workflow-updates-explicitly.md)
- [Release from default-branch changes](adr/0004-release-from-default-branch-changes.md)
- [Trust workflow definitions for initial enforcement](adr/0005-trust-workflow-definitions-for-initial-enforcement.md)
- [Publish application releases after deployment](adr/0006-publish-application-releases-after-deployment.md)
- [Record release metadata before building and deploying](adr/0007-record-release-metadata-before-building-and-deploying.md)
- [Use a dedicated App for release writes](adr/0008-use-a-dedicated-app-for-release-writes.md)
- [Use Changesets without release pull requests](adr/0009-use-changesets-without-release-pull-requests.md)
- [Hold releases after a prepared-version failure](adr/0010-hold-releases-after-a-prepared-version-failure.md)
- [Keep migrations compatible with the previous application](adr/0011-keep-migrations-compatible-with-the-previous-application.md)
- [Keep release images in GHCR and deploy by digest](adr/0012-keep-release-images-in-ghcr-and-deploy-by-digest.md)
- [Verify application rollback after failed deployment](adr/0013-verify-application-rollback-after-failed-deployment.md)
- [Keep release credentials in caller environments](adr/0014-keep-release-credentials-in-caller-environments.md)
- [Use manual, trusted Mac mini fallback for PR validation](adr/0015-use-manual-trusted-mac-mini-fallback-for-pr-validation.md)
- [Publish the generic baseline as a public repository](adr/0016-publish-the-generic-baseline-as-a-public-repository.md)
- [Support the current baseline major without runtime expiry](adr/0017-support-the-current-baseline-major-without-runtime-expiry.md)
- [Require a changeset on pull requests by default](adr/0018-require-a-changeset-on-pull-requests-by-default.md)
