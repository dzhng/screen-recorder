import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { failure, runJsonHelper } from "./inspection-artifacts.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const defaultReferenceRoot = resolve(root, "../references");
const routes = {
  launch: {
    reference: "launch-videos.md",
    purpose: "one product promise with visible proof and a truthful next action",
    ending: "benefit and next action",
    checks: [
      "capability discovery",
      "reference-conditioned picture and audio",
      "delivered opening, proof and ending",
    ],
  },
  podcast: {
    reference: "podcast-videos.md",
    purpose: "a complete interview exchange or episode introduction",
    ending: "answer and consequence, or a transition into the episode",
    checks: [
      "complete exchange",
      "declared source clocks and speaker evidence",
      "delivered joins, captions and encoded audio",
    ],
  },
  teaser: {
    reference: "teaser-videos.md",
    purpose: "one honest curiosity loop for a teaser or episode cold open",
    ending: "an open question or the truthful destination supplied by the brief",
    checks: [
      "complete question in context",
      "answer withheld only when the brief permits it",
      "no answer leak through captions, graphics or reactions",
    ],
  },
};

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const text = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * Select one focused consumer workflow and retain the exact reference identity.
 * This only routes and checks documentation; it does not inspect media, install
 * external capabilities, prepare models or make editorial decisions.
 */
export async function routeUseCase(request = {}, referenceRoot = defaultReferenceRoot) {
  if (!request || typeof request !== "object" || Array.isArray(request))
    throw failure("INVALID_REQUEST", "Supply a JSON object with useCase");
  if (!text(request.useCase) || !Object.hasOwn(routes, request.useCase))
    throw failure("INVALID_REQUEST", "useCase must be one of launch, podcast or teaser");
  if (!text(referenceRoot)) throw failure("INVALID_REQUEST", "referenceRoot must be a directory");
  const route = routes[request.useCase];
  const rootPath = resolve(referenceRoot);
  const indexPath = join(rootPath, "video-use-cases.md");
  const referencePath = join(rootPath, route.reference);
  let index, reference;
  try {
    [index, reference] = await Promise.all([readFile(indexPath), readFile(referencePath)]);
  } catch (error) {
    throw failure(
      "REFERENCE_UNAVAILABLE",
      `Focused use-case reference is unavailable: ${error.message}`,
    );
  }
  const indexText = index.toString("utf8");
  const referenceText = reference.toString("utf8");
  const link = `(${route.reference})`;
  if (!indexText.includes(link))
    throw failure("REFERENCE_INVALID", `${route.reference} is not linked from video-use-cases.md`);
  if (!referenceText.includes("## Start with the capability question"))
    throw failure("REFERENCE_INVALID", `${route.reference} lacks capability-first routing`);
  if (
    !referenceText.includes("## Finish and deliver") &&
    !referenceText.includes("## Verify the withheld beat") &&
    !referenceText.includes("## Sound, captions and picture")
  )
    throw failure("REFERENCE_INVALID", `${route.reference} lacks a delivered-output check`);
  const indexStat = await stat(indexPath);
  const referenceStat = await stat(referencePath);
  return {
    version: 1,
    useCase: request.useCase,
    route: {
      index: "references/video-use-cases.md",
      reference: `references/${route.reference}`,
      purpose: route.purpose,
      ending: route.ending,
      checks: route.checks,
    },
    provenance: {
      // Keep retained receipts portable when the installed skill's default
      // root was used; explicit roots remain evidence-backed absolute paths.
      referenceRoot: request.referenceRoot ? rootPath : "references",
      index: { bytes: indexStat.size, sha256: digest(index) },
      focusedReference: { bytes: referenceStat.size, sha256: digest(reference) },
    },
    policy: {
      capabilityQuestionFirst: true,
      firstPartyYapModelsPreparedWhenNeeded: true,
      externalCapabilitiesRecommendedOnlyWhenMateriallyRequired: true,
      humanQaRequired: false,
      sourceMediaPreserved: true,
    },
    scope:
      "routing only; media inspection, edits, delivery and visual/audio acceptance remain separate checks",
  };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    console.log(
      'Usage: node use-case-routing.mjs < request.json\nSupply {useCase:"launch"|"podcast"|"teaser", referenceRoot?:string}. Returns the exact focused reference identity and workflow checks; performs no media or installation work.',
    );
  } else await runJsonHelper((request) => routeUseCase(request, request.referenceRoot));
}
