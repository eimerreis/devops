# Release from default-branch changes

Ordinary code changes reach the default branch through checked pull requests, where pending changesets initiate a release without an additional release pull request. Without pending release changesets, CI still runs but both production deployment and release creation are skipped; absence alone is a valid no-release signal and does not block a pull request. The dedicated App may bypass the ordinary pull-request path for generated version/changelog updates and consumed changesets, committing that metadata before the release build and deployment.

Amended by [ADR-0018](0018-require-a-changeset-on-pull-requests-by-default.md): pull requests must add a changeset by default. Having none pending on the default branch still skips the release.
