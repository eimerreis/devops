import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse } from "yaml";
import { REQUIRED_CHECKS, verifyBaselinePin } from "../src/contract.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
const workflowDirectory = join(repository, ".github/workflows");
const readWorkflow = (file) => parse(readFileSync(file, "utf8"));
const workflowFiles = readdirSync(workflowDirectory).map((name) => join(workflowDirectory, name));
const contractWorkflow = readWorkflow(join(workflowDirectory, "contract.yml"));
const caller = readWorkflow(join(repository, "examples/callers/delivery.yml"));

function usesReferences(workflow) {
  return Object.values(workflow.jobs).flatMap((job) => [job.uses, ...(job.steps ?? []).map((step) => step.uses)]).filter(Boolean);
}

describe("workflow boundary", () => {
  test("external actions and workflows are pinned to immutable revisions", () => {
    const examples = ["delivery.yml", "dependency-maintenance.yml"].map((name) => join(repository, "examples/callers", name));
    for (const file of [...workflowFiles, ...examples]) {
      for (const reference of usesReferences(readWorkflow(file))) {
        if (reference.startsWith("./")) continue;
        assert.match(reference, /(@[0-9a-f]{40}|@sha256:[0-9a-f]{64})$/, `${file}: ${reference}`);
      }
    }
  });

  test("the thin caller only delegates to the shared workflow", () => {
    const jobs = Object.values(caller.jobs);
    assert.equal(jobs.length, 1);
    assert.deepEqual(Object.keys(jobs[0]).sort(), ["name", "uses"]);
    assert.deepEqual(caller.permissions, { contents: "read" });
    assert.deepEqual(Object.keys(caller.on), ["pull_request"]);
    assert.equal(caller.on.pull_request, null, "path filters would leave a required check pending");
  });

  test("the required check name matches the caller and shared job names", () => {
    const name = `${Object.values(caller.jobs)[0].name} / ${contractWorkflow.jobs.contract.name}`;
    assert.equal(name, REQUIRED_CHECKS.contract);
  });

  test("helper code is checked out from the shared workflow's own revision", () => {
    const steps = contractWorkflow.jobs.contract.steps;
    const baseline = steps.find((step) => step.with?.path === "baseline");
    assert.equal(baseline.with.repository, "${{ job.workflow_repository }}");
    assert.equal(baseline.with.ref, "${{ job.workflow_sha }}");
    const verification = steps.findIndex((step) => step.run?.includes("verify-pin"));
    const validation = steps.findIndex((step) => step.run?.includes(" validate "));
    assert.ok(verification !== -1 && verification < validation, "the pin must be verified before validation");
  });

  test("the contract job does not grant write access or run application commands", () => {
    assert.deepEqual(contractWorkflow.permissions, { contents: "read" });
    const steps = contractWorkflow.jobs.contract.steps;
    for (const step of steps.filter((candidate) => candidate.uses?.startsWith("actions/checkout"))) {
      assert.equal(step.with["persist-credentials"], false);
    }
    assert.equal(steps.find((step) => step.run?.startsWith("npm ")).run, "npm ci --ignore-scripts --omit=dev");
  });
});

describe("dependency maintenance", () => {
  const workflow = readWorkflow(join(workflowDirectory, "dependency-maintenance.yml"));
  const example = readWorkflow(join(repository, "examples/callers/dependency-maintenance.yml"));

  test("no checkout leaves a token in the git config for the agent", () => {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of (job.steps ?? []).filter((candidate) => candidate.uses?.startsWith("actions/checkout"))) {
        assert.equal(step.with["persist-credentials"], false);
      }
    }
  });

  test("helper scripts come from the shared workflow's own revision", () => {
    for (const job of Object.values(workflow.jobs)) {
      const baseline = job.steps.find((step) => step.with?.repository === "${{ job.workflow_repository }}");
      assert.equal(baseline.with.ref, "${{ job.workflow_sha }}");
    }
  });

  test("the workflow token stays read-only; writes use the caller's bot token", () => {
    assert.deepEqual(workflow.permissions, { contents: "read" });
    assert.deepEqual(example.permissions, { contents: "read" });
    assert.deepEqual(Object.keys(workflow.on.workflow_call.secrets).sort(), ["ANTHROPIC_API_KEY", "DEPENDENCY_BOT_TOKEN"]);
  });

  test("pull requests are handled one at a time", () => {
    assert.equal(workflow.jobs.maintain.strategy["max-parallel"], 1);
  });
});

describe("baseline pin verification", () => {
  const sha = "a".repeat(40);
  const pinned = {
    workflowRepository: "eimerreis/devops",
    workflowRef: `eimerreis/devops/.github/workflows/contract.yml@${sha}`,
    workflowSha: sha,
    checkoutSha: sha,
    callerRepository: "example/app",
  };

  test("accepts a caller pinned to the running revision", () => {
    assert.deepEqual(verifyBaselinePin(pinned), []);
  });

  for (const moving of ["refs/heads/main", "refs/tags/v1.0.0", "main", "a".repeat(7)]) {
    test(`rejects an application using ${moving}`, () => {
      const workflowRef = `eimerreis/devops/.github/workflows/contract.yml@${moving}`;
      assert.match(verifyBaselinePin({ ...pinned, workflowRef }).join(), /must be pinned/);
    });
  }

  test("rejects helper code from a different revision", () => {
    assert.match(verifyBaselinePin({ ...pinned, checkoutSha: "b".repeat(40) }).join(), /Helper code is from/);
  });

  test("rejects a reference outside the baseline repository", () => {
    assert.match(verifyBaselinePin({ ...pinned, workflowRef: `other/repo/x.yml@${sha}` }).join(), /not in the baseline/);
  });

  test("rejects a missing workflow SHA", () => {
    assert.match(verifyBaselinePin({ ...pinned, workflowSha: "" }).join(), /Invalid/);
  });

  test("lets only the baseline repository test itself from a branch", () => {
    const workflowRef = "eimerreis/devops/.github/workflows/contract.yml@refs/heads/feature";
    assert.deepEqual(verifyBaselinePin({ ...pinned, workflowRef, callerRepository: "eimerreis/devops" }), []);
  });
});
