import { mkdir, open, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { isMediaClip } from "@screenrec/composition";
import { AssetStore, mediaProbeSchema, type AssetProbe } from "./assets.js";
import { CatalogError, type Catalog } from "./catalog.js";
import { ResourceReferences, resourceKinds, type ResourceReference } from "./references.js";
import type { ProjectStore } from "./projects.js";
import type { JobExecution, JobQueue, StagedJobResult } from "./jobs.js";
import { projectWindow } from "./project-window.js";
import { checkProjectAudioResult, type ProjectAudioRenderer } from "./audio-inspection.js";
import {
  fileIdentity,
  hashFile,
  IdentifiedFiles,
  retainedFileRead,
  type FileIdentity,
} from "./files.js";
import { validateAudioWave } from "./audio-wave.js";

type Input = { projectId: string; revisionId?: string };
export type PreparedAudio = Omit<ReturnType<typeof checkProjectAudioResult>, "file"> & {
  resourceId: string;
  dependencies: ResourceReference[];
  assetId: string;
  identity: FileIdentity;
  sampleRange: { start: number; end: number };
};

/** Durable bytes use AssetStore; the queue alone publishes their recipe and revision binding. */
export class PreparedAudioStore {
  private readonly references: ResourceReferences;
  constructor(
    private readonly owners: {
      catalog: Catalog;
      assets: AssetStore;
      projects: ProjectStore;
      jobs: JobQueue;
      renderer: ProjectAudioRenderer;
      probe: AssetProbe;
      staging: string;
    },
  ) {
    this.references = new ResourceReferences(owners.catalog);
  }
  /** Startup under the same exclusive service lifetime as asset recovery. */
  async recover() {
    await rm(this.owners.staging, { recursive: true, force: true });
    await mkdir(this.owners.staging, { recursive: true, mode: 0o700 });
  }
  private plan(input: Input) {
    return projectWindow(
      this.owners.projects,
      this.owners.assets,
      input,
      this.owners.renderer,
      "audio",
    );
  }
  request(input: Input) {
    const plan = this.plan(input);
    const frames = plan.window.manifest.sampleRange.end - plan.window.manifest.sampleRange.start;
    // The existing native float WAV writer has a 32-bit RIFF byte count.
    if (BigInt(frames) * BigInt(plan.window.manifest.rendition.channels) * 4n + 36n > 0xffffffffn)
      throw new CatalogError(
        "LIMIT_EXCEEDED",
        "Prepared PCM exceeds the native WAV container limit",
      );
    const identity = {
      target: {
        kind: "project" as const,
        projectId: input.projectId,
        revisionId: plan.window.manifest.revisionId,
      },
      artifact: "prepared-audio",
      input: JSON.stringify(plan.window.manifest),
    };
    const dependencies: ResourceReference[] = plan.window.manifest.sources.flatMap((source) => [
      { kind: "asset", id: source.assetId },
    ]);
    const clips = new Set(plan.window.manifest.sources.map((source) => source.clipId));
    for (const clip of plan.model.document.clips)
      if (isMediaClip(clip) && clips.has(clip.id) && clip.acquisitionId)
        dependencies.push({ kind: "acquisition", id: clip.acquisitionId });
    this.owners.jobs.submit({ ...identity, lane: "heavy" }, (job) => {
      for (const kind of resourceKinds)
        this.owners.jobs.retainInputs(
          job.jobId,
          kind,
          dependencies.filter((value) => value.kind === kind).map((value) => value.id),
        );
    });
    return this.owners.jobs.status(identity);
  }
  async execute({ job, signal }: JobExecution): Promise<StagedJobResult> {
    if (job.target.kind !== "project" || job.artifact !== "prepared-audio")
      throw new CatalogError("UNSUPPORTED_JOB", "Prepared audio requires a project revision");
    const plan = this.plan(job.target);
    if (JSON.stringify(plan.window.manifest) !== job.input)
      throw new CatalogError("ARTIFACT_CHANGED", "Prepared audio recipe is no longer available");
    const output = join(this.owners.staging, `${job.attemptId}.wav`);
    let staged: Awaited<ReturnType<AssetStore["stagePortable"]>> | undefined;
    try {
      const { file: renderedFile, ...audio } = checkProjectAudioResult(
        await this.owners.renderer.render({ ...plan, output }, signal),
        plan.window,
        output,
      );
      const sampleRange = plan.window.manifest.sampleRange;
      const handle = await open(renderedFile, "r");
      let digest: Awaited<ReturnType<typeof hashFile>>;
      try {
        digest = await hashFile(handle, audio.bytes, signal);
      } finally {
        await handle.close();
      }
      const metadata = mediaProbeSchema.parse(await this.owners.probe(renderedFile, signal));
      const dependencies = this.references
        .dependencies({ kind: "job-input", id: job.jobId })
        .filter((value) => value.kind !== "asset" || value.id !== digest.sha256);
      staged = await this.owners.assets.stagePortable(
        {
          asset: {
            ...metadata,
            id: digest.sha256,
            bytes: audio.bytes,
            createdAt: new Date().toISOString(),
            fileName: digest.sha256 + ".wav",
          },
          origins: [{ kind: "generated", source: "prepared-audio" }],
          dependencies: [],
        },
        output,
        signal,
      );
      // Drop the temporary hard link before recording the durable file's local identity.
      await staged.close();
      const file = await open(staged.path, "r");
      let identity: FileIdentity;
      try {
        identity = fileIdentity(await file.stat({ bigint: true }));
      } finally {
        await file.close();
      }
      const value: PreparedAudio = {
        ...audio,
        dependencies,
        resourceId: JSON.stringify([job.target.projectId, job.attemptId]),
        assetId: digest.sha256,
        bytes: audio.bytes,
        identity,
        sampleRange,
      };
      const publication = staged;
      return {
        result: JSON.stringify(value),
        publish: () => {
          publication.publish();
          const owner = { kind: "revision" as const, id: plan.window.manifest.revisionId };
          this.references.retain("prepared-audio", owner, [value.resourceId]);
          this.owners.assets.retain(owner, [value.assetId]);
          for (const kind of resourceKinds)
            this.references.retain(
              kind,
              owner,
              dependencies.filter((value) => value.kind === kind).map((value) => value.id),
            );
          return undefined;
        },
        close: async () => {
          try {
            await publication.close();
          } finally {
            await rm(output, { force: true });
          }
        },
      };
    } catch (error) {
      try {
        await staged?.close();
      } finally {
        await rm(output, { force: true });
      }
      throw error;
    }
  }
  /** Bounded PCM view of an already published result; never invokes the renderer or model. */
  open(resourceId: string, range?: { start: number; end: number }) {
    const [projectId, attemptId] = JSON.parse(resourceId) as [string, string];
    const publication = this.owners.jobs.retainedArtifact(
      { kind: "project", projectId },
      "prepared-audio",
      attemptId,
    );
    if (!publication)
      throw new CatalogError("NOT_FOUND", "Prepared audio publication is unavailable");
    const value = JSON.parse(publication.result) as PreparedAudio;
    const selection = range ?? value.sampleRange;
    if (
      !Number.isSafeInteger(selection.start) ||
      !Number.isSafeInteger(selection.end) ||
      selection.start < value.sampleRange.start ||
      selection.end > value.sampleRange.end ||
      selection.end <= selection.start
    )
      throw new CatalogError("INVALID_RANGE", "Requested PCM is outside the prepared output");
    const path = this.owners.assets.path(value.assetId);
    const files = new IdentifiedFiles(dirname(path), [
      { path: basename(path), bytes: value.bytes, identity: value.identity },
    ]);
    try {
      const file = files.open(basename(path));
      const source = retainedFileRead(file, value.bytes);
      const { dataOffset } = validateAudioWave(source, value);
      const frameBytes = value.channels * 4;
      const offset = dataOffset + (selection.start - value.sampleRange.start) * frameBytes;
      const bytes = (selection.end - selection.start) * frameBytes;
      return {
        value,
        sampleRange: selection,
        bytes,
        read(buffer: Uint8Array, position: number) {
          if (!Number.isSafeInteger(position) || position < 0 || position > bytes)
            throw new CatalogError("INVALID_RANGE", "PCM read is outside the excerpt");
          return source.read(
            buffer.subarray(0, Math.min(buffer.length, bytes - position)),
            offset + position,
          );
        },
        release: () => files.close(),
      };
    } catch (error) {
      files.close();
      throw error;
    }
  }
}
