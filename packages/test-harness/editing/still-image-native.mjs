import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { mediaWorker, nativeResult } from "../../../apps/service/dist/worker.js";
import { root, run, hash } from "./source-evidence-fixture.mjs";

const { values } = parseArgs({
  options: { out: { type: "string" }, baseline: { type: "string" } },
});
assert.ok(process.env.SCREENREC_NATIVE, "A frozen image worker is required");
const out = values.out
  ? resolve(values.out)
  : await mkdtemp(join(tmpdir(), "still-native-evidence-"));
await mkdir(out, { recursive: true });
const home = await mkdtemp(join(tmpdir(), "still-native-"));
const worker = mediaWorker();
const report = { passed: false, pictures: [], refusals: [], videoPreservation: [] };
const image = (path, output, options = {}) => ({
  asset: { assetId: hash(Buffer.from(path)), streamId: "image:0", path },
  output,
  ...options,
});
async function refused(params, code) {
  const result = await worker("media.sourceImage", params);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code, JSON.stringify(result));
  await assert.rejects(stat(params.output), { code: "ENOENT" });
  report.refusals.push({ name: params.output.split("/").at(-1), error: result.error });
}
try {
  const generator = join(home, "fixture"),
    pixels = join(home, "pixels");
  await run("swiftc", [
    "-parse-as-library",
    join(root, "packages/test-harness/editing/StillImageFixture.swift"),
    "-o",
    generator,
  ]);
  await run("swiftc", [
    "-parse-as-library",
    join(root, "packages/test-harness/editing/FrameImagePixels.swift"),
    "-o",
    pixels,
  ]);
  const sources = join(out, "sources");
  const fixtures = JSON.parse((await run(generator, [sources])).stdout);
  for (const fixture of fixtures) {
    const probe = nativeResult(await worker("media.probe", { path: fixture.path }));
    assert.equal(probe.streams.length, 1);
    const stream = probe.streams[0];
    assert.equal(stream.kind, "image");
    assert.equal(stream.orientation, fixture.orientation);
    assert.deepEqual(
      [stream.width, stream.height, stream.orientedWidth, stream.orientedHeight],
      [fixture.width, fixture.height, fixture.orientedWidth, fixture.orientedHeight],
    );
    assert.equal(stream.hasAlpha, fixture.kind === "png");
    const before = hash(await readFile(fixture.path));
    const output = join(out, `${fixture.kind}-${fixture.orientation}.png`);
    const receipt = nativeResult(await worker("media.sourceImage", image(fixture.path, output)));
    assert.equal(receipt.kind, "image");
    assert.deepEqual(
      [receipt.width, receipt.height, receipt.sourceWidth, receipt.sourceHeight],
      [
        fixture.orientedWidth,
        fixture.orientedHeight,
        fixture.orientedWidth,
        fixture.orientedHeight,
      ],
    );
    assert.equal(receipt.orientation, fixture.orientation);
    assert.equal(receipt.hasAlpha, fixture.kind === "png");
    for (const field of ["sample", "requestedSourceUs", "actualSourceUs", "atUs", "originUs"])
      assert.equal(Object.hasOwn(receipt, field), false, `Still image invented ${field}`);
    const decoded = output + ".rgba";
    const normalization = JSON.parse((await run(pixels, [output, decoded])).stdout);
    const actual = await readFile(decoded),
      expected = await readFile(fixture.path + ".reference.rgba");
    assert.equal(actual.length, expected.length);
    let maximumError = 0;
    for (let at = 0; at < actual.length; at++) {
      const error = Math.abs(actual[at] - expected[at]);
      maximumError = Math.max(maximumError, error);
      assert.ok(
        error <= 2,
        `${fixture.kind}/${fixture.orientation} byte ${at}: ${actual[at]} != ${expected[at]}`,
      );
    }
    assert.equal(hash(await readFile(fixture.path)), before);
    report.pictures.push({
      ...fixture,
      output,
      receipt,
      normalization,
      maximumError,
      sourceSha256: before,
      sha256: hash(await readFile(output)),
    });
  }
  const source = fixtures[5].path;
  const bounded = nativeResult(
    await worker("media.sourceImage", image(source, join(out, "bounded.png"), { maxLongEdge: 17 })),
  );
  assert.deepEqual([bounded.width, bounded.height], [11, 17]);
  report.bounded = bounded;
  await refused(
    image(source, join(home, "decoded-limit.png"), { maxDecodedPixels: 1 }),
    "LIMIT_EXCEEDED",
  );
  await refused(
    image(source, join(home, "encoded-limit.png"), { maxEncodedBytes: 1 }),
    "LIMIT_EXCEEDED",
  );
  await refused({ ...image(source, join(home, "invented-clock.png")), atUs: 0 }, "INVALID_REQUEST");
  await refused(
    {
      ...image(source, join(home, "wrong-stream.png")),
      asset: { assetId: "image", streamId: "image:1", path: source },
    },
    "INVALID_REQUEST",
  );
  const malformed = join(home, "malformed.png");
  await writeFile(malformed, (await readFile(fixtures[0].path)).subarray(0, 40));
  await refused(image(malformed, join(home, "malformed-output.png")), "UNSUPPORTED_MEDIA");
  const truncated = join(home, "truncated.jpeg"),
    jpeg = await readFile(fixtures[8].path);
  await writeFile(truncated, jpeg.subarray(0, Math.floor(jpeg.length / 2)));
  await refused(image(truncated, join(home, "truncated-output.png")), "UNSUPPORTED_MEDIA");
  for (const format of ["apng", "gif"]) {
    const animation = join(home, `animation.${format}`);
    await run("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=8x8:rate=2:duration=1",
      "-f",
      format,
      animation,
    ]);
    await refused(image(animation, join(home, `${format}-output.png`)), "UNSUPPORTED_MEDIA");
  }
  if (values.baseline) {
    const baseline = mediaWorker({ ...process.env, SCREENREC_NATIVE: values.baseline });
    for (const name of ["a.mov", "orientation.mov"]) {
      const path = join(root, "specs/agent-editing/assets/00-corpus", name);
      const probe = nativeResult(await worker("media.probe", { path }));
      const stream = probe.streams.find((value) => value.kind === "video");
      for (const edge of [33, 1600]) {
        const params = {
          asset: { assetId: name, streamId: stream.id, path, originUs: probe.originUs },
          available: [{ startUs: stream.startUs, endUs: stream.endUs }],
          atUs: stream.startUs,
          maxLongEdge: edge,
        };
        const original = nativeResult(
          await baseline("media.sourceFrame", {
            ...params,
            output: join(home, `baseline-${name}-${edge}.png`),
          }),
        );
        const next = nativeResult(
          await worker("media.sourceFrame", {
            ...params,
            output: join(out, `video-${name}-${edge}.png`),
          }),
        );
        assert.ok(
          (await readFile(original.file)).equals(await readFile(next.file)),
          "Existing video pixels changed",
        );
        report.videoPreservation.push({
          name,
          edge,
          sha256: hash(await readFile(next.file)),
          receipt: next,
        });
      }
    }
  }
  report.worker = {
    path: process.env.SCREENREC_NATIVE,
    sha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  };
  report.passed = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await rm(home, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: report.passed, out, error: report.error?.message }));
