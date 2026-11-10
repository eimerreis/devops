# devops

A shared GitHub Actions delivery baseline for application repositories, starting with container services running on the Mac mini.

The confirmed design is the v1 requirements brief. This repository contains the design, glossary, architectural decisions, and the [application delivery contract](docs/application-contract.md); remaining implementation is organized through GitHub issues.

## Delivery contract

- Applications keep ownership of their languages, frameworks, and commands. Shared workflows enforce validation and release stages.
- Ordinary changes arrive through checked pull requests. Changesets declare version bumps and changelog entries; there is no separate release PR. Pull requests must add one by default, with a per-repository opt-out and an exemption for dependency updates. Without pending changesets on the default branch, CI runs and production stays unchanged.
- Release automation records version metadata before building, stores private images in GHCR, deploys by digest, and publishes tags/releases only after health verification.
- Failed deployments attempt verified application rollback and hold later releases until owner-controlled retry or supersession.
- Hosted validation uses the included allowance, with a manual Mac mini fallback restricted to private, same-repository PRs.
- Baseline updates arrive as owner-reviewed, SHA-pinned upgrade PRs. V1 maintains the current major without a runtime expiry gate.

Host configuration remains in [mac-mini](https://github.com/eimerreis/mac-mini). Application configuration and credentials remain in each caller repository.

## Design and implementation

- [Confirmed v1 design](docs/delivery-baseline.md)
- [v1.0.0 milestone](https://github.com/eimerreis/devops/milestone/1) and [dependency-ordered implementation plan](docs/implementation-plan.md)
- [Application delivery contract](docs/application-contract.md)
- [Release App guide](docs/release-app.md)
- [Domain glossary](GLOSSARY.md)
- [Architectural decision records](docs/adr/)

The pilot is djlib. Wider adoption follows isolated failure/retry/rollback rehearsals and a verified production pilot release. Platform-specific distribution remains application-owned.

Start with [#1: the application delivery contract](https://github.com/eimerreis/devops/issues/1). Each implementation issue includes acceptance criteria and native dependency links.

## Development

```sh
npm ci --ignore-scripts
npm test
```

## License

[MIT](LICENSE).
