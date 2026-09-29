import { pointerSchema } from "./pointer.js";
import { geometrySchemaWithScalars } from "./geometry.js";
import { z } from "zod";
import { compare, fromTime } from "./rational.js";

const time = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = time.positive();
const id = z.string().min(1);
export const rangeSchema = z
  .object({ startUs: time, endUs: time })
  .strict()
  .refine((value) => value.startUs < value.endUs, "Expected positive half-open range");
export const fractionSchema = z
  .object({ numerator: time, denominator: positive })
  .strict()
  .refine(({ numerator, denominator }) => {
    let a = BigInt(numerator),
      b = BigInt(denominator);
    while (b) [a, b] = [b, a % b];
    return a === 1n;
  }, "Expected reduced fraction");
/** Integer command times stay compact; edits retain exact sub-microsecond boundaries. */
export const timeValueSchema = z.union([
  time,
  fractionSchema.refine((value) => value.denominator > 1, "Use an integer for whole microseconds"),
]);
export type TimeValue = z.infer<typeof timeValueSchema>;
const selectionBoundsSchema = z
  .object({ startUs: timeValueSchema, endUs: timeValueSchema })
  .strict();
export const selectionRangeSchema = selectionBoundsSchema.refine(
  (value) => compare(fromTime(value.startUs), fromTime(value.endUs)) < 0,
  {
    message: "Expected positive half-open range",
    // Zod may continue refinements after scalar constraint failures.
    when: ({ value }) => selectionBoundsSchema.safeParse(value).success,
  },
);
export type SelectionRange = z.infer<typeof selectionRangeSchema>;
export const anchorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), range: selectionRangeSchema }).strict(),
  z.object({ kind: z.literal("content"), clipId: id, sourceRange: selectionRangeSchema }).strict(),
  z
    .object({ kind: z.literal("clip"), clipId: id, start: fractionSchema, end: fractionSchema })
    .strict()
    .refine(
      ({ start, end }) =>
        start.numerator <= start.denominator &&
        end.numerator <= end.denominator &&
        BigInt(start.numerator) * BigInt(end.denominator) <
          BigInt(end.numerator) * BigInt(start.denominator),
      "Expected ordered clip fractions within [0,1]",
    ),
]);
const finite = z.number().finite();
const handle = finite.min(0).max(1);
export const interpolationSchema = z.union([
  z.enum(["hold", "linear"]),
  z.object({ cubic: z.tuple([handle, finite, handle, finite]).readonly() }).strict(),
]);
/** Authoring key times use exactly the anchor's domain; evaluation may be fractional. */
export function scalarCurveSchema(domain: "project" | "content" | "clip") {
  const at =
    domain === "clip"
      ? fractionSchema.refine(
          (value) => value.numerator <= value.denominator,
          "Expected clip fraction within [0,1]",
        )
      : z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const keys = z
    .array(z.object({ at, value: finite, interpolation: interpolationSchema }).strict())
    .min(1)
    .readonly();
  return z
    .object({ keys })
    .strict()
    .refine(
      (value) =>
        value.keys.every(
          (key, index) =>
            index === 0 || compare(fromTime(value.keys[index - 1]!.at), fromTime(key.at)) < 0,
        ),
      {
        message: "Expected strictly ordered curve keys",
        when: ({ value }) => z.object({ keys }).safeParse(value).success,
      },
    );
}
export type ScalarCurve = z.infer<ReturnType<typeof scalarCurveSchema>>;

const clipFields = { id, trackId: id, placement: anchorSchema };
export const mediaClipSchema = z
  .object({
    ...clipFields,
    assetId: id,
    streamId: id,
    acquisitionId: id.optional(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("range"), range: selectionRangeSchema }).strict(),
      z.object({ kind: z.literal("hold"), atUs: time }).strict(),
    ]),
    pitch: z.enum(["preserve", "follow"]).optional(),
  })
  .strict();
export const silenceClipSchema = z
  .object({ ...clipFields, source: z.object({ kind: z.literal("silence") }).strict() })
  .strict();
export const fontReferenceSchema = z.object({ assetId: id, postScriptName: id }).strict();
export const textSourceSchema = z
  .object({
    kind: z.literal("text"),
    text: z.string().max(8192),
    font: fontReferenceSchema,
    width: positive.max(4096),
    height: positive.max(4096),
    size: finite.positive().max(512),
    color: z.string().regex(/^#[0-9a-fA-F]{8}$/),
    alignment: z.enum(["left", "center", "right"]),
    wrap: z.boolean(),
  })
  .strict();
export const textSeedSchema = z
  .object({
    kind: z.literal("transcript"),
    source: mediaClipSchema.pick({ assetId: true, streamId: true, acquisitionId: true }),
    generation: id,
    occurrenceClipId: id,
    words: z
      .array(z.object({ ordinal: time, sourceRange: rangeSchema }).strict())
      .min(1)
      .max(1000)
      .readonly(),
  })
  .strict();
export const textSeedCueSchema = textSeedSchema
  .omit({ kind: true })
  .extend({
    words: textSeedSchema.shape.words.unwrap(),
    trackId: id,
    label: id.optional(),
    separator: z.string().max(32),
    anchor: z.enum(["project", "content", "clip"]),
    style: textSourceSchema.omit({ kind: true, text: true }),
  })
  .strict();
export const textSeedCuesSchema = z
  .array(textSeedCueSchema)
  .min(1)
  .max(1000)
  .refine(
    (cues) => cues.reduce((count, cue) => count + cue.words.length, 0) <= 10000,
    "Text seed batch exceeds 10000 word pins",
  );
export const textClipSchema = z
  .object({ ...clipFields, source: textSourceSchema, seed: textSeedSchema.optional() })
  .strict();
export const clipSchema = z.union([mediaClipSchema, silenceClipSchema, textClipSchema]);
export const streamSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id,
      kind: z.literal("image"),
      width: z.number().finite().positive(),
      height: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("audio"),
      sampleRate: z.number().finite().positive().optional(),
      channels: z.int().positive().optional(),
      bounds: rangeSchema,
      available: z.array(rangeSchema),
    })
    .strict(),
  z
    .object({
      id,
      kind: z.literal("video"),
      width: z.number().finite().positive(),
      height: z.number().finite().positive(),
      pixelBounds: z
        .object({
          x: z.number().finite(),
          y: z.number().finite(),
          width: z.number().finite().positive(),
          height: z.number().finite().positive(),
        })
        .strict()
        .optional(),
      bounds: rangeSchema,
      available: z.array(rangeSchema),
    })
    .strict(),
]);
export const acquisitionContextSchema = z
  .object({
    id,
    bindings: z.array(
      z.object({ assetId: id, streamId: id, available: z.array(rangeSchema) }).strict(),
    ),
  })
  .strict();
export type AcquisitionContext = z.infer<typeof acquisitionContextSchema>;
export const assetSchema = z
  .object({ id, streams: z.array(streamSchema), fontFaces: z.array(id).optional() })
  .strict();
export const routingNodeSchema = z
  .object({
    id,
    kind: z.enum(["video", "audio"]),
    order: z.int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
    parentId: id.optional(),
  })
  .strict();
export const processingTargetSchema = z.union([
  z.object({ kind: z.enum(["clip", "track", "group"]), id }).strict(),
  z.object({ kind: z.literal("output") }).strict(),
]);
const allProcessingTargets = ["clip", "track", "group", "output"] as const;
export const processorRegistry = {
  rnnoise: {
    schema: z
      .object({ type: z.literal("rnnoise") })
      .strict()
      .describe(
        "Fixed 48 kHz RNNoise recipe over current connected state domains. Native execution requires verified mono sources or their structural dual-mono mix; stereo or unknown source layouts are refused. Availability is reported by execution and implementationId.",
      ),
    targets: allProcessingTargets,
    mediaKind: "audio" as const,
    units: {},
  },
  pointer: {
    schema: pointerSchema,
    mediaKind: "video" as const,
    targets: ["clip"] as const,
    requiresAcquisition: true,
    units: { trailUs: "source microseconds" },
  },
  geometry: {
    schema: geometrySchemaWithScalars({
      coordinate: z.union([
        z.number().finite(),
        scalarCurveSchema("project"),
        scalarCurveSchema("clip"),
      ]),
      size: z.union([
        z.number().finite().positive(),
        scalarCurveSchema("project"),
        scalarCurveSchema("clip"),
      ]),
      pivot: z.union([
        z.number().min(0).max(1),
        scalarCurveSchema("project"),
        scalarCurveSchema("clip"),
      ]),
    }),
    targets: allProcessingTargets,
    mediaKind: "video" as const,
    units: {
      crop: "preceding image pixels",
      rect: "canvas pixels",
      scale: "multiplier",
      rotationDeg: "clockwise degrees",
      pivot: "normalized rectangle",
    },
  },
  opacity: {
    schema: z
      .object({
        type: z.literal("opacity"),
        opacity: z.union([
          z.number().min(0).max(1),
          scalarCurveSchema("project"),
          scalarCurveSchema("clip"),
        ]),
      })
      .strict(),
    targets: allProcessingTargets,
    mediaKind: "video" as const,
    units: { opacity: "linear alpha multiplier" },
  },
  gain: {
    schema: z
      .object({
        type: z.literal("gain"),
        gain: z.union([
          z.number().finite().nonnegative(),
          scalarCurveSchema("project"),
          scalarCurveSchema("clip"),
        ]),
      })
      .strict(),
    targets: allProcessingTargets,
    mediaKind: "audio" as const,
    units: { gain: "linear multiplier" },
  },
};
export const processingStepSchema = z
  .object({
    id,
    enabled: z.boolean(),
    stateKey: id
      .describe(
        "Engine-owned shared-state membership. Existing get/set roundtrips may preserve it; omission retains it. Fresh authored steps must not supply it.",
      )
      .optional(),
    window: anchorSchema.optional(),
    evaluationRange: z
      .object({ start: fractionSchema, end: fractionSchema })
      .strict()
      .refine(
        ({ start, end }) =>
          start.numerator <= start.denominator &&
          end.numerator <= end.denominator &&
          BigInt(start.numerator) * BigInt(end.denominator) <
            BigInt(end.numerator) * BigInt(start.denominator),
        "Expected ordered evaluation fractions within [0,1]",
      )
      .optional(),
    processor: z.discriminatedUnion("type", [
      processorRegistry.rnnoise.schema,
      processorRegistry.pointer.schema,
      processorRegistry.gain.schema,
      processorRegistry.geometry.schema,
      processorRegistry.opacity.schema,
    ]),
  })
  .strict();
export const processingStackSchema = z
  .object({
    target: processingTargetSchema,
    steps: z.array(processingStepSchema).min(1),
  })
  .strict();
export type ProcessingTarget = z.infer<typeof processingTargetSchema>;
export type ProcessingStep = z.infer<typeof processingStepSchema>;
export const compositionSchema = z
  .object({
    canvas: z
      .object({
        width: positive,
        height: positive,
        fps: fractionSchema.refine((value) => value.numerator > 0),
        background: z.string().regex(/^#[0-9a-fA-F]{8}$/),
      })
      .strict(),
    tracks: z.array(routingNodeSchema),
    groups: z.array(routingNodeSchema),
    clips: z.array(clipSchema),
    syncGroups: z.array(z.object({ id, clipIds: z.array(id).min(2) }).strict()),
    processing: z.array(processingStackSchema),
  })
  .strict();

export type Range = z.infer<typeof rangeSchema>;
export type Fraction = z.infer<typeof fractionSchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type MediaClip = z.infer<typeof mediaClipSchema>;
export type Clip = z.infer<typeof clipSchema>;
export function isMediaClip(clip: Clip): clip is MediaClip {
  return clip.source.kind === "range" || clip.source.kind === "hold";
}
export type Stream = z.infer<typeof streamSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Composition = z.infer<typeof compositionSchema>;

export type TextSource = z.infer<typeof textSourceSchema>;
export type TextSeed = z.infer<typeof textSeedSchema>;
export type TextSeedCue = z.infer<typeof textSeedCueSchema>;
export function clipAssetIds(clip: {
  source: Clip["source"];
  assetId?: string;
  seed?: Pick<TextSeed, "source"> | undefined;
}): string[] {
  return clip.source.kind === "text"
    ? [clip.source.font.assetId, ...(clip.seed ? [clip.seed.source.assetId] : [])]
    : clip.assetId === undefined
      ? []
      : [clip.assetId];
}
export function documentAssetIds(document: { clips: readonly Clip[] }): string[] {
  return [...new Set(document.clips.flatMap(clipAssetIds))];
}

export function documentAcquisitionIds(document: { clips: readonly Clip[] }): string[] {
  return [
    ...new Set(
      document.clips.flatMap((clip) => {
        const id = isMediaClip(clip)
          ? clip.acquisitionId
          : "seed" in clip
            ? clip.seed?.source.acquisitionId
            : undefined;
        return id ? [id] : [];
      }),
    ),
  ];
}
