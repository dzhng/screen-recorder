import { z } from "zod";
import { captureSelectionSchema } from "./capture.js";

const id = z.string().min(1);
const time = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const range = z.object({ startUs: time, endUs: time }).strict();
const cursorRange = range.refine(
  ({ startUs, endUs }) => endUs > startUs && endUs - startUs <= 60_000_000,
  { message: "Cursor range must be nonempty and no longer than 60 seconds" },
);
const recording = z.object({ recordingId: id }).strict();
const edit = recording.extend({ requestId: id, expectedRevisionId: id });
const historyCursor = z
  .object({
    recordingId: id,
    afterOrdinal: z.int().min(-1),
    throughOrdinal: z.int().min(-1),
  })
  .strict();

const frameParams = recording
  .extend({
    revisionId: id.optional(),
    atUs: time,
    clean: z.literal(true),
    maxLongEdge: z.int().min(1).max(8192).optional(),
    crop: z
      .object({
        x: z.int().nonnegative(),
        y: z.int().nonnegative(),
        width: z.int().positive(),
        height: z.int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();

const audioParams = recording
  .extend({
    revisionId: id.optional(),
    range: range.refine(({ startUs, endUs }) => endUs > startUs && endUs - startUs <= 30_000_000, {
      message: "Audio range must be positive and no longer than 30 seconds",
    }),
    track: z.enum(["narration", "system", "mix"]).default("mix"),
  })
  .strict();

// These are implemented capabilities. Adapters derive their advertised tools from
// the same schemas the service validates, rather than promising future operations.
export const operationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("frame.batch"),
      params: frameParams.extend({ atUs: z.array(time).min(1).max(8) }),
    })
    .strict()
    .describe(
      "Request one to eight ordered clean frames pinned to one revision. Each item retains its own readiness/error; duplicates reuse work. Poll the returned revision and retry individual failures with frame.retry.",
    ),
  z
    .object({ operation: z.literal("audio.get"), params: audioParams })
    .strict()
    .describe(
      "Request a WAVE excerpt in edited playback time, with explicit acquisition gaps and track availability. Pin the returned revision when polling.",
    ),
  z
    .object({ operation: z.literal("audio.retry"), params: audioParams })
    .strict()
    .describe("Explicitly retry failed audio excerpt processing for the same pinned request."),
  z
    .object({
      operation: z.literal("frame.get"),
      params: frameParams,
    })
    .strict()
    .describe(
      "Request a clean frame at edited playback time; pin the returned revision when polling pending work. The returned image has no pointer or trail overlay.",
    ),
  z
    .object({ operation: z.literal("frame.retry"), params: frameParams })
    .strict()
    .describe("Explicitly retry failed clean frame processing using the same pinned request."),
  z
    .object({
      operation: z.literal("artifact.read"),
      params: z
        .object({
          token: id,
          offset: time,
          maxBytes: z
            .int()
            .min(1)
            .max(512 * 1024)
            .default(512 * 1024),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Read a bounded base64 chunk from a ready media delivery; retrying an offset returns the same bytes.",
    ),
  z
    .object({ operation: z.literal("artifact.close"), params: z.object({ token: id }).strict() })
    .strict()
    .describe("Release a media delivery; closing it again succeeds."),
  z
    .object({
      operation: z.literal("cursor.raw"),
      params: recording
        .extend({
          sourceRange: cursorRange,
          cursor: z
            .object({
              recordingId: id,
              sourceId: id,
              generation: id,
              sourceRange: cursorRange,
              afterSequence: z.int().positive(),
            })
            .strict()
            .optional(),
          limit: z.int().min(1).max(5000).default(1000),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Page raw cursor observations in explicit source time, including retained integrity markers; edits do not alter these samples.",
    ),
  z
    .object({ operation: z.literal("processing.status"), params: recording })
    .strict()
    .describe("Read source-evidence processing state and its published generation."),
  z
    .object({
      operation: z.literal("processing.retry"),
      params: recording.extend({ artifact: z.literal("source") }).strict(),
    })
    .strict()
    .describe("Explicitly start or retry source-evidence processing; never duplicate active work."),
  z
    .object({ operation: z.literal("service.health"), params: z.object({}).strict() })
    .strict()
    .describe("Read local service readiness without starting capture."),
  z
    .object({ operation: z.literal("capture.sources"), params: z.object({}).strict() })
    .strict()
    .describe("List the displays and windows this host can capture."),
  z
    .object({
      operation: z.literal("capture.start"),
      params: captureSelectionSchema.extend({ requestId: id }).strict(),
    })
    .strict()
    .describe("Allocate a take and start capturing it; a repeated request ID replays one take."),
  z
    .object({ operation: z.literal("capture.status"), params: z.object({}).strict() })
    .strict()
    .describe("Read the capture device state and the take it is working on."),
  z
    .object({ operation: z.literal("capture.pause"), params: recording })
    .strict()
    .describe("Pause the named take; an already paused take answers with its current state."),
  z
    .object({ operation: z.literal("capture.resume"), params: recording })
    .strict()
    .describe("Resume the named take; an already recording take answers with its current state."),
  z
    .object({ operation: z.literal("capture.stop"), params: recording })
    .strict()
    .describe("Finalize the named take; a settled take answers with its stored outcome."),
  z
    .object({ operation: z.literal("capture.cancel"), params: recording })
    .strict()
    .describe("Discard the named take, remove its media, and drop it from discovery."),
  z
    .object({
      operation: z.literal("capture.restart"),
      params: captureSelectionSchema.extend({ recordingId: id, requestId: id }).strict(),
    })
    .strict()
    .describe("Discard the named take and start a distinct new one."),
  z
    .object({ operation: z.literal("recording.latest"), params: z.object({}).strict() })
    .strict()
    .describe("Read the newest discoverable take, including unfinished recordings."),
  z
    .object({
      operation: z.literal("recording.list"),
      params: z
        .object({
          cursor: z.object({ beforeSequence: z.int().positive() }).strict().nullable().optional(),
          limit: z.int().min(1).max(100).optional(),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Page through discoverable recordings newest first; continuation excludes newer takes.",
    ),
  z
    .object({ operation: z.literal("recording.get"), params: recording })
    .strict()
    .describe("Read one recording by its stable identity."),
  z
    .object({
      operation: z.literal("revision.get"),
      params: recording.extend({ revisionId: id.optional() }),
    })
    .strict()
    .describe("Read a specified revision, or resolve the current revision once."),
  z
    .object({
      operation: z.literal("revision.history"),
      params: recording.extend({
        cursor: historyCursor.nullable().optional(),
        limit: z.int().min(1).max(500).optional(),
      }),
    })
    .strict()
    .describe("Read a bounded page of history pinned to its initial revision ordinal."),
  z
    .object({ operation: z.literal("edit.trim"), params: edit.extend({ range }) })
    .strict()
    .describe("Keep a range in the expected revision's playback coordinates."),
  z
    .object({
      operation: z.literal("edit.cut"),
      params: edit.extend({ ranges: z.array(range).min(1).max(1000) }),
    })
    .strict()
    .describe("Remove ranges in the expected revision's playback coordinates."),
  z
    .object({ operation: z.literal("edit.undo"), params: edit })
    .strict()
    .describe("Undo the active edit by creating a new revision identity."),
  z
    .object({ operation: z.literal("edit.restore"), params: edit.extend({ targetRevisionId: id }) })
    .strict()
    .describe("Restore retained spans from a historical revision into a new revision."),
]);

export type SupportedOperation = z.infer<typeof operationSchema>;
export const operationNames: ReadonlySet<string> = new Set(
  operationSchema.options.map((option) => option.shape.operation.value),
);
