# Publish application releases after deployment

Application release tags and GitHub Releases will be published only after the corresponding production deployment succeeds, preserving the applications' existing success-only publication policy. This makes publication evidence that a version has reached production successfully rather than merely being available for deployment. Release tooling must support that ordering; version bookkeeping and recovery from failed deployment or publication remain separate design decisions.
