import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { CatalogError } from "./catalog.js";

const identity = z.string().min(1).max(256);
const diagnostic = z.strictObject({
  code: z.string().min(1).max(128),
  message: z.string().max(4096),
});
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const media = z.strictObject({
  bytes: z
    .string()
    .max(19)
    .refine((value) => /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value))),
  sha256: hash,
});
const published = z.strictObject({
  kind: z.enum(["primary", "camera"]),
  sourceId: identity,
  sourceDurationUs: z.int().positive(),
  originHostUs: z.int().nonnegative(),
  binding: z
    .strictObject({ recordingId: identity, sourceId: identity, deviceId: identity })
    .optional(),
  diagnostic: diagnostic.optional(),
  journal: z.strictObject({
    file: z.enum(["source.journal.jsonl", "capture.journal.jsonl"]),
    bytes: z.int().positive().max(268_435_456),
    sha256: hash,
    lastSequence: z.int().positive(),
    layout: z.union([z.literal(1), z.literal(2)]),
  }),
  members: z.strictObject({
    "video.mov": media,
    "narration.mov": media.optional(),
    "system.mov": media.optional(),
    "narration.publication.json": media.optional(),
    "system.publication.json": media.optional(),
    "camera.publication.json": media.optional(),
    "camera.mapping.jsonl": media.optional(),
  }),
});
const outcome = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("published"), source: published }),
  z.strictObject({
    state: z.literal("pending"),
    error: diagnostic.extend({ retryable: z.boolean() }),
  }),
  z.strictObject({ state: z.literal("unavailable"), error: diagnostic }),
]);
const observation = z.strictObject({
  generation: identity,
  sourceId: identity,
  inputsClosed: z.boolean(),
  primary: outcome.nullable(),
  camera: outcome.nullable(),
});
export type CapturePublishedSource = z.infer<typeof published>;
export type CaptureSourceAuthority = {
  source: CapturePublishedSource;
  receipt: { bytes: string; sha256: string };
};
export type CapturePublication = z.infer<typeof observation>;
export type CaptureSourceOutcome = z.infer<typeof outcome>;
export function readCaptureSourceOutcome(value: unknown): CaptureSourceOutcome | null {
  const parsed = outcome.nullable().safeParse(value);
  if (!parsed.success)
    throw new CatalogError(
      "MEDIA_WORKER_FAILED",
      "Source recovery returned an invalid publication outcome",
    );
  return parsed.data;
}
export type CapturePublicationState = {
  observation: CapturePublication;
  authorities: Partial<Record<"primary" | "camera", CapturePublishedSource>>;
};

/** Receipt identity survives operational refusal; its latest verified availability can still change. */
export function readCapturePublication(
  value: unknown,
  allocation: {
    recordingId: string;
    sourceId: string;
    camera: { sourceId: string; deviceId: string } | null;
  },
  previous: CapturePublicationState | null,
): CapturePublicationState {
  const parsed = observation.safeParse(value);
  if (!parsed.success)
    throw new CatalogError(
      "INVALID_PARAMS",
      "Capture publication must be a bounded source observation",
    );
  const current = parsed.data;
  const prior = previous?.observation;
  const authorities = { ...previous?.authorities };
  if (
    current.sourceId !== allocation.sourceId ||
    (prior &&
      (current.generation !== prior.generation || (prior.inputsClosed && !current.inputsClosed)))
  )
    throw new CatalogError(
      "INVALID_STATE",
      "Publication belongs to another take or reopens closed inputs",
    );
  if (
    (!current.inputsClosed && (current.primary !== null || current.camera !== null)) ||
    (allocation.camera === null && current.camera !== null)
  )
    throw new CatalogError("INVALID_STATE", "Source publication requires closed allocated inputs");
  for (const kind of ["primary", "camera"] as const) {
    const source = current[kind];
    const before = prior?.[kind];
    if (before?.state === "unavailable" && !isDeepStrictEqual(before, source))
      throw new CatalogError("INVALID_STATE", "Terminal source unavailability is immutable");
    if (source?.state !== "published") continue;
    const receipt = source.source;
    if (authorities[kind] && !isDeepStrictEqual(authorities[kind], receipt))
      throw new CatalogError("INVALID_STATE", "Published source authority is immutable");
    const expectedId = kind === "primary" ? allocation.sourceId : allocation.camera?.sourceId;
    const expectedBinding =
      kind === "primary"
        ? undefined
        : { recordingId: allocation.recordingId, ...allocation.camera! };
    if (
      receipt.kind !== kind ||
      receipt.sourceId !== expectedId ||
      !isDeepStrictEqual(receipt.binding, expectedBinding)
    )
      throw new CatalogError(
        "INVALID_STATE",
        "Published source differs from allocated source/device authority",
      );
    const camera = kind === "camera";
    if (
      receipt.journal.file !== (camera ? "capture.journal.jsonl" : "source.journal.jsonl") ||
      receipt.journal.layout !== (camera ? 1 : 2) ||
      Boolean(receipt.members["camera.publication.json"]) !== camera ||
      Boolean(receipt.members["camera.mapping.jsonl"]) !== camera
    )
      throw new CatalogError(
        "INVALID_STATE",
        "Published source has invalid journal or proof members",
      );
    for (const role of ["narration", "system"] as const)
      if (
        Boolean(receipt.members[`${role}.mov`]) !==
          Boolean(receipt.members[`${role}.publication.json`]) ||
        (camera && receipt.members[`${role}.mov`])
      )
        throw new CatalogError("INVALID_STATE", "Published source has invalid audio members");
    authorities[kind] = receipt;
  }
  return { observation: current, authorities };
}
