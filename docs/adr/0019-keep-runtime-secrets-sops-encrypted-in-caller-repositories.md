# Keep runtime secrets SOPS-encrypted in caller repositories

Applications need runtime secrets (database passwords, API keys, SMTP credentials) on production and development hosts, and agents on development hosts must read them without an interactive unlock. GitHub Actions secrets cannot be read back, are duplicated per repository because personal accounts have no cross-repository store, and keep no history for rollback. Each participating repository will therefore keep its runtime secrets in `secrets/<environment>.enc.env`, encrypted with SOPS for age recipients listed in its `.sops.yaml`, and the deployment decrypts them on the target host. Pipeline credentials that only CI uses (the release App key, signing certificates, hosting tokens) stay in GitHub environments as decided in [ADR-0014](0014-keep-release-credentials-in-caller-environments.md).

## Considered Options

- **GitHub Actions secrets for everything**: no extra tooling, but write-only, copied into every repository and without history, so rotation and rollback depend on the operator remembering values.
- **1Password Service Accounts**: central and auditable, but every deployment and agent depends on the 1Password API at runtime, and the daily request limit of non-Business plans is shared by all hosts.
- **SOPS with age (chosen)**: no runtime service and full history in git; the cost is manual recipient management and no read audit log.

## Consequences

- Every host is a recipient with its own age key. The private key is generated on the host and never leaves it; a lost host gets a new key instead of a restored one.
- Recipients are scoped per environment file. Development hosts, where agents run, are never recipients of production files.
- Removing a recipient re-encrypts the files but does not revoke values the host has already decrypted. Removal requires rotating the secrets that host could read.
- The operator's own age key is the recovery path for every file and is kept in the operator's password manager.
- The `.enc.env` suffix keeps the dotenv extension, so SOPS encrypts each value separately and diffs stay readable; `.env.enc` would be treated as one binary blob.
