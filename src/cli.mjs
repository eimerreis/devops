#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { validateApplication, validateImageManifest, validatePreparedRelease, verifyBaselinePin } from "./contract.mjs";

const USAGE = `Usage:
  delivery-contract validate [--root DIR]
  delivery-contract validate-prepared --prepared FILE [--root DIR]
  delivery-contract validate-manifest --manifest FILE --prepared FILE [--root DIR]
  delivery-contract verify-pin --workflow-repository R --workflow-ref REF --workflow-sha SHA --checkout-sha SHA --caller-repository R`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string", default: "." },
    prepared: { type: "string" },
    manifest: { type: "string" },
    "workflow-repository": { type: "string" },
    "workflow-ref": { type: "string" },
    "workflow-sha": { type: "string" },
    "checkout-sha": { type: "string" },
    "caller-repository": { type: "string" },
  },
});

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const commands = {
  async validate() {
    return (await validateApplication(values.root)).errors;
  },
  async "validate-prepared"() {
    const { contract, errors } = await validateApplication(values.root);
    return errors.length ? errors : validatePreparedRelease(readJson(values.prepared), contract);
  },
  async "validate-manifest"() {
    const { contract, errors } = await validateApplication(values.root);
    return errors.length ? errors : validateImageManifest(readJson(values.manifest), readJson(values.prepared), contract);
  },
  async "verify-pin"() {
    return verifyBaselinePin({
      workflowRepository: values["workflow-repository"],
      workflowRef: values["workflow-ref"],
      workflowSha: values["workflow-sha"],
      checkoutSha: values["checkout-sha"],
      callerRepository: values["caller-repository"],
    });
  },
};

const command = commands[positionals[0]];
if (!command) {
  console.error(USAGE);
  process.exit(2);
}
const errors = await command();
for (const error of errors) console.error(error);
process.exitCode = errors.length ? 1 : 0;
