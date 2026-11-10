import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import readChangesets from "@changesets/read";
import { readConfig } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";
import { Ajv2020 } from "ajv/dist/2020.js";
import semver from "semver";
import { parse as parseYaml } from "yaml";

export const CONTRACT_PATH = ".github/delivery-baseline.yml";

// Required-check names are "<caller job name> / <shared job name>". Rulesets depend on these staying stable.
export const REQUIRED_CHECKS = Object.freeze({
  contract: "baseline / contract",
  validate: "baseline / validate",
});

const schemaDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");
const readSchema = (name) => JSON.parse(readFileSync(join(schemaDirectory, name), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(readSchema("prepared-release.schema.json"));
const validators = {
  application: ajv.compile(readSchema("application.schema.json")),
  prepared: ajv.getSchema("https://github.com/eimerreis/devops/schemas/prepared-release.schema.json"),
  manifest: ajv.compile(readSchema("image-manifest.schema.json")),
};

function schemaErrors(validator, data, label) {
  if (validator(data)) return [];
  return validator.errors.map((error) => `${label}${error.instancePath || ""}: ${error.message}`);
}

function duplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

/** Parses and schema-validates the application contract without reading anything else in the repository. */
export function parseContract(text) {
  let contract;
  try {
    contract = parseYaml(text);
  } catch (error) {
    return { errors: [`${CONTRACT_PATH}: ${error.message}`] };
  }
  const errors = schemaErrors(validators.application, contract, CONTRACT_PATH);
  return errors.length ? { errors } : { contract, errors: [] };
}

function unitConsistencyErrors(contract, root) {
  const units = contract.releaseUnits;
  const images = units.flatMap((unit) => unit.images);
  const errors = [
    ...duplicates(units.map((unit) => unit.id)).map((id) => `Duplicate release unit id "${id}".`),
    ...duplicates(units.map((unit) => unit.changesetPackage)).map(
      (name) => `Changesets package "${name}" is mapped to more than one release unit.`,
    ),
    ...duplicates(units.map((unit) => unit.tagPrefix)).map((prefix) => `Duplicate tag prefix "${prefix}".`),
    ...duplicates(images.map((image) => image.name)).map((name) => `Duplicate image name "${name}".`),
    ...duplicates(images.map((image) => image.repository)).map(
      (repository) => `Image repository "${repository}" is used more than once.`,
    ),
  ];
  for (const unit of units) {
    for (const image of unit.images) {
      for (const field of ["dockerfile", "context"]) {
        if (!existsSync(join(root, image[field]))) {
          errors.push(`Release unit "${unit.id}" image "${image.name}": ${field} "${image[field]}" does not exist.`);
        }
      }
    }
  }
  return errors;
}

function changesetsConsistencyErrors(contract, packages, config) {
  const errors = [];
  const unitPackages = new Set(contract.releaseUnits.map((unit) => unit.changesetPackage));
  const byName = new Map(packages.packages.map((pkg) => [pkg.packageJson.name, pkg]));
  const ignored = new Set(config.ignore);

  if (config.commit !== false) {
    errors.push('.changeset/config.json: "commit" must be false; the release App records the metadata commit.');
  }
  if (config.privatePackages.tag !== false) {
    errors.push('.changeset/config.json: "privatePackages.tag" must be false; tags are published after verified deployment.');
  }

  for (const unit of contract.releaseUnits) {
    const name = unit.changesetPackage;
    const pkg = byName.get(name);
    if (!pkg) {
      const hint = packages.rootPackage?.packageJson.name === name
        ? " A workspace root cannot carry a release; map the unit to a workspace package."
        : "";
      errors.push(`Release unit "${unit.id}": Changesets package "${name}" is not in the workspace.${hint}`);
      continue;
    }
    const { version, private: isPrivate } = pkg.packageJson;
    if (!semver.valid(version)) {
      errors.push(`Release unit "${unit.id}": package "${name}" needs a semantic version, found "${version}".`);
    } else if (semver.lt(version, unit.initialVersion)) {
      errors.push(`Release unit "${unit.id}": package version ${version} is below initialVersion ${unit.initialVersion}.`);
    }
    if (ignored.has(name)) {
      errors.push(`Release unit "${unit.id}": package "${name}" is listed in the Changesets "ignore" option.`);
    }
    if (isPrivate && config.privatePackages.version !== true) {
      errors.push(`Release unit "${unit.id}": package "${name}" is private, so "privatePackages.version" must be true.`);
    }
  }

  // Changesets skips unversioned packages itself. Anything else it could bump must be excluded on purpose.
  for (const pkg of packages.packages) {
    const { name, version } = pkg.packageJson;
    if (version !== undefined && !unitPackages.has(name) && !ignored.has(name)) {
      errors.push(`Internal package "${name}" could be released accidentally; add it to the Changesets "ignore" option.`);
    }
  }

  // Independently released units must not be version-coupled.
  for (const [option, groups] of [["fixed", config.fixed], ["linked", config.linked]]) {
    for (const group of groups) {
      const coupled = group.filter((name) => unitPackages.has(name));
      if (coupled.length) {
        errors.push(`.changeset/config.json: release unit packages must not be in "${option}": ${coupled.join(", ")}.`);
      }
    }
  }
  return errors;
}

async function pendingChangesetErrors(root, contract) {
  const unitPackages = new Set(contract.releaseUnits.map((unit) => unit.changesetPackage));
  const errors = [];
  // Changesets exits successfully and leaves a changeset naming an ignored package pending, so no release would apply it.
  for (const changeset of await readChangesets(root)) {
    for (const release of changeset.releases) {
      if (!unitPackages.has(release.name)) {
        errors.push(`.changeset/${changeset.id}.md: "${release.name}" is not a release unit package.`);
      }
    }
  }
  return errors;
}

/** Validates the application contract and its consistency with the workspace and Changesets configuration. */
export async function validateApplication(root) {
  const contractFile = join(root, CONTRACT_PATH);
  if (!existsSync(contractFile)) return { errors: [`${CONTRACT_PATH}: file not found.`] };
  const { contract, errors } = parseContract(readFileSync(contractFile, "utf8"));
  if (errors.length) return { errors };

  const unitErrors = unitConsistencyErrors(contract, root);
  let packages;
  try {
    packages = await getPackages(root);
  } catch (error) {
    return { errors: [...unitErrors, `Could not read the workspace: ${error.message}`] };
  }
  let result;
  try {
    result = await readConfig(root, packages);
  } catch (error) {
    return { errors: [...unitErrors, `.changeset/config.json: ${error.message}`] };
  }
  if (result.errors) {
    return { errors: [...unitErrors, ...result.errors.map((error) => `.changeset/config.json: ${error}`)] };
  }
  const allErrors = [
    ...unitErrors,
    ...changesetsConsistencyErrors(contract, packages, result.config),
    ...(await pendingChangesetErrors(root, contract)),
  ];
  return allErrors.length ? { errors: allErrors } : { contract, errors: [] };
}

/** Validates a prepared release against the application contract. */
export function validatePreparedRelease(prepared, contract) {
  const errors = schemaErrors(validators.prepared, prepared, "prepared release");
  if (errors.length) return errors;
  const unit = contract.releaseUnits.find((candidate) => candidate.id === prepared.releaseUnit);
  if (!unit) return [`prepared release: unknown release unit "${prepared.releaseUnit}".`];
  const expectedTag = `${unit.tagPrefix}${prepared.version}`;
  return prepared.tag === expectedTag ? [] : [`prepared release: tag "${prepared.tag}" should be "${expectedTag}".`];
}

/** Validates that an image manifest belongs to a prepared release and covers exactly the unit's declared images. */
export function validateImageManifest(manifest, prepared, contract) {
  const errors = [
    ...validatePreparedRelease(prepared, contract),
    ...schemaErrors(validators.manifest, manifest, "image manifest"),
  ];
  if (errors.length) return errors;
  for (const field of ["repository", "releaseUnit", "version", "sourceRevision"]) {
    if (manifest[field] !== prepared[field]) {
      errors.push(`image manifest: ${field} "${manifest[field]}" does not match the prepared release "${prepared[field]}".`);
    }
  }
  const declared = contract.releaseUnits.find((unit) => unit.id === prepared.releaseUnit).images;
  const identity = (image) => `${image.name} (${image.repository})`;
  const declaredIds = new Set(declared.map(identity));
  const recordedIds = manifest.images.map(identity);
  for (const id of duplicates(recordedIds)) errors.push(`image manifest: duplicate image ${id}.`);
  for (const id of recordedIds) {
    if (!declaredIds.has(id)) errors.push(`image manifest: image ${id} is not declared by the release unit.`);
  }
  for (const id of declaredIds) {
    if (!recordedIds.includes(id)) errors.push(`image manifest: declared image ${id} is missing.`);
  }
  return errors;
}

/**
 * Confirms this helper code came from the revision the caller pinned. A caller outside the baseline repository
 * must reference a full commit SHA. Only the baseline's own workflows may run from a branch, to test themselves.
 */
export function verifyBaselinePin({ workflowRepository, workflowRef, workflowSha, checkoutSha, callerRepository }) {
  if (!/^[0-9a-f]{40}$/.test(workflowSha ?? "")) return [`Invalid baseline workflow SHA "${workflowSha}".`];
  const errors = [];
  if (checkoutSha !== workflowSha) {
    errors.push(`Helper code is from ${checkoutSha}, but the shared workflow is from ${workflowSha}.`);
  }
  if (!workflowRef?.startsWith(`${workflowRepository}/`)) {
    errors.push(`Workflow ref "${workflowRef}" is not in the baseline repository "${workflowRepository}".`);
  }
  const pin = workflowRef?.slice(workflowRef.lastIndexOf("@") + 1);
  if (callerRepository !== workflowRepository && pin !== workflowSha) {
    errors.push(`The baseline must be pinned to a full commit SHA, but "${callerRepository}" uses "${pin}".`);
  }
  return errors;
}
