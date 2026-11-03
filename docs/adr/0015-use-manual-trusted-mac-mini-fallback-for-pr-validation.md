# Use manual, trusted Mac mini fallback for PR validation

PR validation should use GitHub-hosted capacity where supported and covered by the included allowance, with native configuration manually selecting the Mac mini for new runs when that allowance is exhausted. This avoids an automatic billing router while retaining a free execution path, restricted to private, same-repository pull requests; fork PRs must not use the production host. This is a trusted-contributor boundary, not host isolation: self-hosted execution shares the production Mac's persistent user account and Docker access.
