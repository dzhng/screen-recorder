import { randomUUID } from "node:crypto";
import { Catalog } from "@screenrec/core/catalog";
import { AssetStore } from "@screenrec/core/assets";
import { AcquisitionStore } from "@screenrec/core/acquisitions";
import { Models } from "@screenrec/core/models";
import { JobQueue } from "@screenrec/core/jobs";
import { SpeakerEvidenceStore, assetSpeakerOwner } from "@screenrec/core/speaker-evidence";
import { SpeakerProcessing } from "@screenrec/core/speaker-processing";
import { selectSpeakerSource, type SpeakerSourceInput } from "@screenrec/core/source-speakers";
import { afterEach, expect, test } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectServiceFixture } from "./project-service.fixture.js";
import {
  nativeOutput,
  speakerSource,
} from "../../../packages/core/src/speaker-evidence.fixture.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("public speaker source requests report missing optional preparation without scheduling inference", async () => {
  const requests: string[] = [];
  const f = await projectServiceFixture(cleanup, async (operation) => {
    requests.push(operation);
    if (operation !== "media.probe") throw new Error(operation);
    return {
      ok: true,
      data: {
        originUs: -250000,
        streams: [
          {
            id: "audio",
            kind: "audio",
            codec: "controlled",
            decodable: true,
            channels: 2,
            sampleRate: 16000,
            startUs: 0,
            endUs: 40000000,
            segments: [{ startUs: 0, endUs: 40000000, empty: false }],
          },
        ],
      },
    };
  });
  const imported = await f.call("asset.import", { requestId: "speaker-source", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const input = {
    assetId: job.result!.assetId,
    streamId: "audio",
    channel: 1,
    sourceRange: speakerSource.observationRange,
    modelId: speakerSource.engine.modelId,
  };
  const preparation = await f.call("speaker.prepare", input);
  const { sourceRange, ...selection } = input;
  const read = await f.call("speaker.get", { ...selection, observationRange: sourceRange });
  await writeFile(
    join(f.home, "public-speaker-operands.json"),
    JSON.stringify({ input, preparation, read, requests }),
  );
  expect(preparation).toMatchObject({
    ok: true,
    data: { state: "unavailable", reason: "model_not_prepared", published: null },
  });
  expect(read).toMatchObject({
    ok: true,
    data: { state: "unavailable", reason: "model_not_prepared", page: null },
  });
  expect(requests).toEqual(["media.probe"]);
});

test("public retained speaker pages survive service restart without runtime bytes or native execution", async () => {
  const f = await projectServiceFixture(cleanup, async (operation) => {
    if (operation !== "media.probe") throw new Error(operation);
    return {
      ok: true,
      data: {
        originUs: -250000,
        streams: [
          {
            id: "audio",
            kind: "audio",
            codec: "controlled",
            decodable: true,
            channels: 2,
            sampleRate: 16000,
            startUs: 0,
            endUs: 40000000,
            segments: [{ startUs: 0, endUs: 40000000, empty: false }],
          },
        ],
      },
    };
  });
  const imported = await f.call("asset.import", { requestId: "retained-speaker", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const input = {
    assetId: job.result!.assetId,
    streamId: "audio",
    channel: 1,
    sourceRange: speakerSource.observationRange,
    modelId: speakerSource.engine.modelId,
  };
  const published = await publishControlledObservation(f.home, input);
  const { sourceRange, ...selection } = input;
  const query = {
    ...selection,
    observationRange: sourceRange,
    sourceRange: { startUs: 1500000, endUs: 1750000 },
    limit: 1,
  };
  const first = await f.call("speaker.get", query);
  if (!first.ok) throw new Error(JSON.stringify(first));
  const cursor = (first.data as { page: { nextCursor: string } }).page.nextCursor;
  const second = await f.call("speaker.get", { ...query, cursor });
  await f.service.close();
  const restarted = await projectServiceFixture(
    cleanup,
    async (operation) => {
      throw new Error(`Unrequested native work ${operation}`);
    },
    f.home,
  );
  const resumed = await restarted.call("speaker.get", { ...query, cursor });
  const prepared = await restarted.call("speaker.prepare", input);
  await writeFile(
    join(f.home, "retained-public-pages.json"),
    JSON.stringify({ published, first, second, resumed, prepared }),
  );
  expect(first).toMatchObject({
    ok: true,
    data: {
      state: "ready",
      generation: published.generation,
      page: { rows: [], nextCursor: expect.any(String) },
    },
  });
  expect(second).toMatchObject({
    ok: true,
    data: {
      page: {
        rows: [
          {
            ordinal: 1,
            slot: 1,
            identity: "unknown",
            sourceRange: {
              startUs: { numerator: 1000125, denominator: 2 },
              endUs: { numerator: 4000125, denominator: 2 },
            },
          },
        ],
        nextCursor: null,
      },
    },
  });
  expect(resumed).toEqual(second);
  expect(prepared).toMatchObject({
    ok: true,
    data: { state: "ready", published: { evidence: published } },
  });
  expect(await restarted.call("speaker.get", { ...query, view: "scores", cursor })).toMatchObject({
    ok: false,
    error: { code: "ARTIFACT_CHANGED" },
  });
});

async function publishControlledObservation(home: string, input: SpeakerSourceInput) {
  const library = join(home, "library"),
    catalog = new Catalog(join(library, "catalog.sqlite"));
  const assets = new AssetStore(catalog, library),
    acquisitions = new AcquisitionStore(catalog);
  const models = new Models(library),
    selected = selectSpeakerSource(assets, acquisitions, input);
  const evidence = new SpeakerEvidenceStore(catalog, assetSpeakerOwner(assets, acquisitions));
  const jobs = new JobQueue({
    store: catalog,
    deferExecution: true,
    providers: { newId: randomUUID },
    targets: {
      pin: (target) =>
        target.kind === "project"
          ? { ...target, revisionId: target.revisionId ?? null }
          : { ...target, revisionId: null },
      isAvailable: () => true,
      isDeleting: () => false,
      isCapturing: () => false,
    },
    execute: async () => {
      throw new Error("Retained fixture cannot execute a model");
    },
  });
  try {
    const source = {
      ...speakerSource,
      streamId: input.streamId,
      supportDigest: selected.supportDigest,
      originUs: selected.originUs,
      durationUs: selected.durationUs,
      engine: models.speaker(input.modelId).engine,
    };
    const identity = {
      owner: { kind: "asset" as const, assetId: input.assetId },
      sourceId: input.assetId,
      generation: "retained-control-g1",
      policy: "speaker-v1" as const,
    };
    const staged = evidence.stage(
      identity,
      source,
      nativeOutput(undefined, source.engine.modelSha256),
    );
    const processing = new SpeakerProcessing({
      assets,
      acquisitions,
      models,
      jobs,
      evidence,
      decoder: null,
      observe: async () => {
        throw new Error("Retained fixture cannot observe");
      },
    });
    const { pcm, ...executionSource } = source;
    catalog.transaction(() => {
      staged.publish();
      processing.adoptPublication(staged.metadata, {
        generation: 1,
        attemptId: identity.generation,
        input: JSON.stringify({ request: input, source: executionSource }),
      });
    });
    return staged.metadata;
  } finally {
    await jobs.close();
    catalog.close();
  }
}

test("portable export refuses retained speakers before preservation is supported", async () => {
  const f = await projectServiceFixture(cleanup, async (operation) => {
    if (operation !== "media.probe")
      throw new Error(`Export must refuse before native work: ${operation}`);
    return {
      ok: true,
      data: {
        originUs: -250000,
        streams: [
          {
            id: "audio",
            kind: "audio",
            codec: "controlled",
            decodable: true,
            channels: 2,
            sampleRate: 16000,
            startUs: 0,
            endUs: 40000000,
            segments: [{ startUs: 0, endUs: 40000000, empty: false }],
          },
        ],
      },
    };
  });
  const imported = await f.call("asset.import", { requestId: "package-speaker", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = await f.job((imported.data as { jobId: string }).jobId, "ready");
  await publishControlledObservation(f.home, {
    assetId: job.result!.assetId,
    streamId: "audio",
    channel: 1,
    sourceRange: speakerSource.observationRange,
    modelId: speakerSource.engine.modelId,
  });
  const created = await f.call("project.create", {
    requestId: "speaker-package-project",
    canvas: {
      width: 64,
      height: 48,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  if (!created.ok) throw new Error(JSON.stringify(created));
  const { project, revision } = created.data as {
    project: { projectId: string };
    revision: { id: string };
  };
  expect(
    await f.call("edit.apply", {
      projectId: project.projectId,
      requestId: "speaker-place",
      expectedRevisionId: revision.id,
      operations: [
        { operation: "track.add", track: { kind: "audio", order: 0 }, label: "sound" },
        {
          operation: "place",
          clip: {
            trackId: { label: "sound" },
            assetId: job.result!.assetId,
            streamId: "audio",
            source: { kind: "range", range: { startUs: 0, endUs: 30000000 } },
            placement: { kind: "project", range: { startUs: 0, endUs: 30000000 } },
          },
        },
      ],
    }),
  ).toMatchObject({ ok: true });
  expect(
    await f.call("export.create", {
      projectId: project.projectId,
      exportId: randomUUID(),
      kind: "processed-package",
      directory: f.home,
      leaf: "speaker.zip",
    }),
  ).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_PACKAGE_DEPENDENCY" } });
});
