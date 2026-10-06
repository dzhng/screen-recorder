import {
  outputSettingsSchema,
  audioOutputSettingsSchema,
  selectionRangeSchema,
  compositionSchema,
  mediaClipSchema,
  editOperationSchema,
  textSeedCuesSchema,
  captionSidecarRequestSchema,
  processingTargetSchema,
  processingTapSchema,
} from "@yap/composition";
import { z } from "zod";
import { captureSelectionSchema } from "./capture.js";
import { DEFAULT_CALL_TIMEOUT_MS, MEDIA_WORKER_TIMEOUT_MS } from "./framing.js";

const id = z.string().min(1);
/** The most bytes one artifact.read returns. */
export const ARTIFACT_CHUNK_BYTES = 512 * 1024;
/** Bounded maintenance must not borrow capacity from the deliveries it drains. */
export function isArtifactMaintenance(operation: string): boolean {
  return (
    operation === "artifact.read" ||
    operation === "artifact.renew" ||
    operation === "artifact.close"
  );
}
const time = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const range = z.object({ startUs: time, endUs: time }).strict();
const recording = z.object({ recordingId: id }).strict();
const sourceSelection = mediaClipSchema.pick({
  assetId: true,
  streamId: true,
  acquisitionId: true,
});
const transcriptExecutionSelection = {
  executionRange: selectionRangeSchema.optional(),
  context: z
    .strictObject({
      beforeUs: z.int().min(0).max(4_000_000),
      afterUs: z.int().min(0).max(4_000_000),
    })
    .optional(),
};
const sourceTranscriptPreparation = sourceSelection.extend(transcriptExecutionSelection).strict();
const sourceTranscriptReference = {
  assetId: id,
  streamId: id,
  acquisitionId: id.nullable(),
  generation: id,
  supportDigest: id,
  afterSourceUs: time,
};
const project = z.object({ projectId: id }).strict();
const projectEvidenceParams = project
  .extend({
    revisionId: id.optional(),
    range: range.optional(),
    trackIds: z.array(id).optional(),
    limit: z.int().min(1).max(1000).optional(),
    cursor: z
      .strictObject({
        projectId: id,
        revisionId: id,
        manifestId: z.uuid(),
        checkpointId: z.uuid(),
        queryDigest: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .optional(),
  })
  .strict();
const projectTranscriptParams = projectEvidenceParams
  .extend({
    sourceGenerations: z
      .array(sourceSelection.extend({ generation: z.uuid() }).strict())
      .min(1)
      .max(10000)
      .optional(),
  })
  .strict();
const capturePosition = z.strictObject({
  after: z.tuple([time, time]).nullable(),
  done: z.boolean(),
});
const captureHeads = z.strictObject({
  cursor: capturePosition,
  pause: capturePosition,
  geometry: capturePosition,
  interruption: capturePosition,
});
const sourceCaptureParams = (maximum: number, events = false) =>
  sourceSelection
    .extend({
      sourceRange: range.optional(),
      limit: z.int().min(1).max(maximum).optional(),
      cursor: z
        .strictObject({
          reference: id,
          position: events
            ? z.strictObject({
                capture: captureHeads,
                scene: z.strictObject({
                  after: z
                    .strictObject({
                      actualSourceUs: z
                        .int()
                        .min(-Number.MAX_SAFE_INTEGER)
                        .max(Number.MAX_SAFE_INTEGER),
                      ordinal: time,
                    })
                    .nullable(),
                  done: z.boolean(),
                }),
              })
            : captureHeads,
        })
        .optional(),
    })
    .strict();
const projectEdit = project.extend({ requestId: id, expectedRevisionId: id });
const exportDestination = {
  exportId: z.uuid(),
  revisionId: id.optional(),
  directory: z.string().min(1),
  leaf: z.string().min(1),
  overwrite: z.boolean().optional(),
};
const previewParams = project
  .extend({
    revisionId: id.optional(),
    settings: outputSettingsSchema.optional(),
    range: range
      .refine(({ startUs, endUs }) => endUs > startUs, {
        message: "Preview range must be positive",
      })
      .optional(),
  })
  .strict();
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

const maxLongEdge = z.int().min(1).max(8192).optional();
const projectFrameParams = project
  .extend({
    revisionId: id.optional(),
    atUs: time,
    maxLongEdge: maxLongEdge,
    tap: processingTapSchema.optional(),
  })
  .strict();
const sourceFrameParams = sourceSelection
  .extend({
    atUs: time,
    maxLongEdge: maxLongEdge,
  })
  .strict();
const frameParams = z.union([
  projectFrameParams,
  sourceFrameParams,
  sourceSelection.omit({ acquisitionId: true }).extend({ maxLongEdge: maxLongEdge }).strict(),
]);

const audioRange = range.refine(({ startUs, endUs }) => endUs > startUs, {
  message: "Audio range must be positive",
});
const projectAudioParams = project
  .extend({
    revisionId: id.optional(),
    range: audioRange.optional(),
    tap: processingTapSchema.optional(),
  })
  .strict();
const sourceAudioParams = sourceSelection
  .extend({ range: selectionRangeSchema.optional() })
  .strict();
const extractedAudioRendition = z.strictObject({
  sampleRate: z.int().min(1).max(192000),
  channels: z.union([z.literal(1), z.literal(2)]),
});
const audioParams = z.union([projectAudioParams, sourceAudioParams]);
const loudnessFields = {
  channelInterpretation: z.enum(["native", "dual-mono"]).optional(),
  truePeak: z.boolean().optional(),
};
const loudnessParams = z.union([
  projectAudioParams.extend({ ...loudnessFields, preparedResourceId: id.optional() }),
  sourceAudioParams.extend(loudnessFields),
]);
const waveformFields = {
  bucketFrames: z.int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  format: z.enum(["json", "image"]).optional(),
};
const waveformParams = z.union([
  projectAudioParams.extend(waveformFields),
  sourceAudioParams.extend(waveformFields),
]);

const spectrumFields = {
  fftFrames: z.int().min(16).max(8192).optional(),
  hopFrames: z.int().positive().max(8192).optional(),
};
const spectrogramParams = z.union([
  projectAudioParams.extend(spectrumFields),
  sourceAudioParams.extend(spectrumFields),
]);

const projectIndexParams = projectFrameParams.omit({ atUs: true });
const projectIndexReference = projectIndexParams.required().extend({ generation: id });
const paged = <T extends z.ZodRawShape, S extends z.ZodRawShape, C extends z.ZodRawShape>(
  target: z.ZodObject<T>,
  fields: S,
  position: C,
) => target.extend({ ...fields, cursor: target.extend(position).strict().optional() }).strict();
// Adapters derive their advertised tools from the same schemas the service validates.
export const operationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("project.create"),
      params: z
        .object({
          requestId: id,
          title: z.string().optional(),
          canvas: compositionSchema.shape.canvas,
        })
        .strict(),
    })
    .strict()
    .describe(
      "Create an empty managed project with an explicit canvas; replay requestId to recover the same project.",
    ),
  z
    .object({ operation: z.literal("project.delete"), params: project })
    .strict()
    .describe(
      "Delete a project and drain its work while preserving original assets. Repeating deletion succeeds; creation retries never recreate it.",
    ),
  z
    .object({ operation: z.literal("project.get"), params: project })
    .strict()
    .describe("Read project metadata and its current revision identity."),
  z
    .object({
      operation: z.literal("project.list"),
      params: z
        .object({
          cursor: z.object({ afterSequence: z.int().nonnegative() }).strict().optional(),
          limit: z.int().min(1).max(1000).optional(),
        })
        .strict(),
    })
    .strict()
    .describe("Read a bounded page of managed projects."),
  z
    .object({
      operation: z.literal("edit.apply"),
      params: projectEdit.extend({ operations: z.array(editOperationSchema).max(1000) }).strict(),
    })
    .strict()
    .describe(
      "Atomically edit a managed project using revision pinning and replay-safe request identity; returns revision.document as the sole document, plus edit receipts with complete normalized changes and labels.",
    ),
  z
    .object({
      operation: z.literal("text.seed"),
      params: projectEdit.extend({ cues: textSeedCuesSchema }).strict(),
    })
    .strict()
    .describe(
      "Seed explicitly grouped text clips from pinned transcript generations and occurrence word rows. Supply each cue's source, original occurrence clip ID, exact word ordinals/source ranges, separator, style and project/content/clip anchor domain. Expands one atomic ordinary placement batch; returns revision.document as the sole document, plus edit receipts with normalized edits and labels. Display text remains editable independently of retained transcript origin. Pins retain overlapping estimates and instant points; cues containing only instant observations require caller-authored literal text with an explicit extent instead of inferred dwell. Reuse requestId only for the same pinned request. At most 1000 cues and 10000 total word pins.",
    ),
  z
    .object({
      operation: z.literal("processing.get"),
      params: project.extend({ revisionId: id, target: processingTargetSchema }).strict(),
    })
    .strict()
    .describe(
      "Read one target's authored ordered processing stack at a pinned revision; this does not execute processors.",
    ),
  z
    .object({
      operation: z.literal("output.capabilities"),
      params: z.object({ kind: z.enum(["video", "audio"]).optional() }).strict(),
    })
    .strict()
    .describe(
      "Discover standalone audio formats and rendition limits with kind:audio without initializing a video encoder; omit kind or use kind:video for project movie encoding controls, editable presets, backend capabilities and unsupported combinations. Internal mixing is 48000 Hz stereo; encoded AAC rate/layout is independently selectable. Requested bitrate is not measured file bitrate.",
    ),
  z
    .object({ operation: z.literal("processing.capabilities"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Discover typed processing parameters and distinguish authoring support from actual execution readiness.",
    ),

  z
    .object({
      operation: z.literal("acquisition.import"),
      params: z.object({ requestId: id, path: z.string().min(1) }).strict(),
    })
    .strict()
    .describe(
      "Adopt an explicitly named captured-source directory and its journal through a durable job. Own copied media and evidence independently of the donor; inspect job.get and use job.retry/job.cancel for preparation.",
    ),
  z
    .object({
      operation: z.literal("acquisition.get"),
      params: z.object({ acquisitionId: id }).strict(),
    })
    .strict()
    .describe(
      "Read immutable capture context and asset/stream bindings. Select acquisitionId explicitly on a media clip; omission always uses physical file support.",
    ),

  z
    .object({
      operation: z.literal("asset.import"),
      params: z.object({ requestId: id, path: z.string().min(1) }).strict(),
    })
    .strict()
    .describe(
      "Admit local media or a font file as an immutable asset through a durable job. Fonts retain all explicitly named faces without installation or playable streams. Replay requestId to recover the same import; inspect job.get, retry failed work with job.retry and cancel with job.cancel.",
    ),
  z
    .object({
      operation: z.literal("asset.convert"),
      params: z
        .object({
          assetId: id,
          streamIds: z.array(z.string().min(1)).min(1).max(2),
          recipe: z.literal("hdr-to-sdr-hable-1000nit-v1"),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Explicitly convert one whole qualified HDR video stream to an immutable SDR ProRes asset; optionally copy one explicitly selected audio stream with unchanged decoded samples and common clock. The frozen recipe and bundled implementation are retained with source/output evidence. Original media stays intact; no placement or automatic conversion. Shared jobs own replay, retry, cancellation and publication. Range and acquisition conversion are unsupported.",
    ),
  z
    .object({ operation: z.literal("asset.get"), params: z.object({ assetId: id }).strict() })
    .strict()
    .describe(
      "Read immutable stream headers with segmentCount; use asset.segments for complete physical timing rows, including empty gaps. Non-timed fontFaces remain available. Select a font face by assetId and its exact postScriptName; names are scoped to those immutable bytes, not the installed system fonts.",
    ),
  z
    .object({
      operation: z.literal("asset.segments"),
      params: z
        .object({
          assetId: id,
          streamId: z.string().min(1),
          cursor: z
            .object({ assetId: id, streamId: z.string().min(1), afterOrdinal: z.int().min(-1) })
            .strict()
            .optional(),
          limit: z.int().min(1).max(1000).optional(),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Read exact physical segment rows in immutable ordinal order, including empty gaps and original media mappings. Use asset.get segmentCount for discovery; follow nextCursor until null. A cursor belongs to its asset and stream. These rows preserve source metadata, not a newly normalized playback timeline.",
    ),
  z
    .object({
      operation: z.literal("asset.origins"),
      params: z
        .object({
          assetId: id,
          cursor: z.object({ afterProvenance: z.string() }).strict().optional(),
          limit: z.int().min(1).max(1000).optional(),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Read a bounded page of asset provenance. Follow nextCursor until null; concurrent imports can add origins before the cursor, so restart traversal to refresh history.",
    ),
  z
    .object({
      operation: z.literal("asset.list"),
      params: z
        .object({
          cursor: z.object({ afterSequence: time }).strict().optional(),
          limit: z.int().min(1).max(1000).optional(),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Read a bounded page of admitted assets. streamCount/mediaKinds describe media streams; fontFaceCount identifies non-timed font assets, which have no streams.",
    ),
  z
    .object({ operation: z.literal("job.get"), params: z.object({ jobId: id }).strict() })
    .strict()
    .describe(
      "Read a preparation job's current attempt and published result without restarting it. inputSha256 identifies its frozen internal recipe; the serialized execution input is not returned.",
    ),
  z
    .object({ operation: z.literal("job.retry"), params: z.object({ jobId: id }).strict() })
    .strict()
    .describe(
      "Explicitly retry a failed preparation job with its frozen inputs. Returns the same job status shape as job.get, with inputSha256 instead of internal execution input.",
    ),
  z
    .object({ operation: z.literal("job.cancel"), params: z.object({ jobId: id }).strict() })
    .strict()
    .describe(
      "Cancel a preparation job; occupied resources drain before their execution capacity is reused. Returns the same job status shape as job.get, including inputSha256.",
    ),

  z
    .object({
      operation: z.literal("export.create"),
      params: z.union([
        project
          .extend({
            ...exportDestination,
            kind: z.literal("video"),
            settings: outputSettingsSchema.optional(),
          })
          .strict(),
        project
          .extend({
            ...exportDestination,
            kind: z.literal("audio"),
            settings: audioOutputSettingsSchema.optional(),
          })
          .strict(),
        project.extend({ ...exportDestination, kind: z.literal("processed-package") }).strict(),
        project
          .extend({ ...exportDestination, ...captionSidecarRequestSchema.shape, revisionId: id })
          .strict(),
      ]),
    })
    .strict()
    .describe(
      "Export a pinned revision to an existing absolute directory. A new intent atomically replaces an unchanged file matching a trusted Yap publication receipt; replacing another regular file requires overwrite:true. Symlink and original-source destinations are refused at admission and the commit check. Replacement pins destination identity and bytes; concurrent Yap publishers serialize. A noncooperating external writer racing the atomic swap can leave a conflict with displaced bytes retained in private staging; no rollback over a successor is attempted. Reuse exportId only for the same request to recover a lost response; poll export.status. Managed projects export video, standalone audio (Float32 WAV or AAC/M4A), an editable processed-package ZIP, or plain SRT/VTT sidecars; sidecars require revisionId and explicit unique text placementIds, use displayed corrected text and exact surviving support, round outward to milliseconds and report introduced overlaps/omissions/discarded styling. They require no video/audio encoder or ASR. Unsupported cue payloads and limits refuse rather than rewrite text; audio defaults to lossless 48kHz stereo WAV, pins the full processed mix, and requires no video preparation. Export never removes video or changes the project. Project packaging selects the requested revision and retained history through it; later donor edits are excluded. Project package JSON uses inventory members with a 128 MiB aggregate working-memory admission. Package export requires all acquired evidence: acquired narration waits for its transcript, reports MODEL_NOT_PREPARED until model.prepare has completed, and fails if transcription failed until an explicit source job retry succeeds.",
    ),
  z
    .object({
      operation: z.literal("export.list"),
      params: z
        .object({
          projectId: id.optional(),
          unfinishedOnly: z.boolean().optional(),
          limit: z.int().min(1).max(500).optional(),
          cursor: z
            .object({
              projectId: id.nullable(),
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
      "Discover persisted export summaries after restart without starting work. Defaults to 100, maximum 500. unfinishedOnly includes uncommitted exports, abandonment and private cleanup. Filter by projectId. Cursor binds the project filter and unfinishedOnly. Pages follow live lexical export IDs; start a fresh traversal for new arrivals before your cursor. Use export.status for details.",
    ),
  z
    .object({
      operation: z.literal("export.status"),
      params: z.object({ exportId: z.uuid() }).strict(),
    })
    .strict()
    .describe(
      "Read an export's pinned revision, admitted destination, job, private cleanup state and historical commit receipt without opening the destination. Project package snapshots report project/revision identity and history/resource counts; video snapshots retain output settings. output names a file only once committed.",
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
      operation: z.literal("package.adopt"),
      params: z.object({ packageHandle: id, requestId: id }).strict(),
    })
    .strict()
    .describe(
      "Adopt an opened editable project package into independent durable assets and revisions. Repeat the same requestId and packageHandle to poll the shared preparation job; ready result contains projectId and revisionId; inspect the durable project and its retained history with project.get and revision.history. Closing the package cancels unfinished adoption; a committed project survives package closure.",
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
      params: z.object({}).strict(),
    })
    .strict()
    .describe(
      "Read live logical regular-file byte usage, including unfinished work and pending deletions. Includes all managed storage plus shared database/unattributed bytes. Models and external exports are excluded; files may change while scanned.",
    ),
  z
    .object({
      operation: z.literal("index.get"),
      params: z.union([
        projectIndexParams.extend({
          limit: z.int().min(1).max(200).default(50),
          cursor: projectIndexReference.extend({ afterOrdinal: z.int().nonnegative() }).optional(),
        }),
        paged(
          sourceSelection,
          { limit: z.int().min(1).max(200).default(50) },
          {
            generation: id,
            afterOrdinal: z.int().nonnegative(),
          },
        ),
      ]),
    })
    .strict()
    .describe(
      "Request a retained screenshot index for a project or selected asset video stream. Projects select the whole revision and an optional video tap, defaulting to processed output; maxLongEdge controls picture size. Source selectors use assetId/streamId and optional acquisitionId. Scene preparation precedes index preparation. Returns readiness until complete, then paged metadata with selection reasons and stable frame references. An empty index may be ready. Project coverage marks only delivered frame visibility as sampled; intervening ranges remain unproven. Continue with the returned cursor to pin identity; use index.frame or index.frames for image bytes.",
    ),
  z
    .object({
      operation: z.literal("index.retry"),
      params: z.union([projectIndexParams, sourceSelection]),
    })
    .strict()
    .describe(
      "Explicitly retry failed or canceled screenshot index processing. Project and source selectors also retry their retryable terminal scene or frame prerequisites; ordinary reads do not restart terminal work.",
    ),
  z
    .object({
      operation: z.literal("index.coverage"),
      params: z.union([
        paged(
          projectIndexReference,
          {
            candidateOrdinal: z.int().nonnegative().optional(),
            limit: z.int().min(1).max(200).default(50),
          },
          {
            afterSequence: z.int().nonnegative(),
            candidateOrdinal: z.int().nonnegative().nullable(),
          },
        ),
        paged(
          sourceSelection,
          {
            generation: id,
            candidateOrdinal: z.int().nonnegative().optional(),
            limit: z.int().min(1).max(200).default(50),
          },
          {
            generation: id,
            afterSequence: z.int().nonnegative(),
            candidateOrdinal: z.int().nonnegative().nullable(),
          },
        ),
      ]),
    })
    .strict()
    .describe(
      "Page source and edited coverage intervals from a published index, optionally for one selected image. Continuations bind the index and candidate filter.",
    ),
  z
    .object({
      operation: z.literal("index.frame"),
      params: z.union([
        projectIndexReference.extend({ ordinal: z.int().nonnegative() }),
        sourceSelection.extend({ generation: id, ordinal: z.int().nonnegative() }).strict(),
      ]),
    })
    .strict()
    .describe(
      "Read one retained selected PNG from a published index reference. Includes requested/actual times and pointing metadata; the CLI and MCP deliver image bytes.",
    ),
  z
    .object({
      operation: z.literal("index.frames"),
      params: z.union([
        projectIndexReference.extend({ ordinals: z.array(z.int().nonnegative()).min(1).max(8) }),
        sourceSelection
          .extend({
            generation: id,
            ordinals: z.array(z.int().nonnegative()).min(1).max(8),
          })
          .strict(),
      ]),
    })
    .strict()
    .describe(
      "Read one to eight retained selected PNGs in order from the same published index. Each ordinal returns its own image or error; duplicates remain ordered.",
    ),

  z
    .strictObject({
      operation: z.literal("speaker.prepare"),
      params: sourceSelection
        .extend({ channel: z.int().nonnegative(), sourceRange: selectionRangeSchema, modelId: id })
        .strict(),
    })
    .describe(
      "Explicitly prepare one selected source channel over exactly thirty seconds of complete available support, starting on the 16k sample grid. Joins the same observation; job.retry owns failed/canceled recovery. Requires explicitly prepared optional model/runtime and an admitted native decoder. Never fills holes, mixes channels, infers edits or modifies original media.",
    ),
  z
    .strictObject({
      operation: z.literal("speaker.get"),
      params: z.union([
        projectEvidenceParams
          .extend({
            channel: z.int().nonnegative(),
            modelId: id,
            view: z.literal("intervals").optional(),
            packageHandle: id.optional(),
          })
          .strict(),
        sourceSelection
          .extend({
            channel: z.int().nonnegative(),
            modelId: id,
            observationRange: selectionRangeSchema,
            packageHandle: id.optional(),
            sourceRange: selectionRangeSchema.optional(),
            view: z.enum(["intervals", "scores"]).optional(),
            limit: z.int().min(1).max(1000).optional(),
            cursor: z.string().min(1).max(8192).optional(),
          })
          .strict(),
      ]),
    })
    .describe(
      "Read immutable source observations or their source/project projection without preparing or invoking a model. Project selectors consume retained matching channel/model generations only; no project scores. Optional packageHandle reads the opened immutable package; package project metadata jobs and checkpoints share its bounded context lifetime. observationRange selects the generation; sourceRange only narrows display. Intervals retain complete exact source ranges, native ordinals and anonymous generation-local slots. Scores retain every original 80ms cell and are uncalibrated, never assignment confidence or silence. Continue while nextCursor exists, including empty pages. Continuations pin the original generation, decoder and display query; changed input refuses with ARTIFACT_CHANGED. Ready reads need neither the current native executable nor prepared runtime bytes.",
    ),
  z
    .strictObject({
      operation: z.literal("transcript.prepare"),
      params: sourceTranscriptPreparation,
    })
    .describe(
      "Explicitly request source speech inference. executionRange selects primary source-clock ownership; context adds decode-only outer support, never edits or retimes words. Omission prepares full admitted support in bounded 20-second windows with 4-second internal context and unique shared-context word correspondence. Gaps remain gaps. Retained raw evidence includes all context candidates and ownership/merge diagnostics. Unmatched or ambiguous boundary observations refuse nonretryably. Models must already be prepared via model.prepare. Repeat identical requests join existing work; read bounded output with its retained generation.",
    ),
  z
    .object({
      operation: z.literal("transcript.get"),
      params: z.union([
        projectTranscriptParams,
        sourceSelection
          .extend({
            generation: z.uuid().optional(),
            range: range.optional(),
            limit: z.int().min(1).max(1000).default(250),
            cursor: z
              .object({
                ...sourceTranscriptReference,
                afterOrdinal: time.nullable(),
                range: range.nullable(),
              })
              .strict()
              .optional(),
          })
          .strict(),
      ]),
    })
    .strict()
    .describe(
      "Request a project transcript with projectId and optional revisionId, range and trackIds, a selected asset-stream source transcript. Project rows retain occurrence identity and exact editorial fragments, ordered by project time; query windows do not change editorial partiality. Continue even when a project page is empty if nextCursor exists. Project continuations pin the original revision and source generations. Asset ranges use the normalized source clock; acquisitionId omission uses physical support. Reads and search never enqueue transcription or prepare models. Use transcript.prepare to request inference. generation selects retained source evidence; bounded preparations require that pin (a continuation already pins it). Omitted generation resolves only full-support preparation identity. Project sourceGenerations explicitly select bounded retained dependencies; omitted selections resolve full-support identities. A ready project may prepare its read-only evidence manifest. Returns readiness until complete, then word and acquisition-gap rows in the selected time domain. Unfiltered asset enumeration returns every retained observation, including points at the source end. Explicit source/project interval selections remain half-open. Asset ranges mark intersected rows partial while preserving their full source range; overlapping estimates and exact instant points are not playable cut support. Words keep verbatim text, kind and a per-generation ID. Without narration it is unavailable:no_narration; unprepared models are a retryable unavailable:model_not_prepared (see model.prepare). Continue with the returned cursor to pin selection, generation and range.",
    ),
  z
    .object({
      operation: z.literal("transcript.search"),
      params: z.union([
        projectTranscriptParams
          .extend({ text: z.string().min(1).max(200), limit: z.int().min(1).max(500).optional() })
          .strict(),
        sourceSelection
          .extend({
            text: z.string().min(1).max(200),
            generation: z.uuid().optional(),
            limit: z.int().min(1).max(500).default(100),
            cursor: z
              .object({ ...sourceTranscriptReference, afterOrdinal: time, text: z.string() })
              .strict()
              .optional(),
          })
          .strict(),
      ]),
    })
    .strict()
    .describe(
      "Search a project, selected source or ready narration transcript for literal, case-folded text over consecutive words, ignoring outer punctuation. Project matches follow consecutive whole words on each selected audio track, may cross contiguous clips, and stop at gaps or partial words. Each match carries all contributing word/clip identities and the widest exact projectRange across its word estimates; simultaneous speakers never form a shared phrase. Source entries carry word IDs and source range; phrases can cross accepted inference seams but stop at unavailable, unobserved or skipped support. Returns readiness like transcript.get until complete. Continue while nextCursor exists, even if entries is empty, to keep the same revision, generation and text.",
    ),
  z
    .object({
      operation: z.literal("transcript.retry"),
      params: z.union([
        sourceTranscriptPreparation,
        projectTranscriptParams
          .omit({ cursor: true, limit: true })
          .extend({ text: z.string().min(1).max(200).optional() })
          .strict(),
      ]),
    })
    .strict()
    .describe(
      "Explicitly retry previously requested selected-source preparation with the same executionRange/context; initial work uses transcript.prepare. Models must already be prepared. A project selector retries only its evidence manifest (include the same text to retry phrase search); source preparation failures must be retried with their returned asset-stream selection. Keep the same acquisition selection; preparation uses a fresh generation after failure.",
    ),
  z
    .object({ operation: z.literal("model.list"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Discover immutable registered model IDs, purpose, platform, content identities and preparation requirements without preparing anything.",
    ),
  z
    .object({
      operation: z.literal("model.status"),
      params: z.object({ modelId: z.string().min(1) }).strict(),
    })
    .strict()
    .describe(
      "Verify the selected registered model locally without network access. Returns absent, preparing with byte progress, ready, invalid, or failed. Readiness awaits bounded asynchronous runtime verification; unrelated requests remain available.",
    ),
  z
    .object({
      operation: z.literal("model.prepare"),
      params: z
        .object({
          modelId: z.string().min(1),
          runtimeSource: z.string().startsWith("/").optional(),
          modelSource: z.string().startsWith("/").optional(),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Explicitly prepare the selected registered model. Supply absolute runtimeSource and modelSource when model.list marks them required. modelSource admits pinned local files; omission downloads only when the registered acquisition policy permits it. Returns preparation progress; poll model.status. Reuses ready files and joins current preparation. Status and execution never acquire dependencies.",
    ),
  z
    .object({
      operation: z.literal("frame.batch"),
      params: z.union([
        projectFrameParams.extend({ atUs: z.array(time).min(1).max(8) }),
        sourceFrameParams.extend({ atUs: z.array(time).min(1).max(8) }),
      ]),
    })
    .strict()
    .describe(
      "Request one to eight ordered frames pinned to one revision. Each item retains its own readiness/error; duplicates reuse work. Poll the returned revision and retry individual failures with frame.retry.",
    ),
  z
    .object({
      operation: z.literal("preview.get"),
      params: previewParams,
    })
    .strict()
    .describe(
      "Request a playable MP4 of a pinned project. Projects accept an optional range in project microseconds; omitted range renders the whole project. Returns readiness until complete; pin the returned revision when polling. CLI writes a file; MCP returns a delivery token for artifact.read/close.",
    ),
  z
    .object({
      operation: z.literal("preview.retry"),
      params: previewParams,
    })
    .strict()
    .describe(
      "Explicitly retry failed preview rendering for the same pinned revision. Failed source dependencies require explicit job.retry.",
    ),
  z
    .object({
      operation: z.literal("voice.generate"),
      params: z.strictObject({
        modelId: id,
        reference: z.strictObject({
          assetId: id,
          streamId: id,
          origin: z.record(z.string(), z.json()).optional(),
        }),
        referenceText: z.string(),
        text: z.string(),
        preset: id.optional(),
        seed: z.string().optional(),
        generation: z
          .strictObject({
            temperature: z.number().optional(),
            top_k: z.int().optional(),
            top_p: z.number().optional(),
            repetition_penalty: z.number().optional(),
            max_tokens: z.int().optional(),
            lang_code: z.string().optional(),
            stream: z.literal(false).optional(),
          })
          .optional(),
      }),
    })
    .strict()
    .describe(
      "Generate a durable audio asset from an admitted complete mono24k Float32 reference, exact reference transcript and desired text. Inspect model.list for immutable profile defaults and supported settings; preset, when supplied, names that profile. Optionally echo one full reference origin returned by asset.origins or audio.extract; omission selects none. Shared jobs own progress, explicit retry and cancellation. Saved output replays without model readiness, and the result retains reference bytes. No project edit or automatic preparation; ordinary edit.apply owns placement and fit.",
    ),
  z
    .object({
      operation: z.literal("audio.extract"),
      params: z.union([
        sourceAudioParams.extend({
          rendition: extractedAudioRendition,
        }),
        projectAudioParams.extend({
          revisionId: id,
          range: audioRange,
          tap: processingTapSchema,
          rendition: extractedAudioRendition,
        }),
      ]),
    })
    .strict()
    .describe(
      "Retain a raw source selection or pinned project processing tap as an independent Float32 audio asset. Specify rendition sampleRate and mono/stereo channels; omit a source range to acquire the complete source, preserving canonical complete WAV bytes. Return shared job readiness and, when ready, asset/stream, exact frames and typed historical extraction origin. Does not edit the project or retain its donor graph after success; use job.retry and job.cancel for failed or active work.",
    ),
  z
    .object({
      operation: z.literal("audio.prepare"),
      params: project.extend({ revisionId: id, tap: processingTapSchema.optional() }).strict(),
    })
    .strict()
    .describe(
      "Explicitly prepare a complete project processing tap of a pinned revision as a retained lossless 48kHz stereo asset. Omitted tap means processed output; clip/track/group/output and dry/processed/after-step use the same selection meaning as audio.get. Preparation preserves whole processing-state domains, never a cold excerpt, and does not edit the document or current revision. Normalization feasibility and strict measured targets settle before expensive picture encoding. Returns readiness/jobId and a published audio receipt with assetId; use asset.get and ordinary audio/waveform/spectrogram inspection. Repeat the exact selection to reuse work; failed/canceled work requires job.retry, and job.cancel drains an attempt. Only a matching processed-output preparation is reusable by video export; another tap cannot replace the final mix. Unavailable processors or retiming refuse before admission; no model is downloaded.",
    ),
  z
    .object({ operation: z.literal("audio.get"), params: audioParams })
    .strict()
    .describe(
      "Request project WAV audio with projectId, optional revisionId/range and processing tap (defaults to processed output). Clip/track/group taps exclude later parent stages; dry skips the selected target stack while retaining child processing, and after-step includes the named step. Omitted project range uses the full pinned project; project output is 48kHz stereo and ranges retain the absolute sample clock. Or request a WAV from an explicitly selected assetId/streamId with optional acquisitionId and source-time range. Omitted source range extracts the full selected stream at its native supported rate/layout; unavailable support is explicit. CLI streams to a file; MCP embeds small audio and leaves large audio as a renewable artifact.read/close delivery. Pin selection, range and any returned revision while polling.",
    ),
  z
    .object({ operation: z.literal("audio.measure"), params: loudnessParams })
    .strict()
    .describe(
      "Measure the exact selected source PCM or pinned project processing tap without treatment. Uses audio.get selectors and range; optional preparedResourceId pins an existing prepared project signal. Omitted range means the full selected signal; an explicit smaller range is an excerpt. Returns readiness/jobId then published measurement with exact clock, source/revision/tap, PCM generation, recipe and meter identities, integrated LUFS, loudness range in LU, sample peak in dBFS and true peak in dBTP. Native channel interpretation is default; dual-mono is explicit and requires mono. True-peak libswresample analysis defaults on; false requests sample peak only. Missing support refuses with available/unavailable ranges; authored silence remains signal. Silence/below-gate or insufficient duration returns null loudness with a reason; never use the scanner's empty-gate sentinel as a finite measurement. Pin returned revision/range while polling; explicit job.retry recovers failed work. This does not normalize, edit, acquire tools or choose targets.",
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
      "Request a raw PNG/JPEG image with assetId, streamId and optional maxLongEdge; omit atUs and acquisitionId for images. The delivered PNG is upright; its receipt retains source orientation and has no sample clock. Request a selected video source picture with assetId, streamId, optional acquisitionId and source-clock atUs. Physical gaps return unavailable without a synthetic image. Or request a project picture at atUs with optional revisionId, maxLongEdge and video processing tap. Its global sample time can precede the requested time; the receipt separates compiled timing from actual decoded source samples. Project stills use the movie compositor and do not add capture pointer overlays. Pin the returned revision when polling.",
    ),
  z
    .object({ operation: z.literal("frame.retry"), params: frameParams })
    .strict()
    .describe("Explicitly retry failed frame processing using the same pinned request."),
  z
    .object({ operation: z.literal("waveform.get"), params: waveformParams })
    .strict()
    .describe(
      "Inspect a selected audio source or project processing tap as per-channel min/max/RMS JSON or a labeled image with format:image. Uses audio.get selectors and range in the selected time domain. Omit bucketFrames for an automatic overview; set a positive sample count for finer inspection (maximum 4096 buckets). Returned sample bounds and resolution are exact; unavailable support is not proof of silence. CLI writes JSON to --output; MCP returns its JSON text or image. Pin the returned project revision while polling. This measures audio and never edits it.",
    ),
  z
    .object({ operation: z.literal("waveform.retry"), params: waveformParams })
    .strict()
    .describe(
      "Explicitly retry waveform preparation and its audio prerequisite using the same pinned selection, range, tap and resolution.",
    ),
  z
    .object({ operation: z.literal("spectrogram.get"), params: spectrogramParams })
    .strict()
    .describe(
      "Inspect a bounded selected-source or project audio tap as a time/frequency image. Uses audio selectors and the selected clock. Defaults to fftFrames:1024 and hopFrames:512; FFT must be a power of two, hop no larger than FFT. Narrow the range when the 262144 channel/time/frequency-cell limit is exceeded. Surrounding PCM preserves range/full alignment; unavailable support is distinct from silence. Channels remain separate. Labels report density in dB relative to full-scale squared per Hz, with a fixed display floor; the image cannot establish speech quality. Pin revision while polling.",
    ),
  z
    .object({ operation: z.literal("spectrogram.retry"), params: spectrogramParams })
    .strict()
    .describe(
      "Explicitly retry the same spectrogram, including failed measurements and audio prerequisites.",
    ),
  z
    .object({
      operation: z.literal("artifact.read"),
      params: z
        .object({
          token: id,
          offset: time,
          maxBytes: z.int().min(1).max(ARTIFACT_CHUNK_BYTES).default(ARTIFACT_CHUNK_BYTES),
        })
        .strict(),
    })
    .strict()
    .describe(
      "Read a bounded base64 chunk from a media or complete JSON operation-result delivery; retrying an offset returns the same bytes.",
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
    .describe("Release a media or operation-result delivery; closing it again succeeds."),
  z
    .object({
      operation: z.literal("timeline.events"),
      params: z.union([
        projectEvidenceParams.extend({ limit: z.int().min(1).max(500).optional() }),
        sourceCaptureParams(500, true),
      ]),
    })
    .strict()
    .describe(
      "Read measured source scene changes, captured pause/geometry and explicit capture-end interruption markers for a selected asset stream or project. Source selectors use sourceRange; project selectors use range/revisionId/trackIds. Capture identity requires explicit acquisitionId; missing metadata is unavailable, not an empty success. Timed geometry belongs to captured video; pauses follow each bound timed occurrence. Normal completion contributes no interruption marker. Capture-end markers require trustworthy timed completion; missing, damaged or conflicting termination is explicitly unavailable. These closing boundaries use left support and (start,end] query ownership; ordinary observations stay [start,end). A shorter selected audio stream never relocates the capture endpoint. Video scenes use retained physical picture clocks without requiring capture metadata. Initial reads may be not_ready during scene preparation; inspect returned dependency/job state and use job.retry for explicit recovery. Project cut rows describe track-local editorial mapping transitions with exact projectAtUs, audio/video mediaKind and nullable before/after sides; they are not measured scene changes or proof of a visible composite change. Continuous pure splits do not create cuts; internal entrances/exits and rate changes do. Cut queries use [start,end), while physical support gaps remain availability evidence. Cut coverage is supplied by the pinned project revision, independently of source cut availability. Preserve first-page coverage and exact projectAtUs values across continuations. Continue while nextCursor exists, even if rows is empty. Adjacent rows with equal atUs form one logical group and may span pages. A cursor pins its target, revision and source/scene generations.",
    ),
  z
    .object({
      operation: z.literal("cursor.raw"),
      params: z.union([
        projectEvidenceParams.extend({ limit: z.int().min(1).max(5000).optional() }),
        sourceCaptureParams(5000),
      ]),
    })
    .strict()
    .describe(
      "Page raw cursor observations with explicit capture authority. Selected assets use sourceRange and require acquisitionId for captured video; project selectors use range/revisionId/trackIds and return each retained occurrence with exact projectAtUs. Raw coordinates, captureAtUs and integrity receipt remain unchanged; this does not simulate crop/zoom. Missing capture metadata reports unavailable coverage. Keep first-page coverage and continue while nextCursor exists, even on empty pages.",
    ),
  z
    .object({ operation: z.literal("update.status"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Read the native updater's availability, automatic-update preference, manual-check readiness and current result without checking the feed.",
    ),
  z
    .object({ operation: z.literal("update.check"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Check immediately and download an available compatible update, even when automatic updates are disabled. Does not change that preference or interrupt work; installation waits for existing idle admission and CLI clients to finish. Follow update.status for progress.",
    ),
  z
    .object({
      operation: z.literal("update.setEnabled"),
      params: z.object({ enabled: z.boolean() }).strict(),
    })
    .strict()
    .describe(
      "Set the native updater's persisted automatic checks/downloads/installation preference. Disabling cancels pending automatic or manual update work before final replacement authorization; after that boundary it applies to the successor.",
    ),
  z
    .object({ operation: z.literal("service.health"), params: z.object({}).strict() })
    .strict()
    .describe("Read local service readiness without starting capture."),
  z
    .object({ operation: z.literal("service.tools"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Discover the selected app's Node runtime and verified bundled FFmpeg/ffprobe paths, hashes, version and configuration. Missing or mismatched tools report unavailable without changing native defaults; tool inventory does not imply core operation support.",
    ),
  z
    .object({ operation: z.literal("capture.sources"), params: z.object({}).strict() })
    .strict()
    .describe(
      "List screen sources, microphones and camera discovery identities without activating devices. Camera selection is explicit and never requests permission automatically.",
    ),
  z
    .object({
      operation: z.literal("capture.start"),
      params: captureSelectionSchema.safeExtend({ requestId: id }).strict(),
    })
    .strict()
    .describe("Allocate a take and start capturing it; a repeated request ID replays one take."),
  z
    .object({ operation: z.literal("capture.status"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Read native device state, screen/microphone/camera permission facts and the active or recovering take. A finalizing take can retain finalizationError across service restart; stop explicitly retries failed recovery.",
    ),
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
    .describe(
      "Begin finalizing the named take or explicitly retry its failed recovery. A finalizing acknowledgment is not completion: inspect recording.get/status, including finalizationError, and await terminal state before importing. A settled take answers with its stored outcome.",
    ),
  z
    .object({ operation: z.literal("capture.cancel"), params: recording })
    .strict()
    .describe(
      "Cancel the named live take. During recovery, abort and drain finalization while retaining ambiguous media and its finalizationError; use stop to retry or explicit library deletion to remove retained bytes. A take that already finished cannot be canceled.",
    ),
  z
    .object({
      operation: z.literal("capture.restart"),
      params: captureSelectionSchema.safeExtend({ recordingId: id, requestId: id }).strict(),
    })
    .strict()
    .describe(
      "Discard the named take and start a distinct new one. Pending recovery returns a retryable refusal and does not start a replacement; inspect the previous take before a new restart request.",
    ),
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
    .object({ operation: z.literal("recording.cleanup"), params: recording })
    .strict()
    .describe(
      "Explicitly reclaim verified publication working files from a settled recording. Returns a job; use job.get, job.retry and job.cancel. Unverified media remains retained; recording state and canonical media are unchanged.",
    ),
  z
    .object({ operation: z.literal("recording.get"), params: recording })
    .strict()
    .describe(
      "Read one recording by its stable identity, including unfinished finalizationError and terminal interruptionReason. PUBLICATION_CONFLICT denotes conflicting publication media or proof identities; the code alone does not identify the particular file or establish which streams remain readable.",
    ),
  z
    .object({
      operation: z.literal("revision.get"),
      params: project.extend({ revisionId: id.optional() }).strict(),
    })
    .strict()
    .describe("Read a specified revision, or resolve the current authored project revision once."),
  z
    .object({
      operation: z.literal("revision.history"),
      params: historyParams(project).extend({ limit: z.int().min(1).max(1000).optional() }),
    })
    .strict()
    .describe("Read a bounded page of history pinned to its initial revision ordinal."),
  z
    .object({ operation: z.literal("edit.undo"), params: projectEdit })
    .strict()
    .describe("Undo the active edit by creating a new revision identity."),
  z
    .object({
      operation: z.literal("edit.restore"),
      params: projectEdit.extend({ targetRevisionId: id }),
    })
    .strict()
    .describe("Restore a historical edit into a new revision identity."),
]);

export type OperationName = z.infer<typeof operationSchema>["operation"];
export const operationNames: ReadonlySet<string> = new Set(
  operationSchema.options.map((option) => option.shape.operation.value),
);
/** Updater inspection/cancellation owns no media resources and must remain usable during admission. */
export const updateCommandOperations: ReadonlySet<string> = new Set(
  [...operationNames].filter((name) => name.startsWith("update.")),
);

const nativeCall = DEFAULT_CALL_TIMEOUT_MS;
const workerRun = MEDIA_WORKER_TIMEOUT_MS;
// Drains and scans wait on other work finishing; a retry joins the same in-flight work.
const drain = 180_000;
const waits: Partial<Record<OperationName, number>> = {
  "update.status": nativeCall,
  "update.check": nativeCall,
  "update.setEnabled": nativeCall,
  "capture.sources": nativeCall,
  "capture.status": nativeCall,
  "capture.pause": nativeCall,
  "capture.resume": nativeCall,
  // Recovery is acknowledged; only native termination and authoritative quiet inspection wait here.
  "capture.cancel": 2 * nativeCall,
  "capture.stop": 2 * nativeCall,
  // An unanswered start can require stop and quiet inspection before recovery acknowledgment.
  "capture.start": 3 * nativeCall,
  "capture.restart": 4 * nativeCall,
  "export.create": workerRun,
  "export.abandon": drain,
  "package.open": drain,
  "package.close": drain,
  "recording.delete": drain,
  "job.cancel": drain,
  "project.delete": drain,
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
