import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { signedTimeValueSchema } from "@yap/composition";

const run = promisify(execFile);
const entry = new URL("./video-corpus.mjs", import.meta.url).pathname;
const hash = (b) => createHash("sha256").update(b).digest("hex");

test("selected derivation freezes decoded samples without modifying external source", async (t) => {
  const { directory, manifest, wave } = await input(t);
  const sources = await mkdtemp(join(tmpdir(), "yap-corpus-external-"));
  t.after(() => rm(sources, { recursive: true, force: true }));
  await writeFile(join(sources, "external.wav"), wave);
  const recipe = manifest.cases[0];
  recipe.source.sha256 = hash(wave);
  recipe.source.range = { startUs: 0, endUs: 1000 };
  await writeFile(join(directory, "recipes.json"), JSON.stringify({ cases: [recipe] }));
  await rm(join(directory, "clock.wav"));
  await rm(join(directory, "manifest.json"));
  const { deriveCorpus, verifyCorpus } = await import("./video-corpus.mjs");
  const native = async (operation, params) => {
    if (operation === "media.probe")
      return {
        ok: true,
        data: {
          originUs: { numerator: 1000000, denominator: 3 },
          streams: [{ id: "track:1", kind: "audio", startUs: 0, endUs: 1000 }],
        },
      };
    if (!signedTimeValueSchema.safeParse(params.source.sourceOffsetUs).success)
      return {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Native source clock is not an exact signed time",
        },
      };
    await copyFile(params.source.source, params.output);
    return {
      ok: true,
      data: {
        file: params.output,
        frames: 16,
        sampleRate: 16000,
        channels: 1,
        unavailable: [],
        sampleRange: { start: 0, end: 16 },
      },
    };
  };
  const result = await deriveCorpus(directory, sources, "clock-control", native, {
    kind: "authored-native-boundary-control",
  });
  assert.equal(result.cases[0].preservation.status, "pass");
  assert.equal((await verifyCorpus(directory)).cases[0].sha256, hash(wave));
  assert.deepEqual(await readFile(join(sources, "external.wav")), wave);
  await writeFile(join(sources, "external.wav"), Buffer.alloc(wave.length));
  await assert.rejects(deriveCorpus(directory, sources, "clock-control", native, {}), {
    code: "SOURCE_CHANGED",
  });
});

async function input(t) {
  const directory = await mkdtemp(join(tmpdir(), "yap-corpus-control-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const wave = Buffer.alloc(44 + 16 * 4);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(3, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(16000, 24);
  wave.writeUInt32LE(64000, 28);
  wave.writeUInt16LE(4, 32);
  wave.writeUInt16LE(32, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(64, 40);
  wave.writeFloatLE(0.25, 44);
  const manifest = {
    cases: [
      {
        id: "clock-control",
        classification: "constructed-control",
        feedback: ["E02"],
        source: {
          sha256: "a".repeat(64),
          file: "external.wav",
          streamIndex: 0,
          range: { startUs: 10000000, endUs: 10001000 },
        },
        derivative: {
          file: "clock.wav",
          sha256: hash(wave),
          bytes: wave.length,
          kind: "audio",
          sampleRate: 16000,
          channels: 1,
          frames: 16,
        },
        clock: {
          sourceAtZeroUs: 10000000,
          sourceFrames: 16,
          trailingSilenceFrames: 0,
        },
        preservation: {
          status: "pass",
          basis: "independent authored sample clock",
        },
        baseline: {
          state: "unverified",
          reason: "control has no historical ASR verdict",
        },
      },
    ],
  };
  await writeFile(join(directory, "clock.wav"), wave);
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  return { directory, manifest, wave };
}

test("committed corpus inputs verify their physical samples and exact source clock", async (t) => {
  const { directory, wave } = await input(t);
  const { stdout } = await run(process.execPath, [entry, "verify", "--fixtures", directory]);
  assert.deepEqual(JSON.parse(stdout), {
    ok: true,
    bytes: wave.length,
    cases: [{ id: "clock-control", sha256: hash(wave), baseline: "unverified" }],
  });
});

test("matching input bytes cannot certify an incorrect fractional source clock", async (t) => {
  const { directory, manifest } = await input(t);
  manifest.cases[0].source.range.endUs = {
    numerator: 20002125,
    denominator: 2,
  };
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  await assert.rejects(
    run(process.execPath, [entry, "verify", "--fixtures", directory]),
    (error) => {
      assert.equal(error.code, 1);
      const reply = JSON.parse(error.stdout);
      assert.equal(reply.ok, false);
      assert.equal(reply.error.code, "CLOCK_CHANGED");
      return true;
    },
  );
});

for (const [name, code, alter] of [
  [
    "an unfetched LFS pointer",
    "MISSING_LFS",
    async ({ directory }) => {
      await writeFile(
        join(directory, "clock.wav"),
        "version https://git-lfs.github.com/spec/v1\noid sha256:" + "a".repeat(64) + "\nsize 108\n",
      );
    },
  ],
  [
    "corrupted retained bytes",
    "INPUT_CHANGED",
    async ({ directory, wave }) => {
      wave.writeFloatLE(0.5, 44);
      await writeFile(join(directory, "clock.wav"), wave);
    },
  ],
  [
    "an unproved reduction",
    "PRESERVATION_UNVERIFIED",
    async ({ manifest }) => {
      manifest.cases[0].preservation.status = "unverified";
    },
  ],
  [
    "a physically different sample count",
    "SAMPLES_CHANGED",
    async ({ manifest }) => {
      manifest.cases[0].derivative.frames = 17;
    },
  ],
  [
    "padding that contains speech",
    "PADDING_CHANGED",
    async ({ directory, manifest, wave }) => {
      wave.writeFloatLE(0.25, 44 + 8 * 4);
      await writeFile(join(directory, "clock.wav"), wave);
      manifest.cases[0].derivative.sha256 = hash(wave);
      manifest.cases[0].source.range.endUs = 10000500;
      manifest.cases[0].clock.sourceFrames = 8;
      manifest.cases[0].clock.trailingSilenceFrames = 8;
    },
  ],
]) {
  test(`corpus certification refuses ${name}`, async (t) => {
    const fixture = await input(t);
    await alter(fixture);
    await writeFile(join(fixture.directory, "manifest.json"), JSON.stringify(fixture.manifest));
    await assert.rejects(
      run(process.execPath, [entry, "verify", "--fixtures", fixture.directory]),
      (error) => {
        assert.equal(JSON.parse(error.stdout).error.code, code);
        return true;
      },
    );
  });
}

// A byte hash alone must never admit undecoded video as physically certified.
test("video certification requires physical frame evidence", async (t) => {
  const { directory, manifest } = await input(t);
  manifest.cases[0].derivative.kind = "video";
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  const { verifyCorpus } = await import("./video-corpus.mjs");
  await assert.rejects(verifyCorpus(directory), {
    code: "VIDEO_PROBE_REQUIRED",
  });
});

async function pictureInput(t) {
  const fixture = await input(t);
  const c = fixture.manifest.cases[0];
  c.derivative = {
    ...c.derivative,
    kind: "video",
    width: 1920,
    height: 1080,
    frames: 3,
    color: {
      color_range: "tv",
      color_space: "bt709",
      color_transfer: "bt709",
      color_primaries: "bt709",
    },
  };
  c.source.range.endUs = 10125000;
  c.clock = {
    sourceAtZeroUs: 10000000,
    frameDurationUs: { numerator: 125000, denominator: 3 },
  };
  await writeFile(join(fixture.directory, "manifest.json"), JSON.stringify(fixture.manifest));
  const decoded = {
    streams: [
      {
        codec_type: "video",
        width: 1920,
        height: 1080,
        time_base: "1/12288",
        sample_aspect_ratio: "1:1",
        ...c.derivative.color,
      },
    ],
    frames: [0, 512, 1024].map((pts) => ({
      pts,
      duration: 512,
      width: 1920,
      height: 1080,
      sample_aspect_ratio: "1:1",
      ...c.derivative.color,
    })),
  };
  return { ...fixture, decoded };
}

test("physical video evidence refuses a changed frame pixel aspect", async (t) => {
  const { directory, decoded } = await pictureInput(t);
  decoded.frames[1].sample_aspect_ratio = "2:1";
  const { verifyCorpus } = await import("./video-corpus.mjs");
  await assert.rejects(
    verifyCorpus(directory, undefined, async () => decoded),
    {
      code: "VIDEO_CHANGED",
    },
  );
});

test("physical video evidence refuses a shifted frame clock despite matching bytes", async (t) => {
  const { directory, decoded } = await pictureInput(t);
  decoded.frames[1].pts += 1;
  const { verifyCorpus } = await import("./video-corpus.mjs");
  await assert.rejects(
    verifyCorpus(directory, undefined, async () => decoded),
    { code: "CLOCK_CHANGED" },
  );
});

test("physical video evidence refuses a cropped frame despite matching clocks", async (t) => {
  const { directory, decoded } = await pictureInput(t);
  decoded.frames[2].width = 960;
  const { verifyCorpus } = await import("./video-corpus.mjs");
  await assert.rejects(
    verifyCorpus(directory, undefined, async () => decoded),
    { code: "VIDEO_CHANGED" },
  );
});

test("physical video evidence refuses color interpretation changed within a clip", async (t) => {
  const { directory, decoded } = await pictureInput(t);
  decoded.frames[1].color_range = "pc";
  const { verifyCorpus } = await import("./video-corpus.mjs");
  await assert.rejects(
    verifyCorpus(directory, undefined, async () => decoded),
    { code: "VIDEO_CHANGED" },
  );
});

test("a complete physical video report certifies the retained exact frame clock", async (t) => {
  const { directory, decoded, wave } = await pictureInput(t);
  const { verifyCorpus } = await import("./video-corpus.mjs");
  assert.deepEqual(await verifyCorpus(directory, undefined, async () => decoded), {
    ok: true,
    bytes: wave.length,
    cases: [{ id: "clock-control", sha256: hash(wave), baseline: "unverified" }],
  });
});

test("selected video derivation executes the pinned recipe and keeps original bytes", async (t) => {
  const { directory } = await input(t);
  const ffmpeg = (await run("which", ["ffmpeg"])).stdout.trim();
  const ffprobe = (await run("which", ["ffprobe"])).stdout.trim();
  const sources = await mkdtemp(join(tmpdir(), "yap-picture-original-"));
  t.after(() => rm(sources, { recursive: true, force: true }));
  const source = join(sources, "original.mov");
  await run(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=red:s=32x24:r=24",
    "-vf",
    "setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
    "-frames:v",
    "3",
    "-c:v",
    "prores_ks",
    "-profile:v",
    "2",
    "-pix_fmt",
    "yuv422p10le",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-movflags",
    "+write_colr",
    source,
  ]);
  const original = await readFile(source);
  const recipe = {
    id: "red-picture",
    source: {
      file: "original.mov",
      sha256: hash(original),
      streamIndex: 0,
      range: { startUs: 0, endUs: 125000 },
    },
    derivative: {
      file: "red.mov",
      kind: "video",
      width: 32,
      height: 24,
      frames: 3,
      color: {
        color_range: "tv",
        color_space: "bt709",
        color_transfer: "bt709",
        color_primaries: "bt709",
      },
    },
    clock: {
      sourceAtZeroUs: 0,
      frameDurationUs: { numerator: 125000, denominator: 3 },
    },
    recipe: {
      arguments: [
        "-nostdin",
        "-v",
        "error",
        "-i",
        "SOURCE",
        "-map",
        "0:v:0",
        "-c:v",
        "copy",
        "OUTPUT",
      ],
    },
  };
  await writeFile(join(directory, "recipes.json"), JSON.stringify({ cases: [recipe] }));
  await rm(join(directory, "manifest.json"));
  const { deriveCorpus, verifyCorpus, videoProbe } = await import("./video-corpus.mjs");
  const native = async (operation) => {
    assert.equal(operation, "media.probe");
    return {
      ok: true,
      data: {
        originUs: 0,
        streams: [{ id: "track:1", kind: "video", startUs: 0, endUs: 125000 }],
      },
    };
  };
  await assert.rejects(
    deriveCorpus(directory, sources, "red-picture", native, {}, { ffmpeg, ffprobe }),
    { code: "TOOL_CHANGED" },
  );
  recipe.recipe.tool = { kind: "test-ffmpeg", sha256: hash(await readFile(ffmpeg)) };
  await writeFile(join(directory, "recipes.json"), JSON.stringify({ cases: [recipe] }));
  const result = await deriveCorpus(
    directory,
    sources,
    "red-picture",
    native,
    {},
    { ffmpeg, ffprobe },
  );
  assert.equal(result.cases[0].derivative.frames, 3);
  assert.equal(result.cases[0].preservation.status, "unverified");
  assert.deepEqual(await readFile(source), original);
  await assert.rejects(verifyCorpus(directory, undefined, videoProbe(ffprobe)), {
    code: "PRESERVATION_UNVERIFIED",
  });
  await rm(join(directory, "red.mov"));
  await rm(join(directory, "manifest.json"));
  const nativeExecutable = join(sources, "native-probe.mjs");
  await writeFile(
    nativeExecutable,
    "#!" +
      process.execPath +
      "\n" +
      'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify(' +
      JSON.stringify(await native("media.probe")) +
      ")));\n",
  );
  await chmod(nativeExecutable, 0o755);
  const { stdout } = await run(process.execPath, [
    entry,
    "derive",
    "--fixtures",
    directory,
    "--sources",
    sources,
    "--case",
    "red-picture",
    "--native",
    nativeExecutable,
    "--ffmpeg",
    ffmpeg,
    "--ffprobe",
    ffprobe,
  ]);
  const reply = JSON.parse(stdout);
  assert.equal(reply.ok, true);
  assert.equal(reply.cases[0].preservation.status, "unverified");
  const repeated = await run(process.execPath, [
    entry,
    "derive",
    "--fixtures",
    directory,
    "--sources",
    sources,
    "--case",
    "red-picture",
    "--native",
    nativeExecutable,
    "--ffmpeg",
    ffmpeg,
    "--ffprobe",
    ffprobe,
  ]);
  assert.deepEqual(JSON.parse(repeated.stdout), reply);
  for (const change of [
    (value) => value.recipe.arguments.push("-bitexact"),
    (value) => (value.derivative.file = "other.mov"),
    (value) => (value.derivative.width = 64),
    (value) => (value.clock.frameDurationUs.numerator += 1),
    (value) => (value.recipe.tool.sha256 = "0".repeat(64)),
  ]) {
    const changed = structuredClone(recipe);
    change(changed);
    await writeFile(join(directory, "recipes.json"), JSON.stringify({ cases: [changed] }));
    await assert.rejects(
      deriveCorpus(directory, sources, "red-picture", native, {}, { ffmpeg, ffprobe }),
      { code: "RECIPE_CHANGED" },
    );
    assert.deepEqual(
      await readFile(join(directory, "manifest.json")),
      Buffer.from(JSON.stringify({ cases: reply.cases }, null, 2) + "\n"),
    );
  }
  const rejected = await run(process.execPath, [
    entry,
    "verify",
    "--fixtures",
    directory,
    "--ffprobe",
    ffprobe,
  ]).then(
    () => assert.fail("pending visual proof must refuse certification"),
    (error) => JSON.parse(error.stdout),
  );
  assert.equal(rejected.error.code, "PRESERVATION_UNVERIFIED");
});
