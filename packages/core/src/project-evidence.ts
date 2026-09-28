import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  compare,
  fromTime,
  toTime,
  floor,
  ceil,
  createSourceRangeProjection,
  isMediaClip,
  rangeSchema,
  validateComposition,
  type ExactRange,
  type SelectionRange,
  type TimeValue,
  type SourceWindowOccurrence,
} from "@screenrec/composition";
import { AssetStore, compositionAsset } from "./assets.js";
import { CatalogError } from "./catalog.js";
import { ProjectStore } from "./projects.js";
import type { JobExecution, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";
import type { RetainedRead } from "./files.js";
import { submitCachedDerivative } from "./cached-derivative.js";
import { TranscriptProcessing } from "./transcript-processing.js";
import { SourceTranscriptRead, type SourceTranscriptRow } from "./transcript-read.js";
import type { TranscriptMetadata, TranscriptRecords } from "./transcript.js";
import type { SourceSelection } from "./source-selection.js";

const artifact = "project.evidence";
const policy = "project-transcript-v1";
// Provisional inspection budgets; scale acceptance owns changes to these limits.
const maximumBytes = 8 * 1024 * 1024;
const scanBudget = 128;
const cursorSchema = z.strictObject({
  projectId: z.string(),
  revisionId: z.string(),
  manifestId: z.uuid(),
  checkpointId: z.uuid(),
  queryDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ProjectEvidenceCursor = z.infer<typeof cursorSchema>;
export type ProjectEvidenceInput = {
  projectId: string;
  revisionId?: string | undefined;
  range?: { startUs: number; endUs: number } | undefined;
  trackIds?: readonly string[] | undefined;
  limit?: number | undefined;
  cursor?: unknown;
};
type Query = {
  domain: "transcript";
  projectId: string;
  revisionId: string;
  range: { startUs: number; endUs: number };
  trackIds: string[];
  policy: string;
};
type Dependency = {
  selection: SourceSelection;
  transcript: TranscriptMetadata | null;
  state: string;
  reason: string | null;
  retryable: boolean;
  jobId: string | null;
};
type Manifest = {
  query: Query;
  queryDigest: string;
  dependencies: Dependency[];
  tracks: { clipIds: string[]; lowerBound: TimeValue }[];
};
type Key = {
  projectStartUs: TimeValue;
  trackRank: number;
  clipId: string;
  sourceOrdinal: number;
  eventKind: "gap" | "word";
};
export type ProjectTranscriptRow = {
  clipId: string;
  assetId: string;
  streamId: string;
  acquisitionId?: string;
  trackId: string;
  trackRank: number;
  generation: string | null;
  sourceRange: SelectionRange;
  fragments: { source: SelectionRange; project: SelectionRange }[];
  partial: boolean;
} & (
  | Omit<Extract<SourceTranscriptRow, { type: "word" }>, "sourceRange" | "partial">
  | Omit<Extract<SourceTranscriptRow, { type: "gap" }>, "sourceRange" | "partial">
);

type Candidate = { key: Key; row: ProjectTranscriptRow };
type TrackState = {
  clip: number;
  gap: number;
  cursor: unknown;
  done: boolean;
  pending: Candidate | null;
  head: Candidate | null;
  headKind: "source" | "gap" | null;
};
type Checkpoint = {
  manifestId: string;
  queryDigest: string;
  initialized: number;
  pendingTrack: number | null;
  tracks: TrackState[];
  heap: number[];
  last: Key | null;
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const selectionKey = (value: SourceSelection) =>
  JSON.stringify([value.assetId, value.streamId, value.acquisitionId ?? null]);
const range = (value: ExactRange): SelectionRange => ({
  startUs: toTime(value.start),
  endUs: toTime(value.end),
});
const changed = () =>
  new CatalogError("ARTIFACT_CHANGED", "Project evidence continuation or dependencies changed");
// Equal-time gap/word ties follow the contract's source ordinal, then gap before word.
function compareKey(a: Key, b: Key) {
  return (
    compare(fromTime(a.projectStartUs), fromTime(b.projectStartUs)) ||
    a.trackRank - b.trackRank ||
    (a.clipId < b.clipId ? -1 : a.clipId > b.clipId ? 1 : 0) ||
    a.sourceOrdinal - b.sourceOrdinal ||
    (a.eventKind === b.eventKind ? 0 : a.eventKind === "gap" ? -1 : 1)
  );
}
function initialTrack(): TrackState {
  return { clip: 0, gap: 0, cursor: null, done: false, pending: null, head: null, headKind: null };
}

/** Immutable query manifests and resumable merge checkpoints share the project's disposable cache. */
export class ProjectEvidenceInspection {
  constructor(
    private readonly options: {
      projects: ProjectStore;
      assets: AssetStore;
      jobs: JobQueue;
      cache: DerivedCache;
      transcripts: TranscriptProcessing;
      records: TranscriptRecords;
    },
  ) {}

  private readonly revisions = new Map<
    string,
    {
      model: ReturnType<typeof validateComposition>;
      projection: ReturnType<typeof createSourceRangeProjection>;
      audioTracks: string[];
      audioIds: Set<string>;
    }
  >();

  private plan(input: ProjectEvidenceInput, allowEmpty = false) {
    const project = this.options.projects.get(input.projectId);
    const revisionId = input.revisionId ?? project.currentRevisionId;
    const key = JSON.stringify([input.projectId, revisionId]);
    let context = this.revisions.get(key);
    if (!context) {
      const revision = this.options.projects.revision(input.projectId, revisionId);
      const ids = [
        ...new Set(revision.document.clips.filter(isMediaClip).map((clip) => clip.assetId)),
      ];
      const model = validateComposition(
        revision.document,
        ids.map((id) => compositionAsset(this.options.assets.get(id))),
        this.options.projects.contexts(revision.document),
      );
      const audioTracks = model.document.tracks
        .filter((track) => track.kind === "audio")
        .map((track) => track.id);
      context = {
        model,
        projection: createSourceRangeProjection(model),
        audioTracks,
        audioIds: new Set(audioTracks),
      };
    }
    this.revisions.delete(key);
    this.revisions.set(key, context);
    if (this.revisions.size > 4) this.revisions.delete(this.revisions.keys().next().value!);
    const { model, projection, audioTracks, audioIds } = context;
    const empty =
      model.durationUs === 0 &&
      (input.range === undefined ||
        (allowEmpty && input.range.startUs === 0 && input.range.endUs === 0));
    const parsed = empty
      ? { success: true as const, data: { startUs: 0, endUs: 0 } }
      : rangeSchema.safeParse(input.range ?? { startUs: 0, endUs: model.durationUs });
    if (!parsed.success || parsed.data.endUs > model.durationUs)
      throw new CatalogError("INVALID_RANGE", "Evidence range must be within the project");
    const trackIds = [...new Set(input.trackIds ?? audioTracks)].sort();
    if (trackIds.some((id) => !audioIds.has(id)))
      throw new CatalogError("INVALID_PARAMS", "Transcript tracks must be audio tracks");
    const occurrences = empty ? [] : projection.window({ range: parsed.data, trackIds });
    if (occurrences.length > 10000)
      throw new CatalogError("LIMIT_EXCEEDED", "Evidence window exceeds 10000 occurrences");
    const query: Query = {
      domain: "transcript",
      projectId: input.projectId,
      revisionId,
      range: parsed.data,
      trackIds,
      policy,
    };
    return { query, queryDigest: digest(query), projection, occurrences };
  }
  private dependencies(occurrences: SourceWindowOccurrence[], prepare: boolean): Dependency[] {
    const selections = new Map<string, SourceSelection>();
    for (const value of occurrences) {
      const selection = {
        assetId: value.assetId,
        streamId: value.streamId,
        ...(value.acquisitionId === undefined ? {} : { acquisitionId: value.acquisitionId }),
      };
      selections.set(selectionKey(selection), selection);
    }
    if (selections.size > 1024)
      throw new CatalogError("LIMIT_EXCEEDED", "Evidence window exceeds 1024 sources");
    return [...selections]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, selection]) => {
        const status = prepare
          ? this.options.transcripts.publishedSource(selection)
          : this.options.transcripts.sourceStatus(selection);
        return {
          selection,
          transcript: status.published?.transcript ?? null,
          state: status.published ? "ready" : status.state,
          reason: status.published ? null : status.reason,
          retryable: status.published ? false : status.retryable,
          jobId: status.jobId,
        };
      });
  }
  private pins(dependencies: Dependency[]) {
    return dependencies.map(({ selection, transcript, state, reason }) => ({
      selection,
      generation: transcript?.generation ?? null,
      source: transcript?.source ?? null,
      engine: transcript?.engine ?? null,
      state,
      reason,
    }));
  }
  request(input: ProjectEvidenceInput) {
    const plan = this.plan(input),
      dependencies = this.dependencies(plan.occurrences, true);
    const pending = dependencies.filter(
      (dependency) => !dependency.transcript && dependency.reason !== "no_audio",
    );
    if (pending.length)
      return {
        ...plan.query,
        state: "not_ready",
        reason: "source_evidence_not_ready",
        retryable: pending.some((d) => d.retryable),
        jobId: null,
        published: null,
        dependencies,
      };
    const status = submitCachedDerivative<{ cacheId: string }>(
      this.options.jobs,
      this.options.cache,
      {
        target: { kind: "project", projectId: input.projectId, revisionId: plan.query.revisionId },
        artifact,
        input: JSON.stringify({ query: plan.query, pins: digest(this.pins(dependencies)) }),
      },
      "frame",
    );
    return { ...plan.query, ...status, dependencies };
  }
  retry(input: ProjectEvidenceInput) {
    const status = this.request(input);
    if (!status.jobId)
      throw new CatalogError(
        "NOT_READY",
        "Source evidence is not ready",
        { dependencies: status.dependencies },
        status.retryable,
      );
    this.options.jobs.retry(status.jobId);
    return this.request(input);
  }
  async execute({ job, signal }: JobExecution) {
    if (job.target.kind !== "project" || job.artifact !== artifact)
      throw new CatalogError("UNSUPPORTED_JOB", "Project evidence needs a project target");
    const input = JSON.parse(job.input) as { query: Query; pins: string };
    const plan = this.plan(
      { ...input.query, projectId: job.target.projectId, revisionId: job.target.revisionId },
      true,
    );
    const dependencies = this.dependencies(plan.occurrences, false);
    if (
      digest(this.pins(dependencies)) !== input.pins ||
      digest(plan.query) !== digest(input.query)
    )
      throw changed();
    const byTrack = new Map(plan.query.trackIds.map((id) => [id, [] as string[]]));
    for (const clip of plan.occurrences) byTrack.get(clip.trackId)!.push(clip.clipId);
    const tracks = [...byTrack.values()]
      .flatMap((clipIds) => {
        return clipIds.length
          ? [
              {
                clipIds,
                lowerBound: toTime(
                  plan.projection.inverse(clipIds[0]!, {
                    startUs: 0,
                    endUs: plan.query.range.endUs,
                  })!.project.start,
                ),
              },
            ]
          : [];
      })
      .sort((a, b) => compare(fromTime(a.lowerBound), fromTime(b.lowerBound)));
    const manifest: Manifest = {
      query: plan.query,
      queryDigest: plan.queryDigest,
      dependencies,
      tracks,
    };
    const cacheId = await this.publish(plan.query.projectId, manifest, signal);
    return JSON.stringify({ cacheId });
  }
  private acquire<T>(id: string, leases: RetainedRead[]): T {
    const read = this.options.cache.acquire(id);
    if (!read) throw changed();
    leases.push(read);
    if (read.bytes > maximumBytes)
      throw new CatalogError("LIMIT_EXCEEDED", "Evidence cache exceeds its bound");
    const buffer = Buffer.alloc(read.bytes);
    let at = 0;
    while (at < buffer.length) {
      const bytes = read.read(buffer.subarray(at), at);
      if (!bytes) throw changed();
      at += bytes;
    }
    try {
      return JSON.parse(buffer.toString("utf8")) as T;
    } catch {
      throw changed();
    }
  }
  private async publish(projectId: string, value: unknown, signal?: AbortSignal) {
    const body = JSON.stringify(value);
    if (Buffer.byteLength(body) > maximumBytes)
      throw new CatalogError("LIMIT_EXCEEDED", "Evidence checkpoint exceeds 8MiB");
    signal?.throwIfAborted();
    const reservation = this.options.cache.reserve({ kind: "project", projectId });
    try {
      await writeFile(reservation.path, body, { flag: "wx" });
      signal?.throwIfAborted();
      await this.options.cache.publish(reservation.id);
      signal?.throwIfAborted();
      return reservation.id;
    } catch (error) {
      this.options.cache.remove(reservation.id);
      throw error;
    }
  }

  async get(input: ProjectEvidenceInput) {
    const parsed = input.cursor === undefined ? null : cursorSchema.safeParse(input.cursor);
    if (parsed && !parsed.success)
      throw new CatalogError("INVALID_PARAMS", "Invalid project evidence cursor");
    const cursor = parsed?.success ? parsed.data : null;
    if (
      cursor &&
      (cursor.projectId !== input.projectId ||
        (input.revisionId !== undefined && input.revisionId !== cursor.revisionId))
    )
      throw changed();
    const limit = input.limit ?? 250;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new CatalogError("INVALID_PARAMS", "Limit must be 1 to 1000");
    const leases: RetainedRead[] = [];
    let created: string | null = null;
    try {
      const status = cursor ? null : this.request(input);
      if (status && !status.published) return { ...status, page: null };
      const manifestId = cursor?.manifestId ?? status!.published!.value.cacheId;
      const manifest = this.acquire<Manifest>(manifestId, leases);
      if (manifest?.query?.policy !== policy) throw changed();
      const plan = this.plan(
        {
          ...input,
          revisionId: cursor?.revisionId ?? manifest.query.revisionId,
          range: input.range ?? manifest.query.range,
          trackIds: input.trackIds ?? manifest.query.trackIds,
        },
        input.range === undefined,
      );
      if (
        manifest.queryDigest !== plan.queryDigest ||
        (cursor && cursor.queryDigest !== plan.queryDigest)
      )
        throw changed();
      const validate = () => {
        this.options.projects.get(input.projectId);
        if (
          digest(this.pins(this.dependencies(plan.occurrences, false))) !==
          digest(this.pins(manifest.dependencies))
        )
          throw changed();
      };
      validate();
      const state = cursor
        ? this.acquire<Checkpoint>(cursor.checkpointId, leases)
        : ({
            manifestId,
            queryDigest: manifest.queryDigest,
            initialized: 0,
            pendingTrack: null,
            tracks: manifest.tracks.map(initialTrack),
            heap: [],
            last: null,
          } satisfies Checkpoint);
      if (state.manifestId !== manifestId || state.queryDigest !== manifest.queryDigest)
        throw changed();
      const rows = this.merge(manifest, plan, state, limit);
      const more =
        state.initialized < state.tracks.length ||
        state.pendingTrack !== null ||
        state.heap.length > 0;
      let nextCursor: ProjectEvidenceCursor | null = null;
      if (more) {
        created = await this.publish(input.projectId, state);
        validate();
        nextCursor = {
          projectId: input.projectId,
          revisionId: manifest.query.revisionId,
          manifestId,
          checkpointId: created,
          queryDigest: manifest.queryDigest,
        };
      }
      return {
        projectId: input.projectId,
        revisionId: manifest.query.revisionId,
        state: "ready",
        dependencies: manifest.dependencies,
        page: { rows, nextCursor },
      };
    } catch (error) {
      if (created) this.options.cache.remove(created);
      throw error;
    } finally {
      for (const lease of leases.reverse()) lease.release();
    }
  }

  private merge(
    manifest: Manifest,
    plan: ReturnType<ProjectEvidenceInspection["plan"]>,
    state: Checkpoint,
    limit: number,
  ) {
    const occurrences = new Map(plan.occurrences.map((clip) => [clip.clipId, clip]));
    const dependencies = new Map(
      manifest.dependencies.map((dependency) => [selectionKey(dependency.selection), dependency]),
    );
    let budget = scanBudget;
    const common = (clip: SourceWindowOccurrence, transcript: TranscriptMetadata | null) => ({
      clipId: clip.clipId,
      assetId: clip.assetId,
      streamId: clip.streamId,
      ...(clip.acquisitionId === undefined ? {} : { acquisitionId: clip.acquisitionId }),
      trackId: clip.trackId,
      trackRank: clip.trackRank,
      generation: transcript?.generation ?? null,
    });
    const candidate = (row: ProjectTranscriptRow, ordinal: number): Candidate => ({
      row,
      key: {
        projectStartUs: row.fragments[0]!.project.startUs,
        trackRank: row.trackRank,
        clipId: row.clipId,
        sourceOrdinal: ordinal,
        eventKind: row.type,
      },
    });
    const project = (
      clip: SourceWindowOccurrence,
      transcript: TranscriptMetadata,
      row: SourceTranscriptRow,
    ): Candidate | null => {
      const instant = row.type === "word" && row.instant;
      const point = instant ? plan.projection.point(clip.clipId, row.sourceRange.startUs) : null;
      const projected = instant ? null : plan.projection.clip(clip.clipId, row.sourceRange);
      const fragments = point
        ? [
            {
              source: { start: point.source, end: point.source },
              project: { start: point.project, end: point.project },
            },
          ]
        : projected?.fragments;
      if (
        !fragments?.some(({ project: fragment }) =>
          instant
            ? compare(fragment.start, fromTime(plan.query.range.startUs)) >= 0 &&
              compare(fragment.start, fromTime(plan.query.range.endUs)) < 0
            : compare(fragment.end, fromTime(plan.query.range.startUs)) > 0 &&
              compare(fragment.start, fromTime(plan.query.range.endUs)) < 0,
        )
      )
        return null;
      return candidate(
        {
          ...row,
          ...common(clip, transcript),
          partial: projected?.completeness === "partial",
          fragments: fragments.map((fragment) => ({
            source: range(fragment.source),
            project: range(fragment.project),
          })),
        },
        row.type === "word" ? row.ordinal : -1,
      );
    };
    const fill = (index: number): boolean => {
      const track = state.tracks[index]!,
        clips = manifest.tracks[index]!.clipIds;
      while (track.clip < clips.length) {
        const clip = occurrences.get(clips[track.clip]!)!;
        const transcript = dependencies.get(selectionKey(clip))!.transcript;
        if (!track.pending && !track.done) {
          if (budget-- <= 0) return false;
          if (!transcript || !clip.fragments.length) track.done = true;
          else {
            const first = clip.fragments[0]!.source,
              last = clip.fragments.at(-1)!.source;
            const page = new SourceTranscriptRead(this.options.records, transcript).page({
              range: { startUs: floor(first.start), endUs: ceil(last.end) },
              ...(track.cursor === null ? {} : { cursor: track.cursor }),
              limit: 1,
            });
            track.cursor = page.nextCursor;
            track.done = page.nextCursor === null;
            const row = page.rows[0];
            if (row) track.pending = project(clip, transcript, row);
            if (!track.pending && !track.done) continue;
          }
        }
        const gap = clip.unavailable[track.gap];
        const gapCandidate = gap
          ? candidate(
              {
                ...common(clip, transcript),
                type: "gap",
                reason: "not_acquired",
                sourceRange: range(gap.source),
                partial: false,
                fragments: [{ source: range(gap.source), project: range(gap.project) }],
              },
              -1,
            )
          : null;
        if (gapCandidate || track.pending) {
          const gapFirst =
            gapCandidate && (!track.pending || compareKey(gapCandidate.key, track.pending.key) < 0);
          track.head = gapFirst ? gapCandidate : track.pending;
          track.headKind = gapFirst ? "gap" : "source";
          return true;
        }
        if (budget-- <= 0) return false;
        track.clip++;
        track.gap = 0;
        track.cursor = null;
        track.done = false;
        track.pending = null;
      }
      track.head = null;
      track.headKind = null;
      return true;
    };
    const less = (a: number, b: number) =>
      compareKey(state.tracks[a]!.head!.key, state.tracks[b]!.head!.key) < 0;
    const push = (index: number) => {
      if (!state.tracks[index]!.head) return;
      state.heap.push(index);
      let at = state.heap.length - 1;
      while (at > 0) {
        const parent = (at - 1) >>> 1;
        if (!less(state.heap[at]!, state.heap[parent]!)) break;
        [state.heap[at], state.heap[parent]] = [state.heap[parent]!, state.heap[at]!];
        at = parent;
      }
    };
    const pop = () => {
      const result = state.heap[0]!,
        last = state.heap.pop()!;
      if (state.heap.length) {
        state.heap[0] = last;
        let at = 0;
        for (;;) {
          const left = at * 2 + 1,
            right = left + 1;
          if (left >= state.heap.length) break;
          const next =
            right < state.heap.length && less(state.heap[right]!, state.heap[left]!) ? right : left;
          if (!less(state.heap[next]!, state.heap[at]!)) break;
          [state.heap[at], state.heap[next]] = [state.heap[next]!, state.heap[at]!];
          at = next;
        }
      }
      return result;
    };
    const rows: ProjectTranscriptRow[] = [];
    while (rows.length < limit) {
      if (state.pendingTrack !== null) {
        if (!fill(state.pendingTrack)) break;
        push(state.pendingTrack);
        state.pendingTrack = null;
      }
      const next = manifest.tracks[state.initialized];
      if (
        next &&
        (!state.heap.length ||
          compare(
            fromTime(next.lowerBound),
            fromTime(state.tracks[state.heap[0]!]!.head!.key.projectStartUs),
          ) <= 0)
      ) {
        const index = state.initialized;
        if (!fill(index)) break;
        push(index);
        state.initialized++;
        continue;
      }
      if (!state.heap.length) break;
      const index = pop(),
        track = state.tracks[index]!,
        head = track.head!;
      if (state.last && compareKey(head.key, state.last) <= 0)
        throw new CatalogError("INVALID_EVIDENCE", "Project evidence order did not advance");
      rows.push(head.row);
      state.last = head.key;
      if (track.headKind === "gap") track.gap++;
      else track.pending = null;
      track.head = null;
      track.headKind = null;
      state.pendingTrack = index;
    }
    return rows;
  }
}
