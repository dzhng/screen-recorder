import { z } from "zod";
import { CompositionError } from "./errors.js";
import { audioContextSchema, type CompiledAudio, type CompiledFrame } from "./compiled-records.js";
import { type ValidatedComposition } from "./model.js";
import { processingInstructionSchema, type ProcessingInstruction } from "./processing-plan.js";
import type { audioContexts } from "./audio-context.js";
import { sampleAt } from "./sample-clock.js";
import { compare, fromTime, toTime } from "./rational.js";
import {
  compositionSchema,
  isMediaClip,
  mediaClipSchema,
  processingStepSchema,
  processingTargetSchema,
  rangeSchema,
  selectionRangeSchema,
} from "./schema.js";

const id = z.string().min(1);
export const processingTapSchema = z
  .object({
    target: processingTargetSchema,
    point: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("dry") }).strict(),
      z.object({ kind: z.literal("processed") }).strict(),
      z.object({ kind: z.literal("after-step"), stepId: id }).strict(),
    ]),
  })
  .strict();
export type ProcessingTap = z.infer<typeof processingTapSchema>;
export const executionWindowRequestSchema = z
  .object({
    range: rangeSchema,
    rendition: z.object({ sampleRate: z.literal(48000), channels: z.literal(2) }).strict(),
    tap: processingTapSchema,
  })
  .strict();
const source = z
  .object({
    clipId: id,
    assetId: id,
    streamId: id,
    source: mediaClipSchema.shape.source,
    placement: selectionRangeSchema,
    pitch: z.enum(["preserve", "follow"]).optional(),
    context: z.array(audioContextSchema).readonly().optional(),
  })
  .strict();
export const executionWindowManifestSchema = z
  .object({
    revisionId: id,
    sampleRange: z
      .object({
        start: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        end: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      })
      .strict()
      .refine((value) => value.end >= value.start),
    ...executionWindowRequestSchema.shape,
    canvas: compositionSchema.shape.canvas,
    mediaKind: z.enum(["audio", "video", "output"]),
    sources: z.array(source),
    processing: z.array(processingInstructionSchema),
    requirements: z.array(
      z.discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("executor"),
            mediaKind: z.enum(["audio", "video"]),
            implementationId: z.string().min(1).nullable(),
          })
          .strict(),
        z
          .object({
            kind: z.literal("processor"),
            target: processingTargetSchema,
            stepId: id,
            processor: processingStepSchema.shape.processor,
            implementationId: z.string().min(1).nullable(),
          })
          .strict(),
        z
          .object({
            kind: z.literal("retime"),
            clipId: id,
            sampleCount: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
            pitch: z.enum(["preserve", "follow"]),
            implementationId: z.string().min(1).nullable(),
          })
          .strict(),
      ]),
    ),
  })
  .strict();
export type ExecutionWindowManifest = z.infer<typeof executionWindowManifestSchema>;
export function requireWindowReady(manifest: ExecutionWindowManifest): void {
  const requirements = manifest.requirements.filter(
    (requirement) => requirement.implementationId === null,
  );
  if (!requirements.length) return;
  throw new CompositionError(
    "NOT_READY",
    "Native execution and preparation are not bound to this window",
    { requirements },
  );
}

export function executionWindow(
  revisionId: string,
  canvas: ValidatedComposition["document"]["canvas"],
  request: z.infer<typeof executionWindowRequestSchema>,
  clips: ValidatedComposition["clips"],
  processing: ProcessingInstruction[],
  contexts: ReturnType<typeof audioContexts>,
  schedules: {
    frames(range: z.infer<typeof rangeSchema>): Generator<CompiledFrame>;
    audio(range: z.infer<typeof rangeSchema>, sampleRate: number): Generator<CompiledAudio>;
  },
) {
  const mediaKind = processing.at(-1)!.mediaKind;
  const sources: ExecutionWindowManifest["sources"] = [];
  const requirements: ExecutionWindowManifest["requirements"] = [];
  for (const kind of ["audio", "video"] as const)
    if (mediaKind === "output" || mediaKind === kind)
      requirements.push({ kind: "executor", mediaKind: kind, implementationId: null });
  for (const node of processing)
    for (const step of node.steps)
      if (step.enabled)
        requirements.push({
          kind: "processor",
          target: node.target,
          stepId: step.id,
          processor: step.processor,
          implementationId: null,
        });
  for (const value of clips) {
    const clip = value.clip;
    if (!isMediaClip(clip)) continue;
    sources.push({
      clipId: clip.id,
      assetId: clip.assetId,
      streamId: clip.streamId,
      source: clip.source,
      placement: { startUs: toTime(value.range.start), endUs: toTime(value.range.end) },
      ...(value.track.kind === "audio"
        ? {
            pitch: clip.pitch ?? "preserve",
            context: contexts(value, request.range, request.rendition.sampleRate),
          }
        : {}),
    });
    if (value.track.kind === "audio" && value.rate && compare(value.rate, fromTime(1)) !== 0) {
      const sample = (at: typeof value.range.start) =>
        (at.numerator * BigInt(request.rendition.sampleRate)) / (at.denominator * 1000000n);
      const count = sample(value.range.end) - sample(value.range.start);
      if (count > BigInt(Number.MAX_SAFE_INTEGER))
        throw new CompositionError(
          "INVALID_TIME",
          "Prepared audio sample count exceeds safe-integer precision",
        );
      requirements.push({
        kind: "retime",
        clipId: clip.id,
        sampleCount: Number(count),
        pitch: clip.pitch ?? "preserve",
        implementationId: null,
      });
    }
  }
  const manifest = executionWindowManifestSchema.parse({
    revisionId,
    ...request,
    sampleRange: {
      start: sampleAt(fromTime(request.range.startUs), request.rendition.sampleRate),
      end: sampleAt(fromTime(request.range.endUs), request.rendition.sampleRate),
    },
    canvas,
    mediaKind,
    sources,
    processing,
    requirements,
  });
  return {
    manifest,
    *frames(): Generator<CompiledFrame> {
      if (mediaKind === "audio") return;
      yield* schedules.frames(request.range);
    },
    *audio(): Generator<CompiledAudio> {
      if (mediaKind === "video") return;
      yield* schedules.audio(request.range, request.rendition.sampleRate);
    },
  };
}
