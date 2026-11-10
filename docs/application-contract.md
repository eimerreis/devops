# Application delivery contract

An application declares how it is validated and released in `.github/delivery-baseline.yml`. Shared workflows consume that declaration without taking ownership of the application's language, framework, or commands.

- [Application schema](../schemas/application.schema.json)
- [Prepared-release schema](../schemas/prepared-release.schema.json)
- [Image-manifest schema](../schemas/image-manifest.schema.json)
- [Fixtures](../fixtures/): a single product, a multi-workspace product, and independently released units
- [Thin caller example](../examples/callers/delivery.yml)

## Declaring an application

```yaml
schemaVersion: 1
setup: { run: pnpm install --frozen-lockfile }
changesets: { requireOnPullRequests: true }
validation:
  lint: { run: pnpm lint }
  typecheck: { exempt: Plain JavaScript without type annotations. }
  test: { run: pnpm test }
  build: { run: pnpm build }
  platforms:
    - { name: desktop-smoke, run: pnpm smoke }
releaseUnits:
  - id: library
    changesetPackage: "@product/web"
    initialVersion: 0.9.0
    tagPrefix: v
    images:
      - name: web
        repository: ghcr.io/example/library-web
        dockerfile: apps/web/Dockerfile
        context: .
    deploy: { run: bash deploy/deploy.sh }
    health: { run: bash deploy/health.sh }
    rollback: { run: bash deploy/rollback.sh }
```

`lint`, `typecheck`, `test`, and `build` are all required. Each one has either a `run` command or an `exempt` reason. `lint` covers format and lint checks. `platforms` adds applicable platform validation.

## Mapping release units to Changesets

Each release unit maps to exactly one Changesets package, and Changesets remains the version and changelog engine. The package's `package.json` version must be at or above the declared `initialVersion`. Set both from the application's existing release history during adoption, so its published sequence does not reset.

| Application | Mapping |
| --- | --- |
| Single product | The repository's package |
| Multi-workspace product | One workspace package carries the product's version |
| Independently released units | One workspace package per unit, with distinct `tagPrefix` values |

A workspace root cannot carry a release: Changesets reports it as not in the workspace. If no existing package suits a product, add a private workspace package containing only a name and version.

`.changeset/config.json` must set:

```json
{
  "commit": false,
  "privatePackages": { "version": true, "tag": false },
  "ignore": ["<every versioned internal package>"]
}
```

Validation rejects anything that could release an internal package or couple independent units:

- A versioned workspace package that is neither a release unit nor ignored. Changesets already skips unversioned packages.
- A pending changeset naming a package that is not a release unit. For an ignored package, Changesets exits successfully and leaves such a changeset pending, so no release would ever apply it.
- A release unit package in `ignore`, `fixed`, or `linked`.

Pull requests must add a changeset by default ([ADR-0018](adr/0018-require-a-changeset-on-pull-requests-by-default.md)). An empty changeset states that nothing ships. Dependency updates titled `chore(deps)` or `chore(deps-dev)` are exempt. Set `changesets.requireOnPullRequests: false` to opt the repository out; omitting it keeps the requirement. The shared validation workflow enforces it ([#2](https://github.com/eimerreis/devops/issues/2)). On the default branch, no pending changesets still means CI runs and production stays unchanged.

## Application commands

`setup`, gate, `deploy`, `health`, and `rollback` commands run from the application root. Their inputs arrive as environment variables, so that commands never need to parse shared workflow expressions.

| Command | Environment | Requirement |
| --- | --- | --- |
| `deploy` | `DELIVERY_RELEASE_UNIT`, `DELIVERY_VERSION`, `DELIVERY_SOURCE_REVISION`, `DELIVERY_IMAGE_MANIFEST` | Deploy the images by the manifest's digests. |
| `health` | `DELIVERY_RELEASE_UNIT`, `DELIVERY_VERSION`, `DELIVERY_SOURCE_REVISION` | Exit 0 only when the expected version is serving correctly. |
| `rollback` | `DELIVERY_RELEASE_UNIT`, `DELIVERY_ROLLBACK_IMAGE_MANIFEST`, `DELIVERY_ROLLBACK_VERSION` | Restore the last verified images. `health` then verifies them with the rollback version. |

`DELIVERY_IMAGE_MANIFEST` and `DELIVERY_ROLLBACK_IMAGE_MANIFEST` are paths to image-manifest JSON files.

## Data passed between jobs

A **prepared release** binds a unit's version and tag to the commit containing its generated release metadata, along with the baseline revision and workflow run that prepared it. An **image manifest** records the digests built for that release.

Later jobs must use these records rather than `github.sha` or a newly resolved default branch. `delivery-contract validate-manifest` rejects a manifest whose repository, unit, version, or source revision differs from its prepared release, and any manifest that does not cover exactly the images the unit declares. `producedBy` may differ between the two records, because a rerun has a later attempt.

```json
{
  "schemaVersion": 1,
  "repository": "example/platform",
  "releaseUnit": "api",
  "version": "2.2.0",
  "tag": "api-v2.2.0",
  "sourceRevision": "<40-character commit>",
  "baselineRevision": "<40-character commit>",
  "producedBy": {
    "workflowRef": "example/platform/.github/workflows/release.yml@refs/heads/main",
    "runId": "123",
    "runAttempt": 1
  }
}
```

```json
{
  "schemaVersion": 1,
  "repository": "example/platform",
  "releaseUnit": "api",
  "version": "2.2.0",
  "sourceRevision": "<40-character commit>",
  "images": [
    {
      "name": "api",
      "repository": "ghcr.io/example/platform-api",
      "digest": "sha256:<64 hexadecimal characters>"
    }
  ],
  "producedBy": {
    "workflowRef": "example/platform/.github/workflows/release.yml@refs/heads/main",
    "runId": "123",
    "runAttempt": 1
  }
}
```

## Caller and shared-workflow boundary

| Application repository | Baseline repository |
| --- | --- |
| A thin caller: triggers, SHA-pinned `uses`, and explicitly passed secrets | Job topology, ordering, and release rules |
| `.github/delivery-baseline.yml` and the commands it names | Schemas and contract validation |
| Changesets configuration and changesets | Running the Changesets CLI |
| Credentials in its release environment | Helper code, executed from the pinned revision |

Callers must not add path filters to the workflow providing a required check, because a skipped workflow leaves that check pending.

## Required checks

A required check is named `<caller job name> / <shared job name>`. Callers name their job `baseline`.

| Check | Status |
| --- | --- |
| `baseline / contract` | Available |
| `baseline / validate` | Reserved for the aggregate validation result from [#2](https://github.com/eimerreis/devops/issues/2) |

Rulesets require these names only. Individual gate and matrix jobs can change without changing a ruleset, and exempting a gate does not rename the aggregate check.

## Pinned helper code

A shared workflow checks out its helper code at `job.workflow_sha`, the commit of the workflow file defining the running job, and installs its locked dependencies without lifecycle scripts. `delivery-contract verify-pin` then fails the job unless:

- the helper checkout is that same commit, and
- a caller outside this repository referenced the workflow by that full commit SHA.

A branch or tag reference therefore fails, even if it resolves to the same commit. This repository's own CI is the only exception, because a commit cannot contain its own SHA.

The check confirms what the running workflow reports. It is not a boundary against a repository administrator changing the caller, as [ADR 0005](adr/0005-trust-workflow-definitions-for-initial-enforcement.md) accepts.

## Validating locally

From a checkout of this repository, at the revision the application pins:

```sh
npm ci --ignore-scripts --omit=dev
node src/cli.mjs validate --root /path/to/application
```
