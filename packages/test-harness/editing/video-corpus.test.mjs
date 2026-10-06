import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
        clock: { sourceAtZeroUs: 10000000, sourceFrames: 16, trailingSilenceFrames: 0 },
        preservation: { status: "pass", basis: "independent authored sample clock" },
        baseline: { state: "unverified", reason: "control has no historical ASR verdict" },
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
  manifest.cases[0].source.range.endUs = { numerator: 20002125, denominator: 2 };
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
