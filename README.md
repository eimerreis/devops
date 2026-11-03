# devops

A shared GitHub Actions delivery baseline for application repositories, starting with container services running on the Mac mini.

The confirmed design is the v1 requirements brief. This repository currently contains the design, glossary, and architectural decisions; implementation is organized through GitHub issues.

## Delivery contract

- Applications keep ownership of their languages, frameworks, and commands. Shared workflows enforce validation and release stages.
- Ordinary changes arrive through checked pull requests. Changesets declare version bumps and changelog entries; there is no separate release PR. Without pending changesets, CI runs and production stays unchanged.
- Release automation records version metadata before building, stores private images in GHCR, deploys by digest, and publishes tags/releases only after health verification.
- Failed deployments attempt verified application rollback and hold later releases until owner-controlled retry or supersession.
- Hosted validation uses the included allowance, with a manual Mac mini fallback restricted to private, same-repository PRs.
- Baseline updates arrive as owner-reviewed, SHA-pinned upgrade PRs. V1 maintains the current major without a runtime expiry gate.

Host configuration remains in [mac-mini](https://github.com/eimerreis/mac-mini). Application configuration and credentials remain in each caller repository.

## Design and implementation

- [Confirmed v1 design](docs/delivery-baseline.md)
- [Domain glossary](GLOSSARY.md)
- [Architectural decision records](docs/adr/)

The pilot is djlib. Wider adoption follows isolated failure/retry/rollback rehearsals and a verified production pilot release. Platform-specific distribution remains application-owned.

## License

[MIT](LICENSE).
