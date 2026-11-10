import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { CONTRACT_PATH, validateApplication } from "../src/contract.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
const changesetBin = join(repository, "node_modules/@changesets/cli/bin.js");
const temporary = mkdtempSync(join(tmpdir(), "delivery-contract-"));
after(() => rmSync(temporary, { recursive: true, force: true }));

let copies = 0;
function copyFixture(name) {
  const target = join(temporary, `${name}-${++copies}`);
  cpSync(join(repository, "fixtures", name), target, { recursive: true });
  return target;
}
const readJson = (root, file) => JSON.parse(readFileSync(join(root, file), "utf8"));
const writeJson = (root, file, data) => writeFileSync(join(root, file), JSON.stringify(data));
function editContract(root, edit) {
  const file = join(root, CONTRACT_PATH);
  const contract = parse(readFileSync(file, "utf8"));
  edit(contract);
  writeFileSync(file, stringify(contract));
}
function editConfig(root, edit) {
  const config = readJson(root, ".changeset/config.json");
  edit(config);
  writeJson(root, ".changeset/config.json", config);
}
function addChangeset(root, name, bump) {
  writeFileSync(join(root, ".changeset/pending.md"), `---\n"${name}": ${bump}\n---\n\nA user-facing note.\n`);
}
function versionPackages(root) {
  execFileSync("git", ["init", "-q"], { cwd: root });
  const result = spawnSync(process.execPath, [changesetBin, "version"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

describe("release-unit fixtures", () => {
  for (const name of ["single-product", "multi-workspace-product", "independent-units"]) {
    test(`${name} is valid`, async () => {
      assert.deepEqual((await validateApplication(join(repository, "fixtures", name))).errors, []);
    });
  }

  test("an empty changeset is accepted and releases nothing", async () => {
    const root = copyFixture("single-product");
    writeFileSync(join(root, ".changeset/empty.md"), "---\n---\n\nDocumentation only.\n");
    assert.deepEqual((await validateApplication(root)).errors, []);
    versionPackages(root);
    assert.equal(readJson(root, "package.json").version, "1.4.0");
  });

  test("the changeset requirement can be turned off", async () => {
    const root = copyFixture("single-product");
    editContract(root, (c) => { c.changesets = { requireOnPullRequests: false }; });
    assert.deepEqual((await validateApplication(root)).errors, []);
  });

  test("a single product versions its package", async () => {
    const root = copyFixture("single-product");
    addChangeset(root, "notes-service", "minor");
    assert.deepEqual((await validateApplication(root)).errors, []);
    versionPackages(root);
    assert.equal(readJson(root, "package.json").version, "1.5.0");
  });

  test("a multi-workspace product leaves internal packages unversioned", async () => {
    const root = copyFixture("multi-workspace-product");
    addChangeset(root, "@product/web", "patch");
    assert.deepEqual((await validateApplication(root)).errors, []);
    versionPackages(root);
    assert.equal(readJson(root, "apps/web/package.json").version, "0.9.1");
    assert.equal(readJson(root, "packages/tooling/package.json").version, "0.1.0");
    assert.equal(readJson(root, "packages/lib/package.json").version, undefined);
  });

  test("independent units release separately, without their shared package", async () => {
    const root = copyFixture("independent-units");
    addChangeset(root, "@platform/api", "minor");
    assert.deepEqual((await validateApplication(root)).errors, []);
    versionPackages(root);
    assert.equal(readJson(root, "apps/api/package.json").version, "2.2.0");
    assert.equal(readJson(root, "apps/worker/package.json").version, "0.3.0");
    assert.equal(readJson(root, "packages/shared/package.json").version, "1.0.0");
  });
});

describe("rejected configuration", () => {
  const multi = "multi-workspace-product";
  const independent = "independent-units";
  const unit = (contract) => contract.releaseUnits[0];
  const cases = [
    ["a missing validation gate", multi, (root) => editContract(root, (c) => delete c.validation.test), /required property 'test'/],
    ["a gate with both a command and an exception", multi, (root) => editContract(root, (c) => { c.validation.test = { run: "x", exempt: "y" }; }), /oneOf/],
    ["an exception without a reason", multi, (root) => editContract(root, (c) => { c.validation.test = { exempt: " " }; }), /validation\/test/],
    ["an unknown property", multi, (root) => editContract(root, (c) => { c.typo = true; }), /additional properties/],
    ["a release unit without a rollback command", multi, (root) => editContract(root, (c) => delete unit(c).rollback), /rollback/],
    ["a non-GHCR image repository", multi, (root) => editContract(root, (c) => { unit(c).images[0].repository = "docker.io/a/b"; }), /repository/],
    ["an image repository with a moving tag", multi, (root) => editContract(root, (c) => { unit(c).images[0].repository = "ghcr.io/a/b:latest"; }), /repository/],
    ["an image context outside the repository", multi, (root) => editContract(root, (c) => { unit(c).images[0].context = "../other"; }), /context/],
    ["a missing Dockerfile", multi, (root) => editContract(root, (c) => { unit(c).images[0].dockerfile = "missing/Dockerfile"; }), /does not exist/],
    ["an unknown Changesets package", multi, (root) => editContract(root, (c) => { unit(c).changesetPackage = "@product/nope"; }), /not in the workspace/],
    ["a workspace root as the release package", multi, (root) => editContract(root, (c) => { unit(c).changesetPackage = "library-product"; }), /workspace root cannot carry/],
    ["an unversioned release package", multi, (root) => editContract(root, (c) => { unit(c).changesetPackage = "@product/lib"; }), /needs a semantic version/],
    ["a package version below the declared initial version", multi, (root) => editContract(root, (c) => { unit(c).initialVersion = "1.0.0"; }), /below initialVersion/],
    ["duplicate unit ids", independent, (root) => editContract(root, (c) => { c.releaseUnits[1].id = c.releaseUnits[0].id; }), /Duplicate release unit id/],
    ["one package in two units", independent, (root) => editContract(root, (c) => { c.releaseUnits[1].changesetPackage = c.releaseUnits[0].changesetPackage; }), /more than one release unit/],
    ["duplicate tag prefixes", independent, (root) => editContract(root, (c) => { c.releaseUnits[1].tagPrefix = c.releaseUnits[0].tagPrefix; }), /Duplicate tag prefix/],
    ["duplicate image repositories", independent, (root) => editContract(root, (c) => { c.releaseUnits[1].images[0].repository = c.releaseUnits[0].images[0].repository; }), /used more than once/],
    ["a versioned internal package that is not ignored", multi, (root) => editConfig(root, (c) => { c.ignore = []; }), /"@product\/tooling" could be released accidentally/],
    ["an ignored release package", multi, (root) => editConfig(root, (c) => { c.ignore.push("@product/web"); }), /is listed in the Changesets "ignore"/],
    ["Changesets committing on its own", multi, (root) => editConfig(root, (c) => { c.commit = true; }), /"commit" must be false/],
    ["private packages excluded from versioning", multi, (root) => editConfig(root, (c) => { c.privatePackages.version = false; }), /"privatePackages.version" must be true/],
    ["Changesets tagging private packages", multi, (root) => editConfig(root, (c) => { c.privatePackages.tag = true; }), /"privatePackages.tag" must be false/],
    ["independent units in a fixed group", independent, (root) => editConfig(root, (c) => { c.fixed = [["@platform/api", "@platform/worker"]]; }), /must not be in "fixed"/],
    ["independent units in a linked group", independent, (root) => editConfig(root, (c) => { c.linked = [["@platform/api", "@platform/worker"]]; }), /must not be in "linked"/],
    ["an invalid Changesets option", multi, (root) => editConfig(root, (c) => { c.access = "nope"; }), /config\.json.*access/s],
    ["a pending changeset naming an internal package", multi, (root) => addChangeset(root, "@product/tooling", "minor"), /"@product\/tooling" is not a release unit package/],
    ["a non-boolean changeset requirement", multi, (root) => editContract(root, (c) => { c.changesets = { requireOnPullRequests: "no" }; }), /requireOnPullRequests/],
    ["an unknown changesets option", multi, (root) => editContract(root, (c) => { c.changesets = { required: true }; }), /additional properties/],
    ["a missing contract", multi, (root) => rmSync(join(root, CONTRACT_PATH)), /file not found/],
    ["a duplicate YAML key", multi, (root) => writeFileSync(join(root, CONTRACT_PATH), "schemaVersion: 1\nschemaVersion: 1\n"), /unique/i],
  ];

  for (const [description, fixture, breakIt, expected] of cases) {
    test(description, async () => {
      const root = copyFixture(fixture);
      breakIt(root);
      const { errors } = await validateApplication(root);
      assert.ok(errors.length, "expected validation to fail");
      assert.match(errors.join("\n"), expected);
    });
  }

  test("a missing Changesets configuration", async () => {
    const root = copyFixture(multi);
    rmSync(join(root, ".changeset/config.json"));
    const { errors } = await validateApplication(root);
    assert.match(errors.join("\n"), /config\.json/);
  });
});
