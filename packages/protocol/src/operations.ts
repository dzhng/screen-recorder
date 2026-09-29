import {
  outputSettingsSchema,
  compositionSchema,
  mediaClipSchema,
  editOperationSchema,
  textSeedCuesSchema,
  processingTargetSchema,
  processingTapSchema,
} from "@screenrec/composition";
import { z } from "zod";
import { captureSelectionSchema } from "./capture.js";
import { DEFAULT_CALL_TIMEOUT_MS, MEDIA_WORKER_TIMEOUT_MS } from "./framing.js";

const id = z.string().min(1);
/** The most bytes one artifact.read returns. */
export const ARTIFACT_CHUNK_BYTES = 512 * 1024;
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
const sourceSelection = mediaClipSchema.pick({
  assetId: true,
  streamId: true,
  acquisitionId: true,
});
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
};
const previewParams = z.union([
  inspection({ revisionId: id.optional() }),
  project
    .extend({
      revisionId: id.optional(),
      settings: outputSettingsSchema.optional(),
      range: range
        .refine(({ startUs, endUs }) => endUs > startUs, {
          message: "Preview range must be positive",
        })
        .optional(),
    })
    .strict(),
]);
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
const projectFrameParams = project
  .extend({
    revisionId: id.optional(),
    atUs: time,
    maxLongEdge: frameFields.maxLongEdge,
    tap: processingTapSchema.optional(),
  })
  .strict();
const sourceFrameParams = sourceSelection
  .extend({
    atUs: time,
    maxLongEdge: frameFields.maxLongEdge,
  })
  .strict();
const frameParams = z.union([
  projectFrameParams,
  ...inspection(frameFields).options,
  sourceFrameParams,
  sourceSelection
    .omit({ acquisitionId: true })
    .extend({ maxLongEdge: frameFields.maxLongEdge })
    .strict(),
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
const sourceAudioParams = sourceSelection.extend({ range: audioRange.optional() }).strict();
const audioParams = z.union([
  projectAudioParams,
  ...inspection({
    revisionId: id.optional(),
    range: range.refine(({ startUs, endUs }) => endUs > startUs && endUs - startUs <= 30_000_000, {
      message: "Audio range must be positive and no longer than 30 seconds",
    }),
    track: z.enum(["narration", "system", "mix"]).default("mix"),
  }).options,
  sourceAudioParams,
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

const indexFields = { revisionId: id, generation: id };
const projectIndexParams = projectFrameParams.omit({ atUs: true });
const projectIndexReference = projectIndexParams.required().extend({ generation: id });
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
const processingArtifact = z.enum(["source", "scenes", "transcript"]);
const transcriptPosition = { revisionId: id, generation: id, afterSourceUs: time };
/** A package's transcript cursor still names the embedded recording its generation belongs to. */
const transcriptPage = <S extends z.ZodRawShape, C extends z.ZodRawShape>(fields: S, position: C) =>
  z.union([
    paged(recording, fields, position),
    packageTarget
      .extend({ ...fields, cursor: recording.extend(position).strict().optional() })
      .strict(),
  ]);

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
      "Seed explicitly grouped text clips from pinned transcript generations and occurrence word rows. Supply each cue's source, original occurrence clip ID, exact word ordinals/source ranges, separator, style and project/content/clip anchor domain. Expands one atomic ordinary placement batch; returns revision.document as the sole document, plus edit receipts with normalized edits and labels. Display text remains editable independently of retained transcript origin. Reuse requestId only for the same pinned request. At most 1000 cues and 10000 total word pins.",
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
    .object({ operation: z.literal("output.capabilities"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Discover project movie encoding controls, editable presets, backend capabilities and unsupported combinations. Internal mixing is 48000 Hz stereo; encoded AAC rate/layout is independently selectable. Requested bitrate is not measured file bitrate.",
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
    .object({ operation: z.literal("asset.get"), params: z.object({ assetId: id }).strict() })
    .strict()
    .describe(
      "Read immutable admitted stream metadata or non-timed fontFaces. Select a font face by assetId and its exact postScriptName; names are scoped to those immutable bytes, not the installed system fonts.",
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
        recording
          .extend({ ...exportDestination, kind: z.enum(["video", "processed-package"]) })
          .strict(),
        project
          .extend({
            ...exportDestination,
            kind: z.enum(["video", "processed-package"]),
            settings: outputSettingsSchema.optional(),
          })
          .strict(),
      ]),
    })
    .strict()
    .describe(
      "Export a pinned revision to an existing absolute directory without replacing files. Reuse exportId for a lost response; poll export.status. Managed projects export video or an editable processed-package ZIP; recordings export video or their processed-package ZIP. Project packaging currently requires the current revision and refuses acquisition/evidence dependencies whose portable adoption is not implemented. Package export requires all acquired evidence: acquired narration waits for its transcript, reports MODEL_NOT_PREPARED until model.prepare has completed, and fails if transcription failed until processing.retry succeeds.",
    ),
  z
    .object({
      operation: z.literal("export.list"),
      params: z
        .object({
          recordingId: id.optional(),
          projectId: id.optional(),
          unfinishedOnly: z.boolean().optional(),
          limit: z.int().min(1).max(500).optional(),
          cursor: z
            .object({
              recordingId: id.nullable(),
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
      "Discover persisted export summaries after restart without starting work. Defaults to 100, maximum 500. unfinishedOnly includes uncommitted exports, abandonment and private cleanup. Filter by recordingId or projectId. Cursor binds both owner filters and unfinishedOnly. Pages follow live lexical export IDs; start a fresh traversal for new arrivals before your cursor. Use export.status for details.",
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
      params: z.object({ recordingId: id.optional() }).strict(),
    })
    .strict()
    .describe(
      "Read live logical regular-file byte usage, including unfinished work and pending deletions. Omit recordingId for all managed storage plus shared database/unattributed bytes. Models and external exports are excluded; files may change while scanned.",
    ),
  z
    .object({
      operation: z.literal("index.get"),
      params: z.union([
        projectIndexParams.extend({
          limit: z.int().min(1).max(200).default(50),
          cursor: projectIndexReference.extend({ afterOrdinal: z.int().nonnegative() }).optional(),
        }),
        ...inspectionPage(
          { revisionId: id.optional(), limit: z.int().min(1).max(200).default(50) },
          indexPosition,
        ).options,
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
      "Request a retained screenshot index for a project, recording, package or selected asset video stream. Projects select the whole revision and an optional video tap, defaulting to processed output; maxLongEdge controls picture size. Source selectors use assetId/streamId and optional acquisitionId. Scene preparation precedes index preparation. Returns readiness until complete, then paged metadata with selection reasons and stable frame references. An empty index may be ready. Project coverage marks only delivered frame visibility as sampled; intervening ranges remain unproven. Continue with the returned cursor to pin identity; use index.frame or index.frames for image bytes.",
    ),
  z
    .object({
      operation: z.literal("index.retry"),
      params: z.union([
        projectIndexParams,
        recording.extend({ revisionId: id.optional() }).strict(),
        sourceSelection,
      ]),
    })
    .strict()
    .describe(
      "Explicitly retry failed or canceled screenshot index processing. Project and source selectors also retry their retryable terminal scene or frame prerequisites; ordinary reads do not restart terminal work. Recording source/scene dependencies require their own processing.retry.",
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
        ...inspectionPage(
          {
            ...indexFields,
            candidateOrdinal: z.int().nonnegative().optional(),
            limit: z.int().min(1).max(200).default(50),
          },
          coveragePosition,
        ).options,
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
        ...inspection({ ...indexFields, ordinal: z.int().nonnegative() }).options,
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
        ...inspection({
          ...indexFields,
          ordinals: z.array(z.int().nonnegative()).min(1).max(8),
        }).options,
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
    .object({
      operation: z.literal("transcript.get"),
      params: z.union([
        projectEvidenceParams,
        ...transcriptPage(
          {
            revisionId: id.optional(),
            range: range.optional(),
            limit: z.int().min(1).max(1000).default(250),
          },
          { ...transcriptPosition, afterOrdinal: time.nullable(), range: range.nullable() },
        ).options,
        sourceSelection
          .extend({
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
      "Request a project transcript with projectId and optional revisionId, range and trackIds, a selected asset-stream source transcript, or the narration transcript of a recording/open package projected through a revision. Project rows retain occurrence identity and exact editorial fragments, ordered by project time; query windows do not change editorial partiality. Continue even when a project page is empty if nextCursor exists. Project continuations pin the original revision and source generations. Asset ranges use the normalized source clock; acquisitionId omission uses physical support. Returns readiness until complete, then word and acquisition-gap rows in the selected time domain. Asset ranges select source windows and mark intersected rows partial while preserving their full source range. Recording/package ranges select playback windows and include retained fragments. Words keep verbatim text, kind and a per-generation ID. Without narration it is unavailable:no_narration; unprepared models are a retryable unavailable:model_not_prepared (see model.prepare). Continue with the returned cursor to pin selection, generation and range, plus revision for recording/package reads.",
    ),
  z
    .object({
      operation: z.literal("transcript.search"),
      params: z.union([
        projectEvidenceParams
          .extend({ text: z.string().min(1).max(200), limit: z.int().min(1).max(500).optional() })
          .strict(),
        ...transcriptPage(
          {
            revisionId: id.optional(),
            text: z.string().min(1).max(200),
            limit: z.int().min(1).max(500).default(100),
          },
          { ...transcriptPosition, afterOrdinal: time, text: z.string() },
        ).options,
        sourceSelection
          .extend({
            text: z.string().min(1).max(200),
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
      "Search a project, selected source or ready narration transcript for literal, case-folded text over consecutive words, ignoring outer punctuation. Project matches follow consecutive whole words on each selected audio track, may cross contiguous clips, and stop at gaps or partial words. Each match carries all contributing word/clip identities and exact projectRange; simultaneous speakers never form a shared phrase. Source entries carry word IDs and source range; phrases cannot cross transcript segments. Recording/package entries also carry retained fragments; words cut from the revision never match. Returns readiness like transcript.get until complete. Continue while nextCursor exists, even if entries is empty, to keep the same revision, generation and text.",
    ),
  z
    .object({
      operation: z.literal("transcript.retry"),
      params: z.union([
        sourceSelection,
        projectEvidenceParams
          .omit({ cursor: true, limit: true })
          .extend({ text: z.string().min(1).max(200).optional() })
          .strict(),
      ]),
    })
    .strict()
    .describe(
      "Explicitly prepare or retry the selected asset-stream transcript without downloading models. A project selector retries only its evidence manifest (include the same text to retry phrase search); source preparation failures must be retried with their returned asset-stream selection. Keep the same acquisition selection; preparation uses a fresh generation after failure.",
    ),
  z
    .object({ operation: z.literal("model.status"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Read the local speech model without using the network: absent, preparing with received and total bytes, ready, invalid, or failed with a code and retryability.",
    ),
  z
    .object({ operation: z.literal("model.prepare"), params: z.object({}).strict() })
    .strict()
    .describe(
      "Download and verify the pinned speech model (about 465 MB) and answer at once with model.status; poll model.status for progress. Joins a download already running, and a ready model is not downloaded again. The only operation that uses the network: transcription never downloads. Waiting transcripts start once the model is ready.",
    ),
  z
    .object({
      operation: z.literal("frame.batch"),
      params: z.union([
        projectFrameParams.extend({ atUs: z.array(time).min(1).max(8) }),
        ...inspection({ ...frameFields, atUs: z.array(time).min(1).max(8) }).options,
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
      "Request a playable MP4 of a pinned project, recording or relocated package. Projects accept an optional range in project microseconds; omitted range renders the whole project. Recording/package previews retain their current pointer and acquired audio. Returns readiness until complete; pin the returned revision when polling. CLI writes a file; MCP returns a delivery token for artifact.read/close.",
    ),
  z
    .object({
      operation: z.literal("preview.retry"),
      params: previewParams,
    })
    .strict()
    .describe(
      "Explicitly retry failed preview rendering for the same pinned revision. Failed source dependencies require processing.retry.",
    ),
  z
    .object({
      operation: z.literal("audio.prepare"),
      params: project.extend({ revisionId: id }).strict(),
    })
    .strict()
    .describe(
      "Explicitly prepare the full processed audio output of a pinned project revision as a retained lossless 48kHz stereo asset. Does not change the document or current revision. Returns readiness/jobId and a published audio receipt with assetId; use asset.get to discover its stream and existing audio/waveform/spectrogram inspection. Repeat the exact selection to reuse work; failed/canceled work requires explicit job.retry, and job.cancel drains an attempt. Unavailable processors or retiming refuse before admission; no model is downloaded. This prepares only the full output domain, not an arbitrary clip or range.",
    ),
  z
    .object({ operation: z.literal("audio.get"), params: audioParams })
    .strict()
    .describe(
      "Request project WAV audio with projectId, optional revisionId/range and processing tap (defaults to processed output). Clip/track/group taps exclude later parent stages; dry skips the selected target stack while retaining child processing, and after-step includes the named step. Omitted project range uses the full pinned project; project output is 48kHz stereo and ranges retain the absolute sample clock. Or request a WAV from an explicitly selected assetId/streamId with optional acquisitionId and source-time range. Omitted source range extracts the full selected stream at its native supported rate/layout; unavailable support is explicit. Recording/package selectors use their bounded playback excerpts and track selection. CLI streams to a file; MCP embeds small audio and leaves large audio as a renewable artifact.read/close delivery. Pin selection, range and any returned revision while polling.",
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
      "Request a raw PNG/JPEG image with assetId, streamId and optional maxLongEdge; omit atUs and acquisitionId for images. The delivered PNG is upright; its receipt retains source orientation and has no sample clock. Request a selected video source picture with assetId, streamId, optional acquisitionId and source-clock atUs. Physical gaps return unavailable without a synthetic image. Or request a project picture at atUs with optional revisionId, maxLongEdge and video processing tap. Its global sample time can precede the requested time; the receipt separates compiled timing from actual decoded source samples. Project stills use the movie compositor and do not add capture pointer overlays. Recording/package selectors request a frame at edited playback time with an observed pointer and two-second trail by default. Use clean:true for no overlay or trailUs:0 for pointer only. Pin the returned revision when polling.",
    ),
  z
    .object({ operation: z.literal("frame.retry"), params: frameParams })
    .strict()
    .describe(
      "Explicitly retry failed frame processing using the same pinned request. Recording/package source dependencies require their own processing.retry.",
    ),
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
      params: z.union([
        projectEvidenceParams.extend({ limit: z.int().min(1).max(500).optional() }),
        ...inspection({
          revisionId: id.optional(),
          cursor: z.string().min(1).max(4096).optional(),
          limit: z.int().min(1).max(500).default(100),
        }).options,
        sourceCaptureParams(500, true),
      ]),
    })
    .strict()
    .describe(
      "Read measured source scene changes, captured pause/geometry and explicit capture-end interruption markers for a selected asset stream or project. Source selectors use sourceRange; project selectors use range/revisionId/trackIds. Capture identity requires explicit acquisitionId; missing metadata is unavailable, not an empty success. Timed geometry belongs to captured video; pauses follow each bound timed occurrence. Normal completion contributes no interruption marker. Capture-end markers require trustworthy timed completion; missing, damaged or conflicting termination is explicitly unavailable. These closing boundaries use left support and (start,end] query ownership; ordinary observations stay [start,end). A shorter selected audio stream never relocates the capture endpoint. Video scenes use retained physical picture clocks without requiring capture metadata. Initial reads may be not_ready during scene preparation; inspect returned dependency/job state and use job.retry for explicit recovery. Project cut rows describe track-local editorial mapping transitions with exact projectAtUs, audio/video mediaKind and nullable before/after sides; they are not measured scene changes or proof of a visible composite change. Continuous pure splits do not create cuts; internal entrances/exits and rate changes do. Cut queries use [start,end), while physical support gaps remain availability evidence. Cut coverage is supplied by the pinned project revision, independently of source cut availability. Preserve first-page coverage and exact projectAtUs values across continuations. Recording/package selectors retain pause, cut, geometry, scene and interruption markers in pinned playback time. Continue while nextCursor exists, even if rows is empty. Adjacent rows with equal atUs form one logical group and may span pages. A cursor pins its target, revision and source/scene generations; included package history can be inspected explicitly.",
    ),
  z
    .object({
      operation: z.literal("cursor.raw"),
      params: z.union([
        projectEvidenceParams.extend({ limit: z.int().min(1).max(5000).optional() }),
        ...inspectionPage(
          { sourceRange: cursorRange, limit: z.int().min(1).max(5000).default(1000) },
          {
            sourceId: id,
            generation: id,
            sourceRange: cursorRange,
            afterSequence: z.int().positive(),
          },
        ).options,
        sourceCaptureParams(5000),
      ]),
    })
    .strict()
    .describe(
      "Page raw cursor observations with explicit capture authority. Selected assets use sourceRange and require acquisitionId for captured video; project selectors use range/revisionId/trackIds and return each retained occurrence with exact projectAtUs. Raw coordinates, captureAtUs and integrity receipt remain unchanged; this does not simulate crop/zoom. Missing capture metadata reports unavailable coverage. Keep first-page coverage and continue while nextCursor exists, even on empty pages. Recording/package selectors retain their bounded source-time reads.",
    ),
  z
    .object({
      operation: z.literal("processing.status"),
      params: recording.extend({ artifact: processingArtifact.default("source") }).strict(),
    })
    .strict()
    .describe("Read source, scene or transcript processing state and its published generation."),
  z
    .object({
      operation: z.literal("processing.retry"),
      params: recording.extend({ artifact: processingArtifact }).strict(),
    })
    .strict()
    .describe(
      "Explicitly start or retry source, scene or transcript processing; returns the running job instead of duplicating it. A transcript needs a prepared model.",
    ),
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
    .describe(
      "Begin finalizing the named take. A finalizing acknowledgment is not completion: inspect the reported terminal state before importing. A settled take answers with its stored outcome.",
    ),
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
      params: z.union([
        inspection({ revisionId: id.optional() }),
        project.extend({ revisionId: id.optional() }).strict(),
      ]),
    })
    .strict()
    .describe(
      "Read a specified revision, or resolve the current recording/project revision or package exported revision once. Package history may contain newer entries than its exported revision.",
    ),
  z
    .object({
      operation: z.literal("revision.history"),
      params: z.union([
        historyParams(recording),
        historyParams(packageTarget),
        historyParams(project).extend({ limit: z.int().min(1).max(1000).optional() }),
      ]),
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
    .object({ operation: z.literal("edit.undo"), params: z.union([edit, projectEdit]) })
    .strict()
    .describe("Undo the active edit by creating a new revision identity."),
  z
    .object({
      operation: z.literal("edit.restore"),
      params: z.union([
        edit.extend({ targetRevisionId: id }),
        projectEdit.extend({ targetRevisionId: id }),
      ]),
    })
    .strict()
    .describe("Restore a historical edit into a new revision identity."),
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
  // An absent native take requires recovery before cancellation can discard its source.
  "capture.cancel": nativeCall + workerRun,
  // A stop native cannot perform is settled from the take's media by a recovery run.
  "capture.stop": nativeCall + workerRun,
  // An unanswered start is stopped and then recovered the same way.
  "capture.start": 2 * nativeCall + workerRun,
  // Discard and an unanswered replacement start can each require recovery.
  "capture.restart": 3 * nativeCall + 2 * workerRun,
  "export.create": workerRun,
  "export.abandon": drain,
  "package.open": drain,
  "package.close": drain,
  "recording.delete": drain,
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
