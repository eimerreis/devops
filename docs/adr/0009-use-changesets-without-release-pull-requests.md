# Use Changesets without release pull requests

The applications need shared version calculation and changelog generation without adding a separate release-review step. Use Changesets' CLI from the shared workflows to calculate versions, generate changelogs, and consume changesets, while retaining the agreed direct-to-default-branch metadata commits and publish-after-verified-deployment ordering. This replaces duplicated custom planners with an established engine, while preparation, deployment, and publication orchestration remain responsibilities of the shared workflows.
