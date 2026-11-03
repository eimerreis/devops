# Release from default-branch changes

Ordinary code changes reach the default branch through checked pull requests, where pending changesets initiate a release without an additional release pull request. Without pending release changesets, CI still runs but both production deployment and release creation are skipped; absence alone is a valid no-release signal and does not block a pull request. The dedicated App may bypass the ordinary pull-request path for generated version/changelog updates and consumed changesets, committing that metadata before the release build and deployment.
