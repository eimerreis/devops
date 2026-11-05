# Release App

One GitHub App writes release metadata for every repository on the delivery baseline ([ADR-0008](adr/0008-use-a-dedicated-app-for-release-writes.md)). Create it once, then enroll each repository. Run these steps as the account owner.

[`app/release-app.manifest.json`](../app/release-app.manifest.json) defines the App: Contents and Workflows write, no webhook, no Administration permission, and installable only on this account.

## Create the App

```sh
node scripts/create-release-app.mjs [path/for/private-key.pem]
```

Open the printed local URL, confirm on GitHub, and return to the terminal. The script prints the App ID and saves the private key with mode `0600`, by default to `~/.config/release-app/release-app.pem`. It never overwrites an existing key or prints the key.

GitHub allows this step once per App name. To change an existing App, use its settings page.

## Enroll a repository

Enrollment is explicit: installing the App doesn't turn on any workflow or rule. Do this in the repository's adoption pull request.

**1. Install the App on the repository** from the install URL the script printed, choosing **Only select repositories**.

**2. Create the release environment**, limited to the actual default branch:

```sh
repo=eimerreis/example
branch=main

gh api -X PUT "repos/$repo/environments/release" --input - <<'EOF'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF
gh api -X POST "repos/$repo/environments/release/deployment-branch-policies" -f name="$branch" -f type=branch
```

A private repository needs GitHub Pro or higher for environment secrets and deployment branches.

**3. Add the credentials to that environment**, not to the repository:

```sh
gh secret set RELEASE_APP_ID --repo "$repo" --env release --body "<app id>"
gh secret set RELEASE_APP_PRIVATE_KEY --repo "$repo" --env release < path/to/private-key.pem
```

**4. Give the App the exception on each ruleset that protects the default branch.** Do this only after the repository's required validation workflow is verified.

```sh
ruleset_id=<id from: gh api repos/$repo/rulesets>
app_id=<app id>

gh api "repos/$repo/rulesets/$ruleset_id" \
  | jq --argjson app "$app_id" '{name, target, enforcement, conditions, rules,
      bypass_actors: (.bypass_actors + [{actor_id: $app, actor_type: "Integration", bypass_mode: "always"}])}' \
  | gh api -X PUT "repos/$repo/rulesets/$ruleset_id" --input -
```

**5. Use the App from the release job**, with the job in the `release` environment and the token narrowed to what the job needs:

```yaml
jobs:
  release:
    environment: release
    steps:
      - uses: actions/create-github-app-token@<full commit SHA>
        id: app
        with:
          app-id: ${{ secrets.RELEASE_APP_ID }}
          private-key: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
          repositories: ${{ github.event.repository.name }}
          permission-contents: write
```

The action revokes the token when the job ends. Add `permission-workflows: write` only to a job that has to write against a commit with changed workflow files.

## What the App can do

- **The exception covers the whole App.** GitHub can't limit the bypass to metadata files, so each workflow must check what it's about to commit and reject anything else ([ADR-0008](adr/0008-use-a-dedicated-app-for-release-writes.md)).
- **The private key reaches every installation.** A narrower job token doesn't narrow the key. Anyone with the key can mint a token for any enrolled repository, write to it and edit its workflows, past its rulesets ([ADR-0014](adr/0014-keep-release-credentials-in-caller-environments.md)).
- **Environments limit which branch gets the secrets.** They don't isolate a self-hosted runner: a job on the persistent Mac user shares that account and its Docker access with other jobs.

## Rotate or revoke

Each App can hold several private keys. Using a separate key per repository doesn't reduce a key's authority, but it lets you replace one leaked key without touching the other repositories.

**Rotate:** in the App's settings under **Private keys**, generate a new key, update `RELEASE_APP_PRIVATE_KEY` in each environment that uses the old one, run a release, then delete the old key.

**After a suspected leak:**

1. Delete the key in the App's settings. This stops new tokens straight away.
2. Installation tokens already minted stay valid for up to an hour. To end them sooner, suspend or uninstall the App's installations.
3. Review recent commits and releases in every enrolled repository, not only the one that leaked.
4. Generate a new key and update each environment.

**Remove a repository:** remove it from the App's installation, delete its `release` environment, and take the App off its rulesets.
