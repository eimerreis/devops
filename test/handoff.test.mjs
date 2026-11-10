import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateApplication, validateImageManifest, validatePreparedRelease } from "../src/contract.mjs";

const fixture = fileURLToPath(new URL("../fixtures/independent-units", import.meta.url));
const revision = "a".repeat(40);
const producedBy = { workflowRef: "example/platform/.github/workflows/release.yml@refs/heads/main", runId: "123", runAttempt: 1 };
const prepared = () => structuredClone({
  schemaVersion: 1,
  repository: "example/platform",
  releaseUnit: "api",
  version: "2.2.0",
  tag: "api-v2.2.0",
  sourceRevision: revision,
  baselineRevision: "b".repeat(40),
  producedBy,
});
const manifest = () => structuredClone({
  schemaVersion: 1,
  repository: "example/platform",
  releaseUnit: "api",
  version: "2.2.0",
  sourceRevision: revision,
  images: [{ name: "api", repository: "ghcr.io/example/platform-api", digest: `sha256:${"c".repeat(64)}` }],
  // A retry may attach a later attempt of the same run; the source revision is what must match.
  producedBy: { ...producedBy, runAttempt: 2 },
});

describe("job handoff data", () => {
  let contract;
  before(async () => {
    ({ contract } = await validateApplication(fixture));
  });

  test("accepts a consistent prepared release and manifest", () => {
    assert.deepEqual(validatePreparedRelease(prepared(), contract), []);
    assert.deepEqual(validateImageManifest(manifest(), prepared(), contract), []);
  });

  const preparedCases = [
    ["a short source revision", (p) => { p.sourceRevision = "abc123"; }, /sourceRevision/],
    ["a prerelease version", (p) => { p.version = "2.2.0-rc.1"; }, /version/],
    ["a missing run identity", (p) => { delete p.producedBy.runId; }, /runId/],
    ["an unknown release unit", (p) => { p.releaseUnit = "other"; }, /unknown release unit/],
    ["a tag that ignores the unit prefix", (p) => { p.tag = "v2.2.0"; }, /should be "api-v2.2.0"/],
  ];
  for (const [description, edit, expected] of preparedCases) {
    test(`rejects a prepared release with ${description}`, () => {
      const data = prepared();
      edit(data);
      assert.match(validatePreparedRelease(data, contract).join("\n"), expected);
    });
  }

  const manifestCases = [
    ["a different source revision", (m) => { m.sourceRevision = "d".repeat(40); }, /sourceRevision/],
    ["a different version", (m) => { m.version = "2.2.1"; }, /version/],
    ["a different release unit", (m) => { m.releaseUnit = "worker"; }, /releaseUnit/],
    ["a mutable tag instead of a digest", (m) => { m.images[0].digest = "latest"; }, /digest/],
    ["no images", (m) => { m.images = []; }, /images/],
    ["an undeclared image", (m) => { m.images[0].name = "other"; }, /not declared/],
    ["a declared image's wrong repository", (m) => { m.images[0].repository = "ghcr.io/example/other"; }, /not declared/],
    ["a duplicated image", (m) => { m.images.push(m.images[0]); }, /duplicate image/],
  ];
  for (const [description, edit, expected] of manifestCases) {
    test(`rejects a manifest with ${description}`, () => {
      const data = manifest();
      edit(data);
      assert.match(validateImageManifest(data, prepared(), contract).join("\n"), expected);
    });
  }
});
