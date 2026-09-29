import { projectStoreFixture } from "./project-store.fixture.js";
import { projectCompositionFromRevision } from "./project-window.js";
import { afterEach, expect, test } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile, rename, realpath } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Catalog, CatalogError } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { ResourceReferences } from "./references.js";
import { JobQueue, type StagedJobResult } from "./jobs.js";
import { PreparedAudioStore, type PreparedAudio } from "./prepared-audio.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
function wave(frames: number) {
  const bytes = Buffer.alloc(44 + frames * 8);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(384000, 28);
  bytes.writeUInt16LE(8, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 8, 40);
  for (let i = 0; i < frames; i++) {
    bytes.writeFloatLE((i % 101) / 256, 44 + i * 8);
    bytes.writeFloatLE((-i % 67) / 128, 48 + i * 8);
  }
  return bytes;
}
async function fixture(
  gaps: { start: number; end: number }[] = [],
  implementationId = "unit-test-native-boundary",
) {
  const home = await realpath(await mkdtemp("/tmp/prepared-audio-"));
  let reads = 0;
  let hold: ((result: StagedJobResult) => Promise<void>) | undefined;
  async function connect() {
    const catalog = new Catalog(join(home, "catalog.sqlite"));
    const assets = new AssetStore(catalog, home);
    await assets.recover();
    const projects = projectStoreFixture(catalog, assets, home, new AcquisitionStore(catalog));
    let prepared!: PreparedAudioStore;
    const jobs = new JobQueue({
      store: catalog,
      providers: { newId: randomUUID },
      targets: {
        pin: (target) => {
          if (target.kind !== "project") throw Error("project");
          projects.revision(target.projectId, target.revisionId);
          return target;
        },
        isAvailable: (target) =>
          target.kind === "project" && !projects.isDeleting(target.projectId),
        isDeleting: (target) => target.kind === "project" && projects.isDeleting(target.projectId),
        isCapturing: () => false,
      },
      execute: async (execution) => {
        const result = await prepared.execute(execution);
        await hold?.(result);
        return result;
      },
    });
    const probe = async (path: string) => {
      const count = ((await readFile(path)).length - 44) / 8;
      return {
        originUs: 0,
        streams: [
          {
            id: "track:1",
            kind: "audio",
            codec: "pcm_f32le",
            decodable: true,
            startUs: 0,
            endUs: Math.ceil((count / 48000) * 1000000),
            segments: [{ startUs: 0, endUs: Math.ceil((count / 48000) * 1000000), empty: false }],
            sampleRate: 48000,
            channels: 2,
          },
        ],
      };
    };
    prepared = new PreparedAudioStore({
      catalog,
      assets,
      projects,
      jobs,
      staging: join(home, "staging", "prepared-audio"),
      probe,
      renderer: {
        implementationId,
        render: async ({ window, output }) => {
          reads++;
          const frames = window.manifest.sampleRange.end - window.manifest.sampleRange.start;
          const bytes = wave(frames);
          await writeFile(output, bytes);
          return {
            file: output,
            bytes: bytes.length,
            sampleRate: 48000,
            channels: 2,
            frames,
            peak: 1,
            clippedSamples: 0,
            maximumBlockFrames: 1024,
            peakResidentBytes: 0,
            decoderContext: {
              policy: "bounded-current-retained-run",
              sampleRate: 48000,
              maximumPrerollFrames: 0,
              maximumTailFrames: 0,
            },
            unavailable: [...window.audio()]
              .filter((clip) => clip.source.kind === "range")
              .map((clip) => ({ clipId: clip.clipId, ranges: gaps })),
          };
        },
      },
    });
    await prepared.recover();
    return {
      catalog,
      assets,
      projects,
      jobs,
      prepared,
      probe,
      close: async () => {
        await jobs.close();
        catalog.close();
      },
    };
  }
  let current = await connect();
  cleanup.push(async () => {
    await current.close();
    await rm(home, { recursive: true, force: true });
  });
  const input = join(home, "source.wav");
  const sourceBytes = wave(48000);
  sourceBytes.writeFloatLE(0.99, 44);
  await writeFile(input, sourceBytes);
  const asset = await current.assets.import(input, { kind: "import" }, current.probe);
  const created = current.projects.create({
    requestId: "create",
    canvas: {
      width: 64,
      height: 48,
      fps: { numerator: 30, denominator: 1 },
      background: "#000000ff",
    },
  });
  const placed = current.projects.apply(created.project.projectId, {
    requestId: "place",
    expectedRevisionId: created.revision.id,
    operations: [
      { operation: "track.add", label: "track", track: { kind: "audio", order: 0 } },
      {
        operation: "place",
        label: "clip",
        clip: {
          trackId: { label: "track" },
          assetId: asset.id,
          streamId: "track:1",
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
  });
  return {
    home,
    asset,
    placed,
    input: { projectId: created.project.projectId, revisionId: placed.revision.id },
    get current() {
      return current;
    },
    get reads() {
      return reads;
    },
    setHold: (value: typeof hold) => {
      hold = value;
    },
    reopen: async (nextImplementation = implementationId) => {
      await current.close();
      implementationId = nextImplementation;
      current = await connect();
      return current;
    },
  };
}
async function ready(f: Awaited<ReturnType<typeof fixture>>) {
  f.current.prepared.request(f.input);
  await f.current.jobs.idle();
  const status = f.current.prepared.request(f.input);
  expect(status.state).toBe("ready");
  return JSON.parse(status.published!.result) as PreparedAudio;
}
test("retains exact PCM and immutable revision dependencies; bounded reads survive restart and newer edits", async () => {
  const f = await fixture();
  const document = JSON.stringify(f.placed.revision.document);
  const value = await ready(f);
  const refs = new ResourceReferences(f.current.catalog).dependencies({
    kind: "revision",
    id: f.input.revisionId,
  });
  expect(refs).toContainEqual({ kind: "prepared-audio", id: value.resourceId });
  expect(refs).toContainEqual({ kind: "asset", id: value.assetId });
  expect(value.dependencies).toContainEqual({
    kind: "asset",
    id: f.asset.id,
  });
  expect(
    JSON.stringify(f.current.projects.revision(f.input.projectId, f.input.revisionId).document),
  ).toBe(document);
  const check = () => {
    const excerpt = f.current.prepared.open(value.resourceId, { start: 47003, end: 47017 });
    try {
      const bytes = Buffer.alloc(1024);
      expect(excerpt.read(bytes, 0)).toBe(14 * 8);
      expect(bytes.subarray(0, 112)).toEqual(wave(48000).subarray(44 + 47003 * 8, 44 + 47017 * 8));
      expect(excerpt.read(bytes, 112)).toBe(0);
    } finally {
      excerpt.release();
    }
  };
  check();
  f.current.projects.apply(f.input.projectId, {
    requestId: "gain",
    expectedRevisionId: f.input.revisionId,
    operations: [
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [{ processor: { type: "gain", gain: 2 } }],
      },
    ],
  });
  await f.reopen();
  check();
  expect(f.reads).toBe(1);
  expect(f.current.prepared.request(f.input).state).toBe("ready");
  expect(f.reads).toBe(1);
});
test("an expanded executor can prepare the same revision after a nonretryable old failure", async () => {
  const f = await fixture([], "bounded-executor");
  const document = JSON.stringify(f.placed.revision.document);
  f.setHold(async () => {
    throw new CatalogError("INVALID_REQUEST", "Plan exceeds old executor bounds");
  });
  f.current.prepared.request(f.input);
  await f.current.jobs.idle();
  const failed = f.current.prepared.request(f.input);
  expect(failed).toMatchObject({ state: "failed", retryable: false, published: null });
  expect(() => f.current.jobs.retry(failed.jobId!)).toThrow("cannot be retried");
  f.setHold(undefined);
  await f.reopen();
  expect(f.current.prepared.request(f.input)).toMatchObject({
    jobId: failed.jobId,
    state: "failed",
  });
  await f.reopen("expanded-executor");
  const value = await ready(f);
  expect(f.current.prepared.request(f.input).jobId).not.toBe(failed.jobId);
  expect(f.current.jobs.job(failed.jobId!)).toMatchObject({ state: "failed", retryable: false });
  expect(
    JSON.stringify(f.current.projects.revision(f.input.projectId, f.input.revisionId).document),
  ).toBe(document);
  await f.reopen("later-executor");
  f.setHold(async () => {
    throw new CatalogError("NOT_READY", "Execution is unavailable");
  });
  const retained = f.current.prepared.open(value.resourceId, { start: 47003, end: 47017 });
  try {
    const bytes = Buffer.alloc(14 * 8);
    expect(retained.read(bytes, 0)).toBe(bytes.length);
    expect(bytes).toEqual(wave(48000).subarray(44 + 47003 * 8, 44 + 47017 * 8));
  } finally {
    retained.release();
  }
});
test("canceling a fully staged result publishes neither asset nor revision binding; startup recovers orphan bytes", async () => {
  const f = await fixture();
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const staged = new Promise<void>((r) => {
    reached = r;
  });
  f.setHold(async () => {
    reached();
    await gate;
  });
  const before = new ResourceReferences(f.current.catalog).dependencies({
    kind: "revision",
    id: f.input.revisionId,
  });
  const job = f.current.prepared.request(f.input);
  await staged;
  f.current.jobs.cancel(job.jobId!);
  release();
  await f.current.jobs.idle();
  expect(
    new ResourceReferences(f.current.catalog).dependencies({
      kind: "revision",
      id: f.input.revisionId,
    }),
  ).toEqual(before);
  expect(f.current.prepared.request(f.input).published).toBeNull();
  await f.reopen();
  expect(await readdir(join(f.home, "staging", "prepared-audio"))).toEqual([]);
  expect(await readdir(join(f.home, "assets"))).toEqual([f.asset.fileName]);
});
test("missing and replaced output files fail rather than regenerate or return dry media", async () => {
  const f = await fixture();
  const value = await ready(f);
  const path = f.current.assets.path(value.assetId);
  await rename(path, path + ".saved");
  expect(() => f.current.prepared.open(value.resourceId)).toThrow();
  await writeFile(path, wave(48000));
  expect(() => f.current.prepared.open(value.resourceId)).toThrow("changed");
  expect(f.reads).toBe(1);
});
test("unresolved retiming is rejected before job admission", async () => {
  const f = await fixture();
  const revision = f.current.projects.apply(f.input.projectId, {
    requestId: "retime",
    expectedRevisionId: f.input.revisionId,
    operations: [
      {
        operation: "retime",
        clipIds: [f.placed.edit.labels.clip!],
        durationUs: 1200000,
        ripple: "none",
      },
    ],
  }).revision;
  expect(() => f.current.prepared.request({ ...f.input, revisionId: revision.id })).toThrow(
    "not bound",
  );
  expect(f.reads).toBe(0);
});
test("publication failure rolls back asset metadata and revision references together", async () => {
  const f = await fixture();
  const refs = new ResourceReferences(f.current.catalog);
  const before = refs.dependencies({ kind: "revision", id: f.input.revisionId });
  f.current.catalog.catalog.exec(
    `CREATE TRIGGER reject_prepared BEFORE INSERT ON artifacts WHEN NEW.artifact='prepared-audio' BEGIN SELECT RAISE(ABORT,'publication rejected'); END`,
  );
  f.current.prepared.request(f.input);
  await f.current.jobs.idle();
  expect(f.current.prepared.request(f.input)).toMatchObject({ state: "failed", published: null });
  expect(refs.dependencies({ kind: "revision", id: f.input.revisionId })).toEqual(before);
  expect(f.current.catalog.catalog.prepare("SELECT id FROM assets").all()).toEqual([
    { id: f.asset.id },
  ]);
  await f.reopen();
  expect(await readdir(join(f.home, "assets"))).toEqual([f.asset.fileName]);
});
test("deleting a project fences staged work and retires every revision dependency kind", async () => {
  const f = await fixture();
  const value = await ready(f);
  f.current.projects.markDeleting(f.input.projectId);
  await f.current.jobs.drainOwner({ kind: "project", projectId: f.input.projectId });
  await f.current.jobs.forgetOwner({ kind: "project", projectId: f.input.projectId });
  while (!f.current.projects.finishDeletionPage(f.input.projectId)) {}
  expect(
    new ResourceReferences(f.current.catalog).dependencies({
      kind: "revision",
      id: f.input.revisionId,
    }),
  ).toEqual([]);
  expect(() => f.current.prepared.open(value.resourceId)).toThrow("unavailable");
});
test("prepared publication retains valid missing-source diagnostics and rejects invalid coverage", async () => {
  const f = await fixture([{ start: 100, end: 200 }]);
  const value = await ready(f);
  expect(value.unavailable).toEqual([
    { clipId: f.placed.edit.labels.clip, ranges: [{ start: 100, end: 200 }] },
  ]);
  const invalid = await fixture([{ start: 100, end: 48001 }]);
  invalid.current.prepared.request(invalid.input);
  await invalid.current.jobs.idle();
  expect(invalid.current.prepared.request(invalid.input)).toMatchObject({
    state: "failed",
    published: null,
  });
});
test("concurrent revisions attach each completed result to its own immutable history", async () => {
  const f = await fixture();
  let release!: () => void;
  let reached!: () => void;
  let first = true;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const staged = new Promise<void>((r) => {
    reached = r;
  });
  f.setHold(async () => {
    if (first) {
      first = false;
      reached();
      await gate;
    }
  });
  f.current.prepared.request(f.input);
  await staged;
  const changed = f.current.projects.apply(f.input.projectId, {
    requestId: "next",
    expectedRevisionId: f.input.revisionId,
    operations: [
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [{ processor: { type: "gain", gain: 0.5 } }],
      },
    ],
  }).revision;
  const next = { ...f.input, revisionId: changed.id };
  f.current.prepared.request(next);
  release();
  await f.current.jobs.idle();
  const old = JSON.parse(f.current.prepared.request(f.input).published!.result) as PreparedAudio;
  const latest = JSON.parse(f.current.prepared.request(next).published!.result) as PreparedAudio;
  expect(old.resourceId).not.toBe(latest.resourceId);
  expect(
    f.current.projects.revisionDependencies(f.input.projectId, f.input.revisionId),
  ).toContainEqual({ kind: "prepared-audio", id: old.resourceId });
  expect(f.current.projects.revisionDependencies(f.input.projectId, changed.id)).toContainEqual({
    kind: "prepared-audio",
    id: latest.resourceId,
  });
  expect(f.current.projects.get(f.input.projectId).currentRevisionId).toBe(changed.id);
});
test("owner deletion rejects an already staged publication", async () => {
  const f = await fixture();
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const staged = new Promise<void>((r) => {
    reached = r;
  });
  f.setHold(async () => {
    reached();
    await gate;
  });
  f.current.prepared.request(f.input);
  await staged;
  f.current.projects.markDeleting(f.input.projectId);
  const drained = f.current.jobs.drainOwner({ kind: "project", projectId: f.input.projectId });
  release();
  await drained;
  expect(
    f.current.catalog.catalog
      .prepare("SELECT result FROM artifacts WHERE artifact='prepared-audio'")
      .all(),
  ).toEqual([]);
  expect(
    new ResourceReferences(f.current.catalog)
      .dependencies({ kind: "revision", id: f.input.revisionId })
      .some((ref) => ref.kind === "prepared-audio"),
  ).toBe(false);
});
test("identical prepared bytes do not merge unrelated project source closures", async () => {
  const f = await fixture();
  const first = await ready(f);
  const source = join(f.home, "other.wav"),
    bytes = wave(48000);
  bytes.writeFloatLE(-0.99, 44);
  await writeFile(source, bytes);
  const asset = await f.current.assets.import(source, { kind: "import" }, f.current.probe);
  const created = f.current.projects.create({
    requestId: "second-project",
    canvas: f.placed.revision.document.canvas,
  });
  const placed = f.current.projects.apply(created.project.projectId, {
    requestId: "second-source",
    expectedRevisionId: created.revision.id,
    operations: [
      { operation: "track.add", label: "track", track: { kind: "audio", order: 0 } },
      {
        operation: "place",
        clip: {
          trackId: { label: "track" },
          assetId: asset.id,
          streamId: "track:1",
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
  });
  const input = { projectId: created.project.projectId, revisionId: placed.revision.id };
  f.current.prepared.request(input);
  await f.current.jobs.idle();
  const second = JSON.parse(f.current.prepared.request(input).published!.result) as PreparedAudio;
  expect(second.assetId).toBe(first.assetId);
  expect(second.dependencies).toEqual([{ kind: "asset", id: asset.id }]);
  expect(first.dependencies).toEqual([{ kind: "asset", id: f.asset.id }]);
  expect(f.current.assets.portable(first.assetId).dependencies).toEqual([]);
  expect(
    f.current.projects.revisionDependencies(input.projectId, input.revisionId),
  ).not.toContainEqual({ kind: "asset", id: f.asset.id });
});

test("portable preparation retains original recipe and bounded PCM under adopted identities", async () => {
  const donor = await fixture(),
    receiver = await fixture([], "different-local-renderer");
  const original = await ready(donor);
  const portable = donor.current.prepared.portable(original.resourceId);
  const adoption = receiver.current.projects.prepareAdoption({
    requestId: "adopt",
    packageIdentity: "prepared",
    snapshot: donor.current.projects.snapshot(donor.input.projectId),
  });
  const assets: Awaited<ReturnType<AssetStore["stagePortable"]>>[] = [];
  for (const id of [donor.asset.id, original.assetId]) {
    const stage = await receiver.current.assets.stagePortable(
      donor.current.assets.portable(id),
      donor.current.assets.path(id),
      new AbortController().signal,
    );
    await stage.close();
    assets.push(stage);
  }
  const revision = adoption.revisions.find(
    (r) => r.id === adoption.revisionIds[donor.input.revisionId],
  )!;
  const composition = projectCompositionFromRevision(revision, receiver.current.assets, []);
  const stage = await receiver.current.prepared.stagePortable(
    portable,
    composition,
    assets[1]!.path,
    (reference) => reference,
    new AbortController().signal,
  );
  const controller = new AbortController();
  const canceled = await receiver.current.prepared.stagePortable(
    portable,
    composition,
    assets[1]!.path,
    (reference) => reference,
    controller.signal,
  );
  controller.abort();
  expect(() =>
    adoption.publish(() => assets.forEach((asset) => asset.publish()), {
      reference: (r) => r,
      publish: () => canceled.publish(),
    }),
  ).toThrow();
  expect(() => receiver.current.projects.get(adoption.project.projectId)).toThrow();
  expect(() => receiver.current.assets.get(original.assetId)).toThrow();
  await expect(
    receiver.current.prepared.stagePortable(
      { ...portable, audio: { ...portable.audio, dependencies: [] } },
      composition,
      assets[1]!.path,
      (reference) => reference,
      new AbortController().signal,
    ),
  ).rejects.toThrow("upstream dependency");
  await expect(
    receiver.current.prepared.stagePortable(
      { ...portable, audio: { ...portable.audio, frames: portable.audio.frames - 1 } },
      composition,
      assets[1]!.path,
      (reference) => reference,
      new AbortController().signal,
    ),
  ).rejects.toThrow("pinned sample window");
  const unresolved = JSON.parse(portable.publication.input);
  unresolved.requirements[0].implementationId = null;
  await expect(
    receiver.current.prepared.stagePortable(
      { ...portable, publication: { ...portable.publication, input: JSON.stringify(unresolved) } },
      composition,
      assets[1]!.path,
      (reference) => reference,
      new AbortController().signal,
    ),
  ).rejects.toThrow("unresolved execution requirements");
  expect(() => receiver.current.prepared.open(stage.resourceId)).toThrow();
  adoption.publish(() => assets.forEach((asset) => asset.publish()), {
    reference: (reference) =>
      reference.kind === "prepared-audio" ? { ...reference, id: stage.resourceId } : reference,
    publish: () => stage.publish(),
  });
  const adopted = receiver.current.prepared.portable(stage.resourceId);
  expect(JSON.parse(adopted.publication.input)).toEqual({
    ...JSON.parse(portable.publication.input),
    revisionId: revision.id,
  });
  expect(adopted.audio).toEqual(portable.audio);
  await rm(donor.current.assets.path(original.assetId));
  await receiver.reopen();
  const read = receiver.current.prepared.open(stage.resourceId, { start: 47980, end: 48000 });
  try {
    const bytes = Buffer.alloc(20 * 8);
    expect(read.read(bytes, 0)).toBe(bytes.length);
    expect(bytes).toEqual(wave(48000).subarray(44 + 47980 * 8));
    expect(read.read(bytes, bytes.length)).toBe(0);
  } finally {
    read.release();
  }
  expect(receiver.reads).toBe(0);
});

test("an adopted ready preparation does not start a replacement job", async () => {
  const f = await fixture();
  const original = await ready(f);
  const publication = f.current.prepared.portable(original.resourceId);
  const pending = f.current.prepared.request(f.input);
  f.current.jobs.forgetJob(pending.jobId!);
  const stage = await f.current.prepared.stagePortable(
    publication,
    projectCompositionFromRevision(
      f.current.projects.revision(f.input.projectId, f.input.revisionId),
      f.current.assets,
      [],
    ),
    f.current.assets.path(original.assetId),
    (reference) => reference,
    new AbortController().signal,
  );
  f.current.catalog.transaction(() => stage.publish());
  expect(JSON.parse(f.current.prepared.request(f.input).published!.result).resourceId).toBe(
    original.resourceId,
  );
  await f.current.jobs.idle();
  expect(JSON.parse(f.current.prepared.request(f.input).published!.result).resourceId).toBe(
    original.resourceId,
  );
  expect(f.reads).toBe(1);
});

test("portable prepared recipes retain a complete many-clip execution graph", async () => {
  const f = await fixture();
  const revision = f.current.projects.apply(f.input.projectId, {
    requestId: "many-clips",
    expectedRevisionId: f.input.revisionId,
    operations: Array.from({ length: 160 }, (_, index) => ({
      operation: "place" as const,
      clip: {
        trackId: f.placed.edit.labels.track!,
        assetId: f.asset.id,
        streamId: "track:1",
        source: { kind: "range" as const, range: { startUs: 0, endUs: 1000 } },
        placement: {
          kind: "project" as const,
          range: { startUs: 1000000 + index * 1000, endUs: 1000000 + (index + 1) * 1000 },
        },
      },
    })),
  }).revision;
  const input = { projectId: f.input.projectId, revisionId: revision.id };
  f.current.prepared.request(input);
  await f.current.jobs.idle();
  const status = f.current.prepared.request(input);
  expect(status.state).toBe("ready");
  const value = JSON.parse(status.published!.result) as PreparedAudio;
  expect(f.current.prepared.portable(value.resourceId).publication.input).toBe(
    status.published!.input,
  );
});
