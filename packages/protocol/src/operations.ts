import { z } from "zod";
import { captureSelectionSchema } from "./capture.js";
import { DEFAULT_CALL_TIMEOUT_MS, MEDIA_WORKER_TIMEOUT_MS } from "./framing.js";

const id = z.string().min(1);
const time = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const range = z.object({ startUs: time, endUs: time }).strict();
const cursorRange = range.refine(
  ({ startUs, endUs }) => endUs > startUs && endUs - startUs <= 60_000_000,
  { message: "Cursor range must be nonempty and no longer than 60 seconds" },
);
const recording = z.object({ recordingId: id }).strict();
const packageTarget = z.object({ packageHandle: id }).strict();
const inspection = <T extends z.ZodRawShape>(shape: T) =>
  z.union([recording.extend(shape).strict(), packageTarget.extend(shape).strict()]);
const edit = recording.extend({ requestId: id, expectedRevisionId: id });
const historyPosition = {
  afterOrdinal: z.int().min(-1),
  throughOrdinal: z.int().min(-1),
};
const historyParams = <T extends z.ZodRawShape>(target: z.ZodObject<T>) =>
  target
    .extend({
      cursor: target.extend(historyPosition).strict().nullable().optional(),
      limit: z.int().min(1).max(500).optional(),
    })
    .strict();

const frameFields = {
  revisionId: id.optional(),
  atUs: time,
  clean: z.boolean().optional(),
  trailUs: time.max(10_000_000).optional(),
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
};
const frameParams = inspection(frameFields);

const audioParams = inspection({
  revisionId: id.optional(),
  range: range.refine(({ startUs, endUs }) => endUs > startUs && endUs - startUs <= 30_000_000, {
    message: "Audio range must be positive and no longer than 30 seconds",
  }),
  track: z.enum(["narration", "system", "mix"]).default("mix"),
});

const indexFields = { revisionId: id, generation: id };
const indexPosition = { ...indexFields, afterOrdinal: z.int().nonnegative() };
const coveragePosition = {
  ...indexFields,
  afterSequence: z.int().nonnegative(),
  candidateOrdinal: z.int().nonnegative().nullable(),
};
const paged = <T extends z.ZodRawShape, S extends z.ZodRawShape, C extends z.ZodRawShape>(
  target: z.ZodObject<T>,
  fields: S,
  position: C,
) => target.extend({ ...fields, cursor: target.extend(position).strict().optional() }).strict();
const inspectionPage = <S extends z.ZodRawShape, C extends z.ZodRawShape>(fields: S, position: C) =>
  z.union([paged(recording, fields, position), paged(packageTarget, fields, position)]);

// These are implemented capabilities. Adapters derive their advertised tools from
// the same schemas the service validates, rather than promising future operations.
export const operationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("export.create"),
      params: recording
        .extend({
          exportId: z.uuid(),
          kind: z.enum(["video", "processed-package"]),
          revisionId: id.optional(),
          directory: z.string().min(1),
          leaf: z.string().min(1),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Export a pinned revision to an existing absolute directory without replacing files. Reuse exportId for a lost response; poll export.status. Choose video or a complete processed-package ZIP. Package export requires all acquired evidence; acquired narration requires an accepted transcript and currently reports UNSUPPORTED_ARTIFACT.",
    ),
  z
    .object({
      operation: z.literal("export.list"),
      params: z
        .object({
          recordingId: id.optional(),
          unfinishedOnly: z.boolean().optional(),
          limit: z.int().min(1).max(500).optional(),
          cursor: z
            .object({
              recordingId: id.nullable(),
              unfinishedOnly: z.boolean(),
              afterExportId: z.uuid(),
            })
            .strict()
            .optional(),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Discover persisted export summaries after restart without starting work. Defaults to 100, maximum 500. unfinishedOnly includes uncommitted exports, abandonment and private cleanup. Cursor binds recordingId and unfinishedOnly. Pages follow live lexical export IDs; start a fresh traversal for new arrivals before your cursor. Use export.status for details.",
    ),
  z
    .object({
      operation: z.literal("export.status"),
      params: z.object({ exportId: z.uuid() }).strict(),
    })
    .strict()
    .describe(
      "Read an export's pinned revision, admitted destination, job, private cleanup state and historical commit receipt without opening the destination. output names a file only once committed.",
    ),
  z
    .object({
      operation: z.literal("export.retry"),
      params: z.object({ exportId: z.uuid() }).strict(),
    })
    .strict()
    .describe(
      "Explicitly retry the same pinned export. A committed export is never recreated if its external file moved or was removed.",
    ),
  z
    .object({
      operation: z.literal("export.recover"),
      params: z.object({ exportId: z.uuid() }).strict(),
    })
    .strict()
    .describe(
      "Queue a fresh observation of uncertain publication evidence. Does not create or replace an external file.",
    ),
  z
    .object({
      operation: z.literal("export.cancel"),
      params: z.object({ exportId: z.uuid() }).strict(),
    })
    .strict()
    .describe(
      "Cancel this export and its active recovery work. A file already committed remains intact.",
    ),
  z
    .object({
      operation: z.literal("export.abandon"),
      params: z.object({ exportId: z.uuid() }).strict(),
    })
    .strict()
    .describe(
      "Drain this export and remove its owned private staging and intent. Never deletes the external export. An absent intent is already abandoned.",
    ),
  z
    .object({
      operation: z.literal("package.open"),
      params: z.object({ path: z.string().startsWith("/") }).strict(),
    })
    .strict()
    .describe(
      "Admit a local processed ZIP from an absolute path without symlink components, asynchronously. Poll package.status with the returned admission ID; only ready results contain a process-local packageHandle. Opening twice creates independent lifetimes.",
    ),
  z
    .object({
      operation: z.literal("package.status"),
      params: z.object({ admissionId: id.optional() }).strict(),
    })
    .strict()
    .describe(
      "Read one package admission, or omit admissionId for package recovery, storage status and active admissions (including opens whose reply was lost). Handles expire when closed or the service restarts.",
    ),
  z
    .object({
      operation: z.literal("package.close"),
      params: z.object({ admissionId: id }).strict(),
    })
    .strict()
    .describe(
      "Cancel or close a package admission, draining work and revoking its image deliveries before cleanup. Retry explicit cleanup failures with the same admissionId.",
    ),
  z
    .object({ operation: z.literal("recording.delete"), params: recording })
    .strict()
    .describe(
      "Delete a recording with its media, evidence, caches and open deliveries once capture has proved the take stopped. Retrying joins the same deletion; deleting an absent recording succeeds.",
    ),
  z
    .object({
      operation: z.literal("storage.usage"),
      params: z.object({ recordingId: id.optional() }).strict(),
    })
    .strict()
    .describe(
      "Read live logical regular-file byte usage, including unfinished work and pending deletions. Omit recordingId for all managed storage plus shared database/unattributed bytes. Models and external exports are excluded; files may change while scanned.",
    ),
  z
    .object({
      operation: z.literal("index.get"),
      params: inspectionPage(
        { revisionId: id.optional(), limit: z.int().min(1).max(200).default(50) },
        indexPosition,
      ),
    })
    .strict()
    .describe(
      "Request a retained screenshot index. Returns readiness until complete, then paged metadata with reasons and stable frame references. Continue with the returned cursor to keep the same revision and generation; use index.frame or index.frames for image bytes.",
    ),
  z
    .object({
      operation: z.literal("index.retry"),
      params: recording.extend({ revisionId: id.optional() }).strict(),
    })
    .strict()
    .describe(
      "Explicitly retry failed screenshot index processing. Failed source or scene dependencies require their own processing.retry.",
    ),
  z
    .object({
      operation: z.literal("index.coverage"),
      params: inspectionPage(
        {
          ...indexFields,
          candidateOrdinal: z.int().nonnegative().optional(),
          limit: z.int().min(1).max(200).default(50),
        },
        coveragePosition,
      ),
    })
    .strict()
    .describe(
      "Page source and edited coverage intervals from a published index, optionally for one selected image. Continuations bind the index and candidate filter.",
    ),
  z
    .object({
      operation: z.literal("index.frame"),
      params: inspection({ ...indexFields, ordinal: z.int().nonnegative() }),
    })
    .strict()
    .describe(
      "Read one retained selected PNG from a published index reference. Includes requested/actual times and pointing metadata; the CLI and MCP deliver image bytes.",
    ),
  z
    .object({
      operation: z.literal("index.frames"),
      params: inspection({
        ...indexFields,
        ordinals: z.array(z.int().nonnegative()).min(1).max(8),
      }),
    })
    .strict()
    .describe(
      "Read one to eight retained selected PNGs in order from the same published index. Each ordinal returns its own image or error; duplicates remain ordered.",
    ),

  z
    .object({
      operation: z.literal("frame.batch"),
      params: inspection({ ...frameFields, atUs: z.array(time).min(1).max(8) }),
    })
    .strict()
    .describe(
      "Request one to eight ordered frames pinned to one revision. Each item retains its own readiness/error; duplicates reuse work. Poll the returned revision and retry individual failures with frame.retry.",
    ),
  z
    .object({
      operation: z.literal("preview.get"),
      params: recording.extend({ revisionId: id.optional() }).strict(),
    })
    .strict()
    .describe(
      "Request a playable MP4 of the pinned edit with current pointer and acquired audio. Returns readiness until complete; pin the returned revision when polling. CLI writes a file; MCP returns a delivery token for artifact.read/close.",
    ),
  z
    .object({
      operation: z.literal("preview.retry"),
      params: recording.extend({ revisionId: id.optional() }).strict(),
    })
    .strict()
    .describe(
      "Explicitly retry failed preview rendering for the same pinned revision. Failed source dependencies require processing.retry.",
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
      "Request a frame at edited playback time with an observed pointer and two-second trail by default. Use clean:true for no overlay or trailUs:0 for pointer only. Pin the returned revision when polling.",
    ),
  z
    .object({ operation: z.literal("frame.retry"), params: frameParams })
    .strict()
    .describe(
      "Explicitly retry failed frame processing using the same pinned request; source dependencies require their own processing retry.",
    ),
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
    .object({ operation: z.literal("artifact.renew"), params: z.object({ token: id }).strict() })
    .strict()
    .describe(
      "Extend a live delivery for an active consumer. Returns the same token and byte count with a new expiry. Expired, closed or deleted deliveries cannot be revived; close when finished.",
    ),
  z
    .object({ operation: z.literal("artifact.close"), params: z.object({ token: id }).strict() })
    .strict()
    .describe("Release a media delivery; closing it again succeeds."),
  z
    .object({
      operation: z.literal("timeline.events"),
      params: inspection({
        revisionId: id.optional(),
        cursor: z.string().min(1).max(4096).optional(),
        limit: z.int().min(1).max(500).default(100),
      }),
    })
    .strict()
    .describe(
      "Read pause, cut, geometry, scene and interruption markers in pinned playback time. Continue while nextCursor exists, even if rows is empty. Adjacent rows with equal atUs form one logical group and may span pages. A cursor pins its target, revision and source/scene generations; included package history can be inspected explicitly.",
    ),
  z
    .object({
      operation: z.literal("cursor.raw"),
      params: inspectionPage(
        { sourceRange: cursorRange, limit: z.int().min(1).max(5000).default(1000) },
        {
          sourceId: id,
          generation: id,
          sourceRange: cursorRange,
          afterSequence: z.int().positive(),
        },
      ),
    })
    .strict()
    .describe(
      "Page raw cursor observations in explicit source time, including retained integrity markers; edits do not alter these samples.",
    ),
  z
    .object({
      operation: z.literal("processing.status"),
      params: recording
        .extend({ artifact: z.enum(["source", "scenes"]).default("source") })
        .strict(),
    })
    .strict()
    .describe("Read source or scene processing state and its published generation."),
  z
    .object({
      operation: z.literal("processing.retry"),
      params: recording.extend({ artifact: z.enum(["source", "scenes"]) }).strict(),
    })
    .strict()
    .describe("Explicitly start or retry source or scene processing; never duplicate active work."),
  z
    .object({ operation: z.literal("service.health"), params: z.object({}).strict() })
    .strict()
    .describe("Read local service readiness without starting capture."),
  z
    .object({ operation: z.literal("capture.sources"), params: z.object({}).strict() })
    .strict()
    .describe("List the displays, windows and microphones this host can capture."),
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
      params: inspection({ revisionId: id.optional() }),
    })
    .strict()
    .describe(
      "Read a specified revision, or resolve the library current revision / package exported revision once. Package history may contain newer entries than its exported revision.",
    ),
  z
    .object({
      operation: z.literal("revision.history"),
      params: z.union([historyParams(recording), historyParams(packageTarget)]),
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

export type OperationName = z.infer<typeof operationSchema>["operation"];
export const operationNames: ReadonlySet<string> = new Set(
  operationSchema.options.map((option) => option.shape.operation.value),
);

const nativeCall = DEFAULT_CALL_TIMEOUT_MS;
const workerRun = MEDIA_WORKER_TIMEOUT_MS;
// Drains and scans wait on other work finishing; a retry joins the same in-flight work.
const drain = 180_000;
const waits: Partial<Record<OperationName, number>> = {
  "capture.sources": nativeCall,
  "capture.status": nativeCall,
  "capture.pause": nativeCall,
  "capture.resume": nativeCall,
  "capture.cancel": nativeCall,
  // A stop native cannot perform is settled from the take's media by a recovery run.
  "capture.stop": nativeCall + workerRun,
  // An unanswered start is stopped and then recovered the same way.
  "capture.start": 2 * nativeCall + workerRun,
  // A restart discards the named take before it starts the next one.
  "capture.restart": 3 * nativeCall + workerRun,
  "export.create": workerRun,
  "export.abandon": drain,
  "package.open": drain,
  "package.close": drain,
  "recording.delete": drain,
  "storage.usage": drain,
};

/**
 * How long a client waits for one operation's answer. It outlasts every wait the service bounds on
 * that operation's own path, so the service's outcome, including its own timeout, reaches the
 * caller rather than a transport guess about work that is still running.
 */
export function operationDeadlineMs(operation: string): number {
  return (waits[operation as OperationName] ?? DEFAULT_CALL_TIMEOUT_MS) + 5_000;
}
