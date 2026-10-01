import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { appendFileSync, constants, readFileSync } from "node:fs";
import { chmod, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { cliReply } from "./first-preview-transport.mjs";

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), "../../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Fenced per producer before forwarding; copied catalogs need no media preparation.
const allowed = {
  recording: ["packageWorkspace.recover", "media.frame"],
  project: [
    "packageWorkspace.recover",
    "media.audioCapabilities",
    "storage.clearRenderWorkspace",
    "media.sourceFrame",
    "media.renderCompositionFrame",
  ],
};
if (process.argv[2] === "--native-proxy") {
  const input = readFileSync(0),
    request = JSON.parse(input);
  const side = process.env.SCREENREC_FRAME_SIDE;
  const admitted =
    allowed[side]?.includes(request.operation) &&
    (process.env.SCREENREC_FRAME_CACHE_ONLY !== "1" ||
      [
        "packageWorkspace.recover",
        "media.audioCapabilities",
        "storage.clearRenderWorkspace",
      ].includes(request.operation));
  appendFileSync(
    process.env.SCREENREC_FRAME_NATIVE_LOG,
    JSON.stringify({ side, request, admitted }) + "\n",
  );
  assert(admitted, `Unrequested native operation: ${side}/${request.operation}`);
  const descriptors =
    request.operation === "packageWorkspace.recover"
      ? [3]
      : request.operation === "storage.clearRenderWorkspace"
        ? request.params.parent
          ? [3, 4]
          : [3]
        : side === "project" &&
            ["media.sourceFrame", "media.renderCompositionFrame"].includes(request.operation)
          ? [3, 4]
          : [];
  const child = spawn(process.env.SCREENREC_FRAME_WORKER, [], {
    cwd: "/",
    stdio: ["pipe", "pipe", "pipe", ...descriptors],
  });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (bytes) => {
    stdout += bytes;
    assert(stdout.length < 16 * 1024 ** 2);
  });
  child.stderr.on("data", (bytes) => {
    stderr += bytes;
  });
  child.stdin.end(input);
  const [code, signal] = await once(child, "close");
  appendFileSync(
    process.env.SCREENREC_FRAME_NATIVE_LOG,
    JSON.stringify({ side, pid: child.pid, response: stdout, stderr, exit: { code, signal } }) +
      "\n",
  );
  assert.equal(code, 0, stderr);
  process.stdout.write(stdout);
  process.exit(0);
}
function checkCompletePictures(saved, uncut = false) {
  for (const picture of saved.pictures.filter((p) => p.phase !== "raw")) {
    const receipt = picture.data.published.frame;
    assert.equal(receipt.width, 3120);
    assert.equal(receipt.height, 1970);
    assert.equal(receipt.sourceWidth, 3120);
    assert.equal(receipt.sourceHeight, 1970);
    if (picture.side === "recording") {
      assert.equal(receipt.requestedPlaybackUs, picture.params.atUs);
      assert.equal(receipt.clean, true);
      assert.equal(receipt.overlay, undefined);
      assert.equal(receipt.annotation, null);
      assert.equal(receipt.sourceEvidence, null);
      continue;
    }
    const revision = saved.revisions[picture.phase];
    const index = Math.floor((picture.params.atUs * 60) / 1000000);
    const label = Math.floor((index * 1000000) / 60);
    const end = picture.phase === "after" ? 132025574 : 134025574;
    assert.equal(receipt.frame.index, index);
    assert.equal(receipt.frame.sampleAtUs, label);
    assert.deepEqual(receipt.frame.visibleRange, {
      startUs: label,
      endUs: Math.min(Math.floor(((index + 1) * 1000000) / 60), end),
    });
    const clips = revision.document.clips.filter(
      (c) =>
        c.assetId === "ade26eacf8dce118e4fe16dcf261e7d3445d115e2b92721f0a01b8a4511de17a" &&
        c.placement.range.startUs * 60 <= index * 1000000 &&
        index * 1000000 < c.placement.range.endUs * 60,
    );
    assert.equal(clips.length, 1);
    const clip = clips[0];
    const expected =
      index * 1000000 + (clip.source.range.startUs - clip.placement.range.startUs) * 60;
    const source = receipt.frame.layers[0].sourceUs;
    const numerator = typeof source === "number" ? source : source.numerator;
    const denominator = typeof source === "number" ? 1 : source.denominator;
    const oracle =
      uncut && picture.phase === "after" && picture.params.atUs === 1000000
        ? index * 1000000
        : expected;
    assert.equal(
      numerator * 60,
      oracle * denominator,
      "First-join/source mapping differs from the explicit caller oracle",
    );
    assert.deepEqual(receipt.frame.layers, [
      {
        kind: "video",
        clipId: clip.id,
        trackId: clip.trackId,
        assetId: clip.assetId,
        streamId: clip.streamId,
        sourceUs: source,
        availability: "available",
        width: 3120,
        height: 1970,
      },
    ]);
    assert.equal(receipt.pictures.length, 1);
    assert.equal(receipt.pictures[0].clipId, clip.id);
    assert.equal(receipt.pictures[0].assetId, clip.assetId);
    assert.equal(receipt.pictures[0].streamId, clip.streamId);
    assert.equal(receipt.profile, "h264-rec709");
  }
}
const { values } = parseArgs({
  options: {
    ...Object.fromEntries(
      [
        "out",
        "old-catalog",
        "project-home",
        "legacy-app",
        "service",
        "cli",
        "probe",
        "pixels",
        "providers",
        "verify-only",
        "cached-only",
      ].map((key) => [key, { type: "string" }]),
    ),
    "uncut-oracle": { type: "boolean" },
  },
});
for (const key of Object.keys(values))
  if (typeof values[key] === "string") values[key] = resolve(values[key]);
if (values["verify-only"]) {
  const saved = JSON.parse(await readFile(values["verify-only"]));
  checkCompletePictures(saved, values["uncut-oracle"]);
  const compositionPixelsExact = saved.comparisons
    .filter((c) => c.kind === "project")
    .every((c) => c.differentBytes === 0);
  console.log(
    JSON.stringify({
      completeReceiptOraclePassed: true,
      compositionPixelsExact,
      fullPresentationVerified: compositionPixelsExact,
      rawReportSHA256: hash(await readFile(values["verify-only"])),
    }),
  );
  process.exit(0);
}
const cached = values["cached-only"] ? JSON.parse(await readFile(values["cached-only"])) : null;
if (cached) assert.equal(cached.passed, true);
for (const key of cached
  ? ["out", "legacy-app", "service", "cli", "providers"]
  : [
      "out",
      "old-catalog",
      "project-home",
      "legacy-app",
      "service",
      "cli",
      "probe",
      "pixels",
      "providers",
    ])
  assert(values[key], `Missing --${key}`);
const out = values.out;
await mkdir(out, { mode: 0o700 });
const report = {
  scope:
    "23l frame membership, legacy/raw pixel and delivery checks; composition pixel differences remain explicit",
  passed: false,
  inputs: {},
  qualification: null,
  exchanges: [],
  processes: [],
  pictures: [],
  references: [],
  comparisons: [],
  controls: [],
  nativeAllowed: allowed,
};
const pin = async (path) => ({
  path,
  bytes: (await readFile(path)).length,
  sha256: hash(await readFile(path)),
});
const currentWorker = process.env.SCREENREC_NATIVE;
assert(currentWorker);
const oldWorker = join(values["legacy-app"], "Contents/MacOS/screenrec-native");
for (const [label, path, expected] of [
  [
    "currentWorker",
    currentWorker,
    "0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928",
  ],
  ["oldWorker", oldWorker, "c3402dd667a46da62da7603102ce6f9bbdbebe04442bcaf6e7fe45157e18ff4b"],
  [
    "oldCatalog",
    values["old-catalog"],
    "7f882c348f248e79ad4efaa609f3e36092a037876ef566ac7b36927dd18715eb",
  ],
  [
    "currentCatalog",
    join(values["project-home"] ?? out, "library/catalog.sqlite"),
    "ba8be18f32048ab4ed94917a1df719716f51547d17c4d133e4e9fd7df16f9a9f",
  ],
]) {
  if (cached && ["oldCatalog", "currentCatalog"].includes(label)) continue;
  report.inputs[label] = await pin(path);
  assert.equal(report.inputs[label].sha256, expected);
}
for (const key of cached ? ["service", "cli"] : ["service", "cli", "probe", "pixels"])
  report.inputs[key] = await pin(values[key]);
const providerRequire = createRequire(join(values.providers, "package.json"));
const clientPath = providerRequire.resolve("@modelcontextprotocol/sdk/client/index.js");
const transportPath = providerRequire.resolve("@modelcontextprotocol/sdk/client/stdio.js");
const { Client } = await import(pathToFileURL(clientPath));
const { StdioClientTransport } = await import(pathToFileURL(transportPath));
report.inputs.sdkClient = await pin(clientPath);
report.inputs.sdkTransport = await pin(transportPath);
const fixture = join(root, "fixtures/narrated-workbench");
const { recordingId } = JSON.parse(await readFile(join(fixture, "recording.json")));
const D = 134025574,
  duration = D - 2000000;
const videoId = "ade26eacf8dce118e4fe16dcf261e7d3445d115e2b92721f0a01b8a4511de17a";
const audioId = "2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c";
const originalPins = {
  "video.mov": videoId,
  "narration.mov": audioId,
  "capture.journal.jsonl": "d44ff9028b14c533b78db6bf944b63cfc46e84b5f8d8e92299a36d4e1d986698",
};
const homes = cached ? dirname(values["cached-only"]) : out;
const oldHome = join(homes, "recording-home"),
  newHome = join(homes, "project-home");
if (!cached) {
  await mkdir(join(oldHome, "recordings", recordingId, "source"), { recursive: true, mode: 0o700 });
  await mkdir(join(newHome, "library/assets"), { recursive: true, mode: 0o700 });
  await chmod(oldHome, 0o700);
  await chmod(newHome, 0o700);
  await copyFile(values["old-catalog"], join(oldHome, "library.sqlite"));
  await copyFile(report.inputs.currentCatalog.path, join(newHome, "library/catalog.sqlite"));
  for (const [name, expected] of Object.entries(originalPins)) {
    const path = join(fixture, name);
    assert.equal(hash(await readFile(path)), expected);
    await copyFile(path, join(oldHome, "recordings", recordingId, "source", name));
  }
  report.inputs.assets = [];
  for (const name of await readdir(join(values["project-home"], "library/assets"))) {
    const path = join(newHome, "library/assets", name);
    await copyFile(
      join(values["project-home"], "library/assets", name),
      path,
      constants.COPYFILE_FICLONE,
    );
    const identity = await pin(path);
    assert.equal(identity.sha256, name.split(".")[0]);
    report.inputs.assets.push(identity);
  }
}
if (cached) {
  assert.equal(
    hash(await readFile(values["cached-only"])),
    "d30b2bf479a8782ba42e4b6cb3b3e1360c8eb21609bd86b4cd315e0b54997408",
  );
  report.cachedAuthority = await pin(values["cached-only"]);
  report.scope =
    "Exactly two cached first-join CLI/default SDK MCP reads; all native media work fenced";
  report.nativeAllowed = {
    recording: ["packageWorkspace.recover"],
    project: [
      "packageWorkspace.recover",
      "media.audioCapabilities",
      "storage.clearRenderWorkspace",
    ],
  };
  report.receiver = { configuration: "SDK default; maxBufferSize omitted", defaultBytes: 10485760 };
  for (const label of [
    "currentWorker",
    "oldWorker",
    "service",
    "cli",
    "sdkClient",
    "sdkTransport",
  ]) {
    assert.equal(report.inputs[label].sha256, cached.inputs[label].sha256);
  }
  report.homeCatalogsBefore = {
    recording: await pin(join(oldHome, "library.sqlite")),
    project: await pin(join(newHome, "library/catalog.sqlite")),
  };
}
const proxy = join(out, "native-gate.mjs");
await writeFile(
  proxy,
  `#!${process.execPath}\nprocess.argv[2]='--native-proxy'; await import(${JSON.stringify(script)});\n`,
);
await chmod(proxy, 0o700);
const sandbox = join(out, "authorities.sb");
await writeFile(
  sandbox,
  `(version 1)\n(allow default)\n(deny file-write* ${[
    fixture,
    values["project-home"],
    values["legacy-app"],
    values["old-catalog"],
    currentWorker,
    join(process.env.HOME, ".screen-recorder"),
  ]
    .filter(Boolean)
    .map((path) => `(subpath ${JSON.stringify(path)})`)
    .join(" ")})\n`,
);
const children = [];
async function subprocess(label, command, args, options = {}) {
  const child = spawn(command, args, { cwd: out, stdio: ["pipe", "pipe", "pipe"], ...options });
  const record = { label, command, args, pid: child.pid, stdout: "", stderr: "", exit: null };
  report.processes.push(record);
  child.stdout.on("data", (b) => {
    record.stdout += b;
  });
  child.stderr.on("data", (b) => {
    record.stderr += b;
  });
  const closed = once(child, "close").then(([code, signal]) => {
    record.exit = { code, signal };
    return record.exit;
  });
  children.push({ child, closed, record });
  return { child, closed, record };
}
const pause = () => new Promise((done) => setTimeout(done, 100));
async function start(side) {
  const entry =
    side === "recording"
      ? join(values["legacy-app"], "Contents/Resources/service/main.mjs")
      : values.service;
  const cli =
    side === "recording"
      ? join(values["legacy-app"], "Contents/Resources/cli/main.mjs")
      : values.cli;
  report.inputs[side + "Service"] = await pin(entry);
  report.inputs[side + "CLI"] = await pin(cli);
  const service = await subprocess(
    side,
    "/usr/bin/sandbox-exec",
    ["-f", sandbox, process.execPath, entry],
    {
      env: {
        ...process.env,
        SCREENREC_HOME: side === "recording" ? oldHome : newHome,
        SCREENREC_NATIVE: proxy,
        SCREENREC_FRAME_SIDE: side,
        SCREENREC_FRAME_CACHE_ONLY: cached ? "1" : "0",
        SCREENREC_FRAME_WORKER: side === "recording" ? oldWorker : currentWorker,
        SCREENREC_FRAME_NATIVE_LOG: join(out, "native.jsonl"),
      },
    },
  );
  let socket;
  for (let i = 0; i < 150; i++) {
    socket = service.record.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((line) => line.event === "started")?.socketPath;
    if (socket) break;
    assert.equal(service.record.exit, null, service.record.stderr);
    await pause();
  }
  assert(socket, service.record.stderr + service.record.stdout);
  const mcp = new Client({ name: "paired-edited-frames", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cli, "mcp", "--socket", socket],
    stderr: "pipe",
  });
  await mcp.connect(transport);
  const adapter = { label: side + "-MCP", pid: transport.pid, terminal: false };
  report.processes.push(adapter);
  const originalClose = transport.onclose;
  const adapterClosed = new Promise((done) => {
    transport.onclose = () => {
      adapter.terminal = true;
      adapter.event = "SDK transport onclose from child close";
      originalClose?.();
      done();
    };
  });
  return {
    async call(operation, params, { output, mcp: viaMCP = false } = {}) {
      const response = viaMCP
        ? await mcp.callTool({ name: operation, arguments: params })
        : await cliReply([
            cli,
            operation,
            "--socket",
            socket,
            "--params",
            JSON.stringify(params),
            ...(output ? ["--output", output] : []),
          ]);
      report.exchanges.push({
        side,
        transport: viaMCP ? "MCP" : "CLI",
        operation,
        params,
        output,
        response,
      });
      const result = viaMCP ? response.structuredContent : response;
      assert.equal(result?.ok, true, JSON.stringify(response));
      return { data: result.data, response };
    },
    async stop() {
      await mcp.close();
      await adapterClosed;
      service.child.stdin.end();
      assert.deepEqual(await service.closed, { code: 0, signal: null }, service.record.stderr);
    },
  };
}
const q = (n, d = 1n) => ({ n: BigInt(n), d: BigInt(d) });
const clock = (c) => q(BigInt(c.value) * 1000000n, c.timescale);
const compare = (a, b) => (a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0);
const sourceAt = (instant, edited) =>
  q(
    instant.n +
      (edited
        ? instant.n >= 3000000n * instant.d
          ? 2000000n
          : instant.n >= 1000000n * instant.d
            ? 1000000n
            : 0n
        : 0n) *
        instant.d,
    instant.d,
  );
const cases = [999999, 1000000, 1000001, 2999999, 3000000, 3000001, duration - 1];
const point = (at) => q(BigInt(Math.floor((at * 60) / 1000000)) * 1000000n, 60n);
const points = [];
for (const edited of [false, true])
  for (const at of cases)
    for (const instant of [q(at), point(at)]) {
      const t = sourceAt(instant, edited);
      points.push({ numerator: Number(t.n), denominator: Number(t.d) });
    }
for (const t of [0, 1000000, 2000000, 4000000, 5000000, D - 1])
  points.push({ numerator: t, denominator: 1 });
let samples = [];
if (!cached) {
  const qualifiedPath = join(out, "qualification-input.json");
  await writeFile(qualifiedPath, JSON.stringify({ file: join(fixture, "video.mov"), points }));
  const qualification = await subprocess("independent-sample-support", values.probe, [
    qualifiedPath,
  ]);
  qualification.child.stdin.end();
  assert.deepEqual(
    await qualification.closed,
    { code: 0, signal: null },
    qualification.record.stderr,
  );
  report.qualification = JSON.parse(qualification.record.stdout);
  samples = report.qualification.samples;
}
const containing = (at) => {
  const matches = samples.filter(
    (s) => compare(clock(s.start), at) <= 0 && compare(at, clock(s.end)) < 0,
  );
  assert.equal(matches.length, 1, `No unique physical support at ${at.n}/${at.d}`);
  return matches[0];
};
const tail = sourceAt(point(cases.at(-1)), true);
report.tail = {
  requestedNumerator: String(tail.n),
  requestedDenominator: String(tail.d),
  qualified:
    !cached &&
    samples.some(
      (s) =>
        s.roundedUs === 134006597 &&
        compare(clock(s.start), tail) <= 0 &&
        compare(tail, clock(s.end)) < 0,
    ),
};
if (!report.tail.qualified) cases.pop();
if (cached) delete report.tail;
const nearest = (at, kept) =>
  samples
    .filter((s) => s.roundedUs >= kept.startUs && s.roundedUs < kept.endUs)
    .sort(
      (a, b) =>
        Math.abs(a.roundedUs - at) - Math.abs(b.roundedUs - at) || a.roundedUs - b.roundedUs,
    )[0];
function oldExpected(at, revision) {
  let through = 0;
  for (const kept of revision.spans) {
    const end = through + kept.endUs - kept.startUs;
    if (at < end) {
      const requested = kept.startUs + at - through;
      return { sample: nearest(requested, kept), requested, kept };
    }
    through = end;
  }
  assert.fail("Outside old revision");
}
const unique = new Map();
const key = (s) => `${s.start.value}/${s.start.timescale}`;
async function image(service, side, phase, params, expected) {
  let value;
  const deadline = Date.now() + 180000;
  do {
    value = (await service.call("frame.get", params)).data;
    assert(!["failed", "canceled", "unavailable"].includes(value.state), JSON.stringify(value));
    assert(Date.now() < deadline);
    if (value.state !== "ready") await pause();
  } while (value.state !== "ready");
  const file = join(out, `${report.pictures.length}-${side}-${phase}.png`);
  value = (await service.call("frame.get", params, { output: file })).data;
  const receipt = value.published.frame;
  const actual =
    side === "recording"
      ? receipt.actualSourceUs
      : phase === "raw"
        ? receipt.actualSourceUs
        : receipt.pictures[0].actualSourceUs;
  assert.equal(actual, expected.roundedUs);
  const picture = {
    side,
    phase,
    params,
    data: value,
    file,
    sha256: hash(await readFile(file)),
    sample: expected,
  };
  report.pictures.push(picture);
  unique.set(key(expected), expected);
  return picture;
}
async function pixels(picture) {
  if (picture.rgba) return readFile(picture.rgba);
  picture.rgba = picture.file + ".rgba";
  const run = await subprocess("profile-pixels", values.pixels, [picture.file, picture.rgba]);
  run.child.stdin.end();
  assert.deepEqual(await run.closed, { code: 0, signal: null }, run.record.stderr);
  picture.pixelReceipt = JSON.parse(run.record.stdout);
  return readFile(picture.rgba);
}
const diff = (a, b) => {
  assert.equal(a.length, b.length);
  let differentBytes = 0,
    maximumChannelDifference = 0;
  for (let i = 0; i < a.length; i++)
    if (a[i] !== b[i]) {
      differentBytes++;
      maximumChannelDifference = Math.max(maximumChannelDifference, Math.abs(a[i] - b[i]));
    }
  return { bytes: a.length, differentBytes, maximumChannelDifference };
};
let old, modern;
try {
  old = await start("recording");
  modern = await start("project");
  if (cached) {
    for (const [service, side] of [
      [old, "recording"],
      [modern, "project"],
    ]) {
      const expected = cached.pictures.find(
        (p) => p.side === side && p.phase === "after" && p.params.atUs === 1000000,
      );
      assert(expected);
      const originalBytes = await readFile(expected.file);
      assert.equal(hash(originalBytes), expected.sha256);
      const file = join(out, side + "-default.png");
      const cli = await service.call("frame.get", expected.params, { output: file });
      assert.equal(
        cli.data.state,
        "ready",
        "Cached derivative unavailable; no media fallback authorized",
      );
      assert.deepEqual(await readFile(file), originalBytes);
      const result = await service.call("frame.get", expected.params, { mcp: true });
      assert.equal(result.data.state, "ready");
      const image = result.response.content.find((c) => c.type === "image");
      assert(image, "Default MCP reader did not consume inline PNG");
      assert.deepEqual(Buffer.from(image.data, "base64"), originalBytes);
      const strip = ({ delivery, output, ...metadata }) => {
        void delivery;
        void output;
        return metadata;
      };
      assert.deepEqual(strip(cli.data), strip(expected.data));
      assert.deepEqual(strip(result.data), strip(expected.data));
      report.pictures.push({
        side,
        params: expected.params,
        file,
        bytes: originalBytes.length,
        sha256: expected.sha256,
        original: expected.file,
        cliData: cli.data,
        mcpData: result.data,
        inlineConsumed: true,
      });
    }
    report.passed = true;
  } else {
    const recording = (await old.call("recording.get", { recordingId })).data;
    const restored = (
      await old.call("edit.restore", {
        recordingId,
        requestId: "23l-original",
        expectedRevisionId: recording.currentRevisionId,
        targetRevisionId: "r0",
      })
    ).data.revision;
    const created = (
      await modern.call("project.create", {
        requestId: "23l-project",
        title: "Paired frame primitive fixture",
        canvas: {
          width: 3120,
          height: 1970,
          fps: { numerator: 60, denominator: 1 },
          background: "#000000ff",
        },
      })
    ).data;
    const projectId = created.project.projectId,
      operations = [];
    for (const [kind, assetId, startUs, endUs] of [
      ["video", videoId, 0, D],
      ["audio", audioId, 48675, 134022009],
    ]) {
      const asset = (await modern.call("asset.get", { assetId })).data;
      assert.equal(asset.originUs, startUs);
      operations.push(
        { operation: "track.add", label: kind, track: { kind, order: 0 } },
        {
          operation: "place",
          clip: {
            trackId: { label: kind },
            assetId,
            streamId: "track:1",
            source: { kind: "range", range: { startUs: 0, endUs: endUs - startUs } },
            placement: { kind: "project", range: { startUs, endUs } },
          },
        },
      );
    }
    const before = (
      await modern.call("edit.apply", {
        projectId,
        requestId: "23l-place",
        expectedRevisionId: created.revision.id,
        operations,
      })
    ).data.revision;
    const ranges = [
      { startUs: 1000000, endUs: 2000000 },
      { startUs: 4000000, endUs: 5000000 },
    ];
    const afterOld = (
      await old.call("edit.cut", {
        recordingId,
        expectedRevisionId: restored.id,
        requestId: "23l-cut",
        ranges,
      })
    ).data.revision;
    const after = (
      await modern.call("edit.apply", {
        projectId,
        expectedRevisionId: before.id,
        requestId: "23l-cut",
        operations: [
          {
            operation: "remove",
            scope: "selected",
            clipIds: before.document.clips.map((c) => c.id),
            ranges,
            ripple: { trackIds: before.document.tracks.map((t) => t.id) },
          },
        ],
      })
    ).data.revision;
    assert.deepEqual(afterOld.spans, [
      { startUs: 0, endUs: 1000000 },
      { startUs: 2000000, endUs: 4000000 },
      { startUs: 5000000, endUs: D },
    ]);
    report.revisions = { beforeOld: restored, afterOld, before, after };
    for (const [phase, edited, oldRevision, revision] of [
      ["before", false, restored, before],
      ["after", true, afterOld, after],
    ])
      for (const atUs of cases) {
        const oldPlan = oldExpected(atUs, oldRevision);
        const a = await image(
          old,
          "recording",
          phase,
          { recordingId, revisionId: oldRevision.id, atUs, clean: true, maxLongEdge: 3120 },
          oldPlan.sample,
        );
        assert.deepEqual(a.data.published.frame.kept, oldPlan.kept);
        assert.equal(a.data.published.frame.requestedSourceUs, oldPlan.requested);
        const wanted = sourceAt(point(atUs), edited),
          selected = containing(wanted);
        const b = await image(
          modern,
          "project",
          phase,
          { projectId, revisionId: revision.id, atUs, maxLongEdge: 3120 },
          selected,
        );
        const frame = b.data.published.frame;
        assert.equal(frame.frame.sampleAtUs, Number(point(atUs).n / point(atUs).d));
        assert.equal(compare(clock(frame.pictures[0].sample), clock(selected.start)), 0);
        const source = frame.frame.layers[0].sourceUs;
        assert.equal(
          compare(
            typeof source === "number" ? q(source) : q(source.numerator, source.denominator),
            wanted,
          ),
          0,
        );
      }
    for (const selected of unique.values()) {
      const a = await image(
        old,
        "recording",
        "raw",
        { recordingId, revisionId: "r0", atUs: selected.roundedUs, clean: true, maxLongEdge: 3120 },
        selected,
      );
      const start = clock(selected.start),
        referenceUs = Number((start.n + start.d - 1n) / start.d);
      const b = await image(
        modern,
        "project",
        "raw",
        { assetId: videoId, streamId: "track:1", atUs: referenceUs, maxLongEdge: 3120 },
        selected,
      );
      assert.equal(compare(clock(b.data.published.frame.sample), start), 0);
      report.references.push({ sample: selected, legacy: a.file, current: b.file, referenceUs });
      const difference = diff(await pixels(a), await pixels(b));
      assert.equal(difference.differentBytes, 0, "Matched original/direct source pixels differ");
      report.comparisons.push({ kind: "raw", sample: key(selected), ...difference });
    }
    for (const p of report.pictures.filter((p) => p.phase !== "raw")) {
      const ref = report.references.find((r) => key(r.sample) === key(p.sample));
      const original = report.pictures.find((r) => r.file === ref.legacy);
      const difference = diff(await pixels(p), await pixels(original));
      if (p.side === "recording")
        assert.equal(
          difference.differentBytes,
          0,
          "Edited legacy pixels differ from its own r0 picture",
        );
      report.comparisons.push({
        kind: p.side,
        file: p.file,
        reference: original.file,
        sample: key(p.sample),
        ...difference,
      });
    }
    for (const [service, side] of [
      [old, "recording"],
      [modern, "project"],
    ]) {
      const expected = report.pictures.find(
        (p) => p.side === side && p.phase === "after" && p.params.atUs === 1000000,
      );
      const { data, response } = await service.call("frame.get", expected.params, { mcp: true });
      const inline = response.content.find((c) => c.type === "image");
      assert(inline, "MCP did not deliver an image");
      assert.equal(hash(Buffer.from(inline.data, "base64")), expected.sha256);
      const strip = ({ delivery, output, ...metadata }) => {
        void delivery;
        void output;
        return metadata;
      };
      assert.deepEqual(strip(data), strip(expected.data));
    }
    const first = report.pictures.find(
      (p) => p.side === "project" && p.phase === "after" && p.params.atUs === 1000000,
    );
    assert.throws(
      () => assert.equal(first.data.published.frame.frame.layers[0].sourceUs, 1000000),
      /2000000/,
    );
    report.controls.push({
      name: "uncut first-join mapping",
      expectedSourceUs: 1000000,
      actualSourceUs: first.data.published.frame.frame.layers[0].sourceUs,
      refused: true,
    });
    checkCompletePictures(report);
    report.fullPresentationVerified = report.comparisons
      .filter((c) => c.kind === "project")
      .every((c) => c.differentBytes === 0);
    report.passed = true;
  }
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  for (const service of [old, modern]) if (service) await service.stop();
  for (const handle of children)
    if (handle.record.exit === null) {
      handle.child.stdin.end();
      await handle.closed;
    }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify({
    passed: report.passed,
    failure: report.failure,
    tail: report.tail,
    pictures: report.pictures.length,
    references: report.references.length,
    out,
  }),
);
