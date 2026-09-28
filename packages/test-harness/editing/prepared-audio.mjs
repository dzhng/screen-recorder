import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Catalog } from "../../core/dist/catalog.js";
import { AssetStore } from "../../core/dist/assets.js";
import { AcquisitionStore } from "../../core/dist/acquisitions.js";
import { ProjectStore } from "../../core/dist/projects.js";
import { JobQueue } from "../../core/dist/jobs.js";
import { PreparedAudioStore } from "../../core/dist/prepared-audio.js";
import { projectAudioRenderer } from "../../../apps/service/dist/project-render.js";
import { mediaWorker, nativeResult } from "../../../apps/service/dist/worker.js";
import { writeSourceWave, sourcePeriod } from "./audio-project-fixture.mjs";
const { values } = parseArgs({ options: { out: { type: "string" } } });
assert(values.out && process.env.SCREENREC_NATIVE, "Set --out and SCREENREC_NATIVE");
const out = resolve(values.out);
await mkdir(out);
const worker = resolve(process.env.SCREENREC_NATIVE);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  nativeSha256: hash(await readFile(worker)),
  checks: [],
  commands: [],
  productionDSPReady: false,
};
assert.equal(
  report.nativeSha256,
  "1c07068b93152c6cb7c065b74186d6812ec977a9d7cbd640605b86cd27995233",
);
const home = await realpath(await mkdtemp("/tmp/prepared-native-"));
let current;
let rendered = 0;
const execute = mediaWorker({ ...process.env, SCREENREC_NATIVE: worker });
async function native(operation, params, options) {
  const response = await execute(operation, params, options);
  report.commands.push({ operation, params, response });
  return response;
}
async function connect() {
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  await assets.recover();
  const projects = new ProjectStore(catalog, assets, new AcquisitionStore(catalog));
  let prepared;
  const jobs = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin: (target) => {
        assert.equal(target.kind, "project");
        projects.revision(target.projectId, target.revisionId);
        return target;
      },
      isAvailable: (target) => target.kind === "project" && !projects.isDeleting(target.projectId),
      isDeleting: (target) => target.kind === "project" && projects.isDeleting(target.projectId),
      isCapturing: () => false,
    },
    execute: (execution) => prepared.execute(execution),
  });
  const renderer = projectAudioRenderer(native, join(home, "render"));
  prepared = new PreparedAudioStore({
    catalog,
    assets,
    projects,
    jobs,
    staging: join(home, "staging", "prepared-audio"),
    probe: async (path, signal) => nativeResult(await native("media.probe", { path }, { signal })),
    renderer: {
      ...renderer,
      render: async (request, signal) => {
        rendered++;
        return renderer.render(request, signal);
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
    close: async () => {
      await jobs.close();
      catalog.close();
    },
  };
}
try {
  current = await connect();
  const source = join(home, "source.wav");
  await writeSourceWave(source, { source: 0, seconds: 1 });
  const asset = await current.assets.import(source, { kind: "import" }, async (path, signal) =>
    nativeResult(await native("media.probe", { path }, { signal })),
  );
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
          streamId: asset.streams[0].id,
          source: { kind: "range", range: { startUs: 0, endUs: 1000000 } },
          placement: { kind: "project", range: { startUs: 0, endUs: 1000000 } },
        },
      },
    ],
  });
  const input = { projectId: created.project.projectId, revisionId: placed.revision.id };
  current.prepared.request(input);
  await current.jobs.idle();
  const status = current.prepared.request(input);
  assert.equal(status.state, "ready");
  const value = JSON.parse(status.published.result);
  const expected = sourcePeriod(0);
  const full = current.prepared.open(value.resourceId);
  try {
    const bytes = Buffer.alloc(full.bytes);
    assert.equal(full.read(bytes, 0), bytes.length);
    assert(bytes.equals(expected));
    report.pcmSha256 = hash(bytes);
    await writeFile(join(out, "prepared.wav"), await readFile(current.assets.path(value.assetId)));
  } finally {
    full.release();
  }
  report.checks.push("native full unit-rate prepared PCM equals independent source oracle");
  const split = current.projects.apply(input.projectId, {
    requestId: "split",
    expectedRevisionId: input.revisionId,
    operations: [
      { operation: "split", clipIds: [placed.edit.labels.clip], atUs: 333333, scope: "selected" },
    ],
  });
  const splitInput = { ...input, revisionId: split.revision.id };
  current.prepared.request(splitInput);
  await current.jobs.idle();
  const splitReady = current.prepared.request(splitInput);
  assert.equal(splitReady.state, "ready");
  const splitValue = JSON.parse(splitReady.published.result);
  const splitRead = current.prepared.open(splitValue.resourceId);
  try {
    const bytes = Buffer.alloc(splitRead.bytes);
    splitRead.read(bytes, 0);
    assert(bytes.equals(expected));
  } finally {
    splitRead.release();
  }
  report.checks.push(
    "native pure split prepares identical PCM under independent revision identity",
  );
  const gained = current.projects.apply(input.projectId, {
    requestId: "gain",
    expectedRevisionId: split.revision.id,
    operations: [
      {
        operation: "processing.set",
        target: { kind: "output" },
        steps: [{ processor: { type: "gain", gain: 0.5 } }],
      },
    ],
  });
  const gainInput = { ...input, revisionId: gained.revision.id };
  current.prepared.request(gainInput);
  await current.jobs.idle();
  const gainStatus = current.prepared.request(gainInput);
  assert.equal(gainStatus.state, "ready");
  const gainValue = JSON.parse(gainStatus.published.result),
    gainRead = current.prepared.open(gainValue.resourceId);
  try {
    const bytes = Buffer.alloc(gainRead.bytes);
    gainRead.read(bytes, 0);
    for (let i = 0; i < bytes.length; i += 4)
      assert.equal(bytes.readFloatLE(i), Math.fround(expected.readFloatLE(i) * 0.5));
  } finally {
    gainRead.release();
  }
  report.checks.push(
    "native constant gain produces exact independent sample oracle in its own revision",
  );
  await current.close();
  current = await connect();
  const before = report.commands.length;
  const late = current.prepared.open(value.resourceId, { start: 47003, end: 47017 });
  try {
    const bytes = Buffer.alloc(256);
    assert.equal(late.read(bytes, 0), 112);
    assert(bytes.subarray(0, 112).equals(expected.subarray(47003 * 8, 47017 * 8)));
    assert.equal(late.read(bytes, 112), 0);
    report.excerptSha256 = hash(bytes.subarray(0, 112));
  } finally {
    late.release();
  }
  assert.equal(report.commands.length, before);
  assert.equal(rendered, 3);
  report.checks.push(
    "late historical excerpt survives restart with no native calls or prefix replay",
  );
  report.publication = { ...status.published, result: value };
  report.splitPublication = { ...splitReady.published, result: splitValue };
  report.passed = true;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, checks: report.checks }, null, 2));
} finally {
  await current?.close();
  await rm(home, { recursive: true, force: true });
}
