import { randomUUID } from "node:crypto";
import { Catalog } from "@yap/core/catalog";
import { AssetStore } from "@yap/core/assets";
import { AcquisitionStore } from "@yap/core/acquisitions";
import { Models } from "@yap/core/models";
import { JobQueue } from "@yap/core/jobs";
import { SpeakerEvidenceStore, assetSpeakerOwner } from "@yap/core/speaker-evidence";
import { SpeakerProcessing } from "@yap/core/speaker-processing";
import { selectSpeakerSource, type SpeakerSourceInput } from "@yap/core/source-speakers";
import { afterEach, expect, test } from "vitest";
import { writeFile, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonWorker } from "./worker.js";
import { setTimeout as delay } from "node:timers/promises";
import { projectServiceFixture } from "./project-service.fixture.js";
import { nativeOutput, speakerSource } from "./speaker.fixture.js";

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
    assetId: job.published!.output.assetId,
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
    assetId: job.published!.output.assetId,
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
    data: { state: "ready", published: { output: published } },
  });
  expect(await restarted.call("speaker.get", { ...query, view: "scores", cursor })).toMatchObject({
    ok: false,
    error: { code: "ARTIFACT_CHANGED" },
  });
});

test("public speaker bindings are pinned to one retained generation and decorate interval rows", async () => {
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
  const imported = await f.call("asset.import", { requestId: "bind-speaker", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const input = {
    assetId: job.published!.output.assetId,
    streamId: "audio",
    channel: 1,
    sourceRange: speakerSource.observationRange,
    modelId: speakerSource.engine.modelId,
  };
  const metadata = await publishControlledObservation(f.home, input);
  const { sourceRange, ...selection } = input;
  const bound = await f.call("speaker.bind", {
    ...selection,
    observationRange: sourceRange,
    generation: metadata.generation,
    bindings: [{ slot: 1, displayName: "Ada" }],
  });
  const read = await f.call("speaker.get", { ...selection, observationRange: sourceRange });
  expect(bound).toMatchObject({ ok: true, data: { bindings: [{ slot: 1, displayName: "Ada" }] } });
  expect(read).toMatchObject({ ok: true });
  if (read.ok) {
    const rows = (read.data as { page: { rows: { slot: number; label?: string }[] } }).page.rows;
    expect(rows.find((row) => row.slot === 1)).toMatchObject({ slot: 1, label: "Ada" });
    expect(rows.find((row) => row.slot === 0)).not.toHaveProperty("label");
    const paged = await f.call("speaker.get", {
      ...selection,
      observationRange: sourceRange,
      limit: 1,
    });
    expect(paged).toMatchObject({ ok: true });
    const nextCursor = paged.ok
      ? (paged.data as { page: { nextCursor: string | null } }).page.nextCursor
      : null;
    if (nextCursor) {
      expect(
        await f.call("speaker.bind", {
          ...selection,
          observationRange: sourceRange,
          generation: metadata.generation,
          bindings: [{ slot: 1, displayName: "Grace" }],
        }),
      ).toMatchObject({ ok: true, data: { bindings: [{ slot: 1, displayName: "Grace" }] } });
      expect(
        await f.call("speaker.get", {
          ...selection,
          observationRange: sourceRange,
          cursor: nextCursor,
        }),
      ).toMatchObject({ ok: false, error: { code: "ARTIFACT_CHANGED" } });
    }
  }
  expect(
    await f.call("speaker.bind", {
      ...selection,
      observationRange: sourceRange,
      generation: "another-generation",
      bindings: [],
    }),
  ).toMatchObject({ ok: false, error: { code: "ARTIFACT_CHANGED" } });
});

test("project speaker rows carry caller labels for their retained generation", async () => {
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
  const imported = await f.call("asset.import", { requestId: "project-labels", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const input = {
    assetId: job.published!.output.assetId,
    streamId: "audio",
    channel: 1,
    sourceRange: speakerSource.observationRange,
    modelId: speakerSource.engine.modelId,
  };
  const metadata = await publishControlledObservation(f.home, input);
  expect(
    await f.call("speaker.bind", {
      assetId: input.assetId,
      streamId: input.streamId,
      channel: input.channel,
      modelId: input.modelId,
      observationRange: input.sourceRange,
      generation: metadata.generation,
      bindings: [{ slot: 1, displayName: "Ada" }],
    }),
  ).toMatchObject({ ok: true });
  const created = await f.call("project.create", {
    requestId: "project-labels-create",
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
  const edited = await f.call("edit.apply", {
    projectId: project.projectId,
    requestId: "project-labels-place",
    expectedRevisionId: revision.id,
    operations: [
      { operation: "track.add", track: { kind: "audio", order: 0 }, label: "sound" },
      {
        operation: "place",
        clip: {
          trackId: { label: "sound" },
          assetId: input.assetId,
          streamId: input.streamId,
          source: { kind: "range", range: { startUs: 0, endUs: 30000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 30000000 } },
        },
      },
    ],
  });
  if (!edited.ok) throw new Error(JSON.stringify(edited));
  const editedData = edited.data as { revision: { id: string } };
  const query = {
    projectId: project.projectId,
    revisionId: editedData.revision.id,
    range: { startUs: 0, endUs: 3000000 },
    channel: input.channel,
    modelId: input.modelId,
  };
  let read;
  for (;;) {
    read = await f.call("speaker.get", query);
    if (!read.ok || (read.data as { page: unknown }).page !== null) break;
    await delay(10);
  }
  expect(read).toMatchObject({ ok: true });
  if (read.ok) {
    const data = read.data as { page: { rows: { slot: number; label?: string }[] } };
    const rows = data.page.rows;
    expect(rows.find((row) => row.slot === 1)).toMatchObject({ slot: 1, label: "Ada" });
    expect(rows.find((row) => row.slot === 0)).not.toHaveProperty("label");
  }
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

test.runIf(process.platform === "darwin")(
  "speaker package export, read-only open and adoption preserve exact source evidence without model execution",
  async () => {
    const native = jsonWorker({
      executable:
        process.env.YAP_NATIVE ??
        fileURLToPath(new URL("../../../helpers/mac/.build/debug/yap-native", import.meta.url)),
      args: [],
    });
    const f = await projectServiceFixture(cleanup, async (operation, params, options) => {
      if (operation !== "media.probe") return native(operation, params, options);
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
    const imported = await f.call("asset.import", { requestId: "portable-source", path: f.path });
    if (!imported.ok) throw Error(JSON.stringify(imported));
    const job = await f.job((imported.data as { jobId: string }).jobId, "ready");
    const input = {
      assetId: job.published!.output.assetId,
      streamId: "audio",
      channel: 1,
      sourceRange: speakerSource.observationRange,
      modelId: speakerSource.engine.modelId,
    };
    await publishControlledObservation(f.home, input);
    const { sourceRange, ...selection } = input;
    const query = { ...selection, observationRange: sourceRange, view: "scores", limit: 1000 };
    const unlabeled = await f.call("speaker.get", query);
    await f.call("speaker.bind", {
      ...selection,
      observationRange: sourceRange,
      generation: (unlabeled.data as { generation: string }).generation,
      bindings: [{ slot: 0, displayName: "Ada" }],
    });
    const original = await f.call("speaker.get", query);
    const created = await f.call("project.create", {
      requestId: "portable-speaker-project",
      canvas: {
        width: 64,
        height: 48,
        fps: { numerator: 30, denominator: 1 },
        background: "#000000ff",
      },
    });
    if (!created.ok) throw Error(JSON.stringify(created));
    const { project, revision } = created.data as {
      project: { projectId: string };
      revision: { id: string };
    };
    expect(
      await f.call("edit.apply", {
        projectId: project.projectId,
        requestId: "portable-place",
        expectedRevisionId: revision.id,
        operations: [
          { operation: "track.add", track: { kind: "audio", order: 0 }, label: "sound" },
          {
            operation: "place",
            clip: {
              trackId: { label: "sound" },
              assetId: input.assetId,
              streamId: input.streamId,
              source: { kind: "range", range: { startUs: 0, endUs: 30000000 } },
              placement: { kind: "project", range: { startUs: 0, endUs: 60000000 } },
            },
          },
        ],
      }),
    ).toMatchObject({ ok: true });
    const exportId = randomUUID();
    const exporting = await f.call("export.create", {
      projectId: project.projectId,
      exportId,
      kind: "processed-package",
      directory: f.home,
      leaf: "speakers.zip",
    });
    expect(exporting).toMatchObject({ ok: true });
    let active = f;
    const ready = async (operation: string, params: Record<string, unknown>, state: string) => {
      const deadline = performance.now() + 10000;
      for (;;) {
        const result = await active.call(operation, params);
        if (!result.ok) throw Error(JSON.stringify(result));
        const data = result.data as Record<string, unknown>;
        if (data.state === state) return data;
        if (
          ["failed", "canceled", "unavailable"].includes(String(data.state)) ||
          performance.now() > deadline
        )
          throw Error(JSON.stringify(result));
        await delay(10);
      }
    };
    const projectQuery = {
      projectId: project.projectId,
      channel: input.channel,
      modelId: input.modelId,
      range: { startUs: 750000, endUs: 1250000 },
      limit: 1000,
    };
    const projected = await ready("speaker.get", projectQuery, "ready");
    expect(projected).toMatchObject({
      page: {
        rows: [
          { ordinal: 0, slot: 0, partial: false },
          { ordinal: 1, slot: 1, partial: false },
        ],
      },
    });
    await ready("export.status", { exportId }, "committed");
    const target = await projectServiceFixture(cleanup, async (operation, params, options) => {
      if (operation.startsWith("media."))
        throw Error(`Package preservation cannot execute media: ${operation}`);
      return native(operation, params, options);
    });
    active = target;
    const opened = await target.call("package.open", {
      path: await realpath(join(f.home, "speakers.zip")),
    });
    if (!opened.ok) throw Error(JSON.stringify(opened));
    const admissionId = (opened.data as { id: string }).id;
    const admitted = await ready("package.status", { admissionId }, "ready");
    const packageHandle = admitted.packageHandle;
    const portableProjection = await ready(
      "speaker.get",
      { ...projectQuery, packageHandle },
      "ready",
    );
    expect(
      (portableProjection.page as { rows: { slot: number; label?: string }[] }).rows.find(
        (row) => row.slot === 0,
      ),
    ).toMatchObject({ slot: 0, label: "Ada" });
    expect((portableProjection.page as { rows: unknown }).rows).toEqual(
      (projected.page as { rows: unknown }).rows,
    );
    expect(projected).toMatchObject({
      page: {
        rows: [
          { fragments: [{ project: { startUs: 125, endUs: 2000125 } }] },
          { fragments: [{ project: { startUs: 1000125, endUs: 4000125 } }] },
        ],
      },
    });
    const packaged = await target.call("speaker.get", { ...query, packageHandle });
    expect(packaged).toMatchObject(original);
    const packagedIntervals = await target.call("speaker.get", {
      ...query,
      view: "intervals",
      packageHandle,
    });
    expect(
      (
        packagedIntervals.data as { page: { rows: { slot: number; label?: string }[] } }
      ).page.rows.find((row) => row.slot === 0),
    ).toMatchObject({ slot: 0, label: "Ada" });
    const adopted = await ready(
      "package.adopt",
      { packageHandle, requestId: "speaker-adopt" },
      "ready",
    );
    const replayed = await target.call("package.adopt", {
      packageHandle,
      requestId: "speaker-adopt",
    });
    expect(replayed).toMatchObject({
      ok: true,
      data: { state: "ready", published: adopted.published },
    });
    await target.call("package.close", { admissionId });
    await f.service.close();
    await rm(f.home, { recursive: true, force: true });
    await target.service.close();
    const restarted = await projectServiceFixture(
      cleanup,
      async (operation) => {
        throw Error(`Retained read cannot invoke ${operation}`);
      },
      target.home,
    );
    const resumed = await restarted.call("speaker.get", query);
    expect(resumed).toEqual(original);
    await writeFile(
      join(target.home, "portable-speaker-comparison.json"),
      JSON.stringify({ original, packaged, adopted, replayed, resumed }),
    );
  },
  30000,
);
