import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { failure, runJsonHelper } from "./inspection-artifacts.mjs";
import { routeUseCase } from "./use-case-routing.mjs";

const states = new Set(["clean", "relocated"]);
const statusValues = new Set(["unverified", "not-run"]);

function require(condition, code, message) {
  if (!condition) throw failure(code, message);
}

function inside(root, path) {
  const child = relative(root, path);
  return child === "" || (!child.startsWith("..") && !child.startsWith("/"));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

async function identify(path, label) {
  require(typeof path === "string" &&
    isAbsolute(path), "INVALID_REQUEST", `${label} must be absolute`);
  const resolved = resolve(path);
  let before;
  try {
    before = await lstat(resolved);
  } catch (error) {
    throw failure("SOURCE_UNAVAILABLE", `${label} is unavailable: ${error.message}`);
  }
  require(before.isFile() &&
    !before.isSymbolicLink(), "INVALID_SOURCE", `${label} must be a regular file`);
  const digest = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(resolved)) {
      bytes += chunk.length;
      digest.update(chunk);
    }
  } catch (error) {
    throw failure("SOURCE_UNAVAILABLE", `${label} could not be read: ${error.message}`);
  }
  const after = await lstat(resolved);
  require(after.isFile() &&
    !after.isSymbolicLink() &&
    after.size === before.size &&
    after.mtimeNs ===
      before.mtimeNs, "ARTIFACT_CHANGED", `${label} changed while it was being identified`);
  require(bytes === before.size, "ARTIFACT_CHANGED", `${label} ended before its declared size`);
  return { path: resolved, bytes, sha256: digest.digest("hex") };
}

function parseCoverage(coverage) {
  require(coverage &&
    typeof coverage === "object" &&
    !Array.isArray(coverage), "INVALID_REQUEST", "coverage is required");
  for (const name of ["capabilityRouting", "sourceIdentity", "deliveryIdentity"])
    require(coverage[name] === "verified", "COVERAGE_INCOMPLETE", `${name} must be verified`);
  for (const name of ["native", "visual", "audio"])
    require(statusValues.has(
      coverage[name],
    ), "COVERAGE_OVERCLAIM", `${name} must remain unverified for this check`);
  require(coverage.humanQaRequired ===
    false, "HUMAN_QA_REQUIRED", "Human QA cannot be an acceptance prerequisite");
  return { ...coverage };
}

async function inspectRun(run, index) {
  require(run &&
    typeof run === "object" &&
    !Array.isArray(run), "INVALID_REQUEST", `run ${index} is invalid`);
  require(states.has(run.state), "INVALID_REQUEST", `run ${index} must be clean or relocated`);
  require(typeof run.root === "string" &&
    isAbsolute(run.root), "INVALID_REQUEST", `run ${index} root must be absolute`);
  const root = resolve(run.root);
  const rootStat = await lstat(root).catch((error) => {
    throw failure("STATE_UNAVAILABLE", `run ${index} root is unavailable: ${error.message}`);
  });
  require(rootStat.isDirectory() &&
    !rootStat.isSymbolicLink(), "STATE_UNAVAILABLE", `run ${index} root must be a directory`);
  require(run.brief &&
    typeof run.brief === "object", "INVALID_REQUEST", `run ${index} brief is required`);
  const brief = await identify(run.brief.path, `run ${index} brief`);
  require(Array.isArray(run.sources) &&
    run.sources.length > 0, "INVALID_REQUEST", `run ${index} needs at least one source`);
  const keys = new Set();
  const sources = [];
  for (const [sourceIndex, source] of run.sources.entries()) {
    require(source &&
      typeof source === "object" &&
      typeof source.key === "string" &&
      source.key.length > 0, "INVALID_REQUEST", `run ${index} source ${sourceIndex} needs a key`);
    require(!keys.has(source.key), "INVALID_REQUEST", `run ${index} repeats source ${source.key}`);
    keys.add(source.key);
    const identity = await identify(source.path, `run ${index} source ${source.key}`);
    sources.push({ key: source.key, ...identity });
  }
  require(run.selection &&
    typeof run.selection === "object", "INVALID_REQUEST", `run ${index} selection is required`);
  require(run.recipe &&
    typeof run.recipe === "object", "INVALID_REQUEST", `run ${index} recipe is required`);
  const selection = canonical(run.selection);
  const recipe = canonical(run.recipe);
  require(run.delivery &&
    typeof run.delivery === "object", "INVALID_REQUEST", `run ${index} delivery is required`);
  require(run.delivery.parity ===
    "byte-exact", "PARITY_UNSUPPORTED", "Only byte-exact delivery replay is accepted");
  const delivery = await identify(run.delivery.path, `run ${index} delivery`);
  require(inside(
    root,
    delivery.path,
  ), "INVALID_SOURCE", `run ${index} delivery must stay in its managed root`);
  require(sources.every(
    (source) => source.path !== delivery.path,
  ), "INVALID_SOURCE", `run ${index} overwrites a source`);
  return {
    state: run.state,
    root,
    brief,
    sources,
    selectionSha256: createHash("sha256").update(selection).digest("hex"),
    recipeSha256: createHash("sha256").update(recipe).digest("hex"),
    delivery: { ...delivery, parity: run.delivery.parity },
  };
}

/**
 * Check the identity boundary of two agent-produced delivery runs. This does
 * not decode media, run models, or accept a human watching/listening result.
 */
export async function verifyFreshDelivery(request = {}) {
  require(request &&
    typeof request === "object" &&
    !Array.isArray(request), "INVALID_REQUEST", "Supply a JSON object");
  require(request.version === 1, "INVALID_REQUEST", "Unsupported fresh-delivery receipt version");
  require(typeof request.useCase === "string", "INVALID_REQUEST", "useCase is required");
  const reference = await routeUseCase(
    {
      useCase: request.useCase,
      ...(request.referenceRoot ? { referenceRoot: request.referenceRoot } : {}),
    },
    request.referenceRoot,
  );
  const coverage = parseCoverage(request.coverage);
  require(Array.isArray(request.runs) &&
    request.runs.length ===
      2, "REPLAY_INCOMPLETE", "Exactly clean and relocated runs are required");
  const runs = await Promise.all(request.runs.map(inspectRun));
  require(new Set(runs.map((run) => run.state)).size ===
    2, "REPLAY_INCOMPLETE", "Runs must contain one clean and one relocated state");
  const [first, second] = runs;
  require(first.brief.sha256 ===
    second.brief.sha256, "REPLAY_MISMATCH", "Brief identity differs between runs");
  require(first.sources.length === second.sources.length &&
    first.sources.every(
      (source, index) =>
        source.key === second.sources[index].key && source.sha256 === second.sources[index].sha256,
    ), "REPLAY_MISMATCH", "Source identities differ between runs");
  require(first.selectionSha256 ===
    second.selectionSha256, "REPLAY_MISMATCH", "Selection differs between runs");
  require(first.recipeSha256 ===
    second.recipeSha256, "REPLAY_MISMATCH", "Recipe differs between runs");
  require(first.delivery.sha256 ===
    second.delivery.sha256, "REPLAY_MISMATCH", "Delivery bytes differ between runs");
  return {
    version: 1,
    scope: "fresh-agent delivery identity and replay",
    useCase: request.useCase,
    route: reference.route,
    provenance: reference.provenance,
    policy: reference.policy,
    coverage,
    runs,
    comparison: {
      briefIdentity: true,
      sourceIdentity: true,
      selectionIdentity: true,
      recipeIdentity: true,
      deliveryIdentity: true,
      semanticPictureAudio: "unverified",
      nativeReadiness: "unverified",
    },
    sourceMediaPreserved: true,
  };
}

if (import.meta.main) {
  if (process.argv.includes("--help"))
    console.log(
      "Usage: node fresh-delivery-check.mjs < receipt.json\nChecks two clean/relocated agent runs by hashes and keeps native, visual and audio acceptance explicitly unverified.",
    );
  else await runJsonHelper(verifyFreshDelivery);
}
