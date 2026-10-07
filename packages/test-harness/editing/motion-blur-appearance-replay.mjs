import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const expected = {
  sourceSha256: "d0b26f1c3d9cb975566b9a454338c9132255543350874039230636e3213c9c1c",
  nativeSha256: "dc6b18c2dad93e98de5b6dbfa6d3996a0d56d577a743eb54a52d31ed3af921da",
  recipe: { samples: 4, shutter: 0.5, frameUs: 500001, width: 64, height: 48 },
  files: {
    base: ["base.png", "e34b908f2df078fab928c4f330d32c2358016cbd356d9690d5e95d184c79adef"],
    blurred: [
      "blurred-repaired.png",
      "eec85ea10fcb897303b619318e3b2ae2be3f55f4a8334e61ea00e77ae3f55ee8",
    ],
    control: [
      "control-repaired.png",
      "96e82ca4e6104a5af7ad66030f227308b57df434193a119fb49bf08730c2c482",
    ],
  },
  check: {
    frame: 500001,
    trajectoryChangedPixels: 329,
    blurChangedPixels: 232,
    totalPixels: 3072,
    meanRgbDelta: 1.5149739583333333,
    maxRgbDelta: 97,
    transparentPixels: 0,
    baseBounds: { minX: 21, maxX: 39, minY: 9, maxY: 29 },
    controlBounds: { minX: 18, maxX: 42, minY: 5, maxY: 31 },
    blurredBounds: { minX: 17, maxX: 43, minY: 5, maxY: 31 },
  },
};

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pngDimensions = (bytes) => {
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature changed");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

/** Replay the retained appearance receipt without rerunning native rendering. */
export async function replayMotionBlurAppearance(reportPath) {
  const absolute = resolve(reportPath);
  const report = JSON.parse(await readFile(absolute));
  assert.equal(report.passed, true, "motion-blur appearance receipt did not pass");
  assert.equal(report.sourceSha256, expected.sourceSha256, "source fixture changed");
  assert.equal(report.nativeSha256, expected.nativeSha256, "native worker changed");
  assert.deepEqual(
    {
      samples: report.recipe?.samples,
      shutter: report.recipe?.shutter,
      frameUs: report.recipe?.frameUs,
      width: report.recipe?.canvas?.width,
      height: report.recipe?.canvas?.height,
    },
    expected.recipe,
    "blur recipe changed",
  );
  assert.deepEqual(report.checks, [expected.check], "blur appearance measurements changed");
  const directory = dirname(absolute);
  for (const [name, [file, expectedHash]] of Object.entries(expected.files)) {
    const path = join(directory, file);
    await access(path);
    const bytes = await readFile(path);
    assert.equal(hash(bytes), expectedHash, `${name} artifact changed`);
    assert.deepEqual(pngDimensions(bytes), { width: 64, height: 48 }, `${name} dimensions changed`);
  }
  const check = report.checks[0];
  const maxEdgeExpansion = Math.max(
    check.controlBounds.minX - check.blurredBounds.minX,
    check.blurredBounds.maxX - check.controlBounds.maxX,
    check.controlBounds.minY - check.blurredBounds.minY,
    check.blurredBounds.maxY - check.controlBounds.maxY,
  );
  assert.equal(maxEdgeExpansion, 1, "blur footprint envelope changed");
  return {
    status: "passed",
    samples: report.recipe.samples,
    transparentPixels: check.transparentPixels,
    maxEdgeExpansion,
    blurChangedPixels: check.blurChangedPixels,
    artifacts: Object.fromEntries(Object.entries(expected.files).map(([name, [file]]) => [name, file])),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Usage: node motion-blur-appearance-replay.mjs <appearance-repair-report.json>");
  console.log(JSON.stringify(await replayMotionBlurAppearance(process.argv[2])));
}
