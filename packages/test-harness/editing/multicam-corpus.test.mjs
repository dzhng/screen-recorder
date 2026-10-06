import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../../../", import.meta.url).pathname;
const fixtures = join(root, "fixtures/video-editing-feedback/synchronization");

test("retained multicam corpus certifies complete physical windows without promoting a clock", async () => {
  const { verifyMulticamCorpus } = await import("./multicam-corpus.mjs");
  const report = await verifyMulticamCorpus(fixtures);
  assert.equal(report.ok, true);
  assert.deepEqual(report.coverage, {
    sources: ["grahamRaw", "lilyRawP1", "madisonRaw"],
    windowsPerSource: 3,
    totalWindows: 9,
    durationUs: 20_000_000,
    sampleRate: 16_000,
    channels: 1,
    framesPerWindow: 320_000,
  });
  assert.equal(report.synchronization, "not-established");
  assert.equal(report.sourceIdentity, "manifest-bound");
});

test("multicam certification binds decoded picture samples for every retained source", async () => {
  const { verifyMulticamCorpus } = await import("./multicam-corpus.mjs");
  const report = await verifyMulticamCorpus(fixtures);
  assert.deepEqual(report.picture, {
    sources: ["grahamRaw", "lilyRawP1", "madisonRaw"],
    samplesPerSource: 3,
    totalSamples: 9,
    width: 320,
    height: 180,
    pixelFormat: "rgb24",
  });
});

test("multicam certification refuses a changed retained window before reporting coverage", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-corpus-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourceManifest = await readFile(join(fixtures, "manifest.json"), "utf8");
  await writeFile(join(directory, "manifest.json"), sourceManifest);
  await writeFile(join(directory, "manifest.identity.json"), await readFile(join(fixtures, "manifest.identity.json")));
  await writeFile(join(directory, "picture-manifest.json"), await readFile(join(fixtures, "picture-manifest.json")));
  await writeFile(
    join(directory, "picture-manifest.identity.json"),
    await readFile(join(fixtures, "picture-manifest.identity.json")),
  );
  for (const name of ["grahamRaw-0.wav", "grahamRaw-240.wav", "grahamRaw-1200.wav", "madisonRaw-0.wav", "madisonRaw-240.wav", "madisonRaw-1200.wav", "lilyRawP1-0.wav", "lilyRawP1-240.wav", "lilyRawP1-1200.wav"])
    await writeFile(join(directory, name), await readFile(join(fixtures, name)));
  const changed = Buffer.from(await readFile(join(directory, "grahamRaw-0.wav")));
  changed[changed.length - 1] ^= 1;
  await writeFile(join(directory, "grahamRaw-0.wav"), changed);
  const { verifyMulticamCorpus } = await import("./multicam-corpus.mjs");
  await assert.rejects(verifyMulticamCorpus(directory), { code: "INPUT_CHANGED" });
});

test("multicam certification refuses a changed decoded picture derivative", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-picture-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "manifest.json"), await readFile(join(fixtures, "manifest.json")));
  await writeFile(
    join(directory, "manifest.identity.json"),
    await readFile(join(fixtures, "manifest.identity.json")),
  );
  await writeFile(
    join(directory, "picture-manifest.json"),
    await readFile(join(fixtures, "picture-manifest.json")),
  );
  await writeFile(
    join(directory, "picture-manifest.identity.json"),
    await readFile(join(fixtures, "picture-manifest.identity.json")),
  );
  for (const name of [
    "grahamRaw-0.wav",
    "grahamRaw-240.wav",
    "grahamRaw-1200.wav",
    "madisonRaw-0.wav",
    "madisonRaw-240.wav",
    "madisonRaw-1200.wav",
    "lilyRawP1-0.wav",
    "lilyRawP1-240.wav",
    "lilyRawP1-1200.wav",
  ])
    await writeFile(join(directory, name), await readFile(join(fixtures, name)));
  await mkdir(join(directory, "pictures"));
  for (const name of ["grahamRaw", "lilyRawP1", "madisonRaw"])
    await writeFile(
      join(directory, "pictures", `${name}.mp4`),
      await readFile(join(fixtures, "pictures", `${name}.mp4`)),
    );
  const changed = Buffer.from(await readFile(join(directory, "pictures", "grahamRaw.mp4")));
  changed[changed.length - 1] ^= 1;
  await writeFile(join(directory, "pictures", "grahamRaw.mp4"), changed);
  const { verifyMulticamCorpus } = await import("./multicam-corpus.mjs");
  await assert.rejects(verifyMulticamCorpus(directory), { code: "PICTURE_CHANGED" });
});

test("multicam certification refuses a forged decoded picture identity", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-picture-hash-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(join(fixtures, "picture-manifest.json")));
  manifest.sources.grahamRaw.samples[0].sha256 = "f".repeat(64);
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(directory, "manifest.json"), await readFile(join(fixtures, "manifest.json")));
  await writeFile(join(directory, "picture-manifest.json"), manifestBytes);
  await writeFile(
    join(directory, "manifest.identity.json"),
    await readFile(join(fixtures, "manifest.identity.json")),
  );
  await writeFile(
    join(directory, "picture-manifest.identity.json"),
    JSON.stringify({ manifestSha256: createHash("sha256").update(manifestBytes).digest("hex") }),
  );
  for (const name of [
    "grahamRaw-0.wav",
    "grahamRaw-240.wav",
    "grahamRaw-1200.wav",
    "madisonRaw-0.wav",
    "madisonRaw-240.wav",
    "madisonRaw-1200.wav",
    "lilyRawP1-0.wav",
    "lilyRawP1-240.wav",
    "lilyRawP1-1200.wav",
  ])
    await writeFile(join(directory, name), await readFile(join(fixtures, name)));
  await mkdir(join(directory, "pictures"));
  for (const name of ["grahamRaw", "lilyRawP1", "madisonRaw"])
    await writeFile(
      join(directory, "pictures", `${name}.mp4`),
      await readFile(join(fixtures, "pictures", `${name}.mp4`)),
    );
  const { verifyMulticamCorpus } = await import("./multicam-corpus.mjs");
  await assert.rejects(verifyMulticamCorpus(directory), { code: "PICTURE_CHANGED" });
});

test("multicam certification refuses a changed frozen manifest identity", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-manifest-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(join(fixtures, "manifest.json"), "utf8"));
  manifest.cases[0].range.endUs += 1;
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(directory, "manifest.identity.json"), await readFile(join(fixtures, "manifest.identity.json")));
  const { verifyMulticamCorpus } = await import("./multicam-corpus.mjs");
  await assert.rejects(verifyMulticamCorpus(directory), { code: "MANIFEST_CHANGED" });
});

test("multicam certification refuses missing windows and duplicate source assignments", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-shape-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "manifest.json"), await readFile(join(fixtures, "manifest.json")));
  await writeFile(join(directory, "manifest.identity.json"), await readFile(join(fixtures, "manifest.identity.json")));
  await writeFile(join(directory, "picture-manifest.json"), await readFile(join(fixtures, "picture-manifest.json")));
  await writeFile(
    join(directory, "picture-manifest.identity.json"),
    await readFile(join(fixtures, "picture-manifest.identity.json")),
  );
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  manifest.cases.pop();
  const bytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(join(directory, "manifest.json"), bytes);
  await writeFile(
    join(directory, "manifest.identity.json"),
    JSON.stringify({ manifestSha256: createHash("sha256").update(bytes).digest("hex") }),
  );
  const { verifyMulticamCorpus } = await import("./multicam-corpus.mjs");
  await assert.rejects(verifyMulticamCorpus(directory), { code: "CASE_COVERAGE" });
});
