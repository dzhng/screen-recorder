// Records this process's own fixture window while moving and resizing it, then measures where
// known fixture landmarks and the system pointer actually landed in captured pixels. Nothing here
// derives a transform: predictions come from the native geometry owner through the probe, and this
// script only locates blobs and subtracts coordinates.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "dist/ScreenRecorder.app/Contents/MacOS/ScreenRecorder");
const worker = join(root, "dist/ScreenRecorder.app/Contents/MacOS/screenrec-native");

const flags = process.argv.slice(2);
const outputIndex = flags.indexOf("--out");
const output = resolve(
  outputIndex >= 0 ? flags[outputIndex + 1] : `/tmp/screenrec-cursor-evidence/run-${Date.now()}`,
);
mkdirSync(output, { recursive: true });

if (!existsSync(app) || !existsSync(worker)) {
  spawnSync("node", [join(root, "scripts/build-macos.mjs")], { stdio: "inherit" });
}
const preflight = spawnSync(app, ["--probe", "preflight"], { encoding: "utf8" });
const permissions = JSON.parse(preflight.stdout.trim().split("\n").pop());
if (!permissions.screen) {
  throw new Error(
    "Screen recording permission is not authorized for this build; grant it, then rerun. No capture was started.",
  );
}

const config = {
  capture: {
    source: { kind: "fixture" },
    outputDirectory: join(output, "source"),
    microphone: false,
    systemAudio: false,
  },
  durationSeconds: 24,
  windowFrame: { x: 120, y: 240, width: 820, height: 520 },
  // Each calibration waits, up to two seconds, for the pointer to stop; later steps are spaced so
  // that wait cannot swallow the pause it precedes.
  steps: [
    { atSeconds: 1.2, action: "calibrate", label: "placed" },
    {
      atSeconds: 4,
      action: "place",
      label: "moved",
      frame: { x: 300, y: 330, width: 820, height: 520 },
    },
    { atSeconds: 5.2, action: "calibrate", label: "moved" },
    {
      atSeconds: 8,
      action: "place",
      label: "resized",
      frame: { x: 300, y: 330, width: 1040, height: 660 },
    },
    { atSeconds: 9.2, action: "calibrate", label: "resized" },
    { atSeconds: 12, action: "placeOnOtherDisplay", label: "otherDisplay" },
    { atSeconds: 13.2, action: "calibrate", label: "otherDisplay" },
    { atSeconds: 16, action: "pause" },
    { atSeconds: 17.4, action: "resume" },
    { atSeconds: 18, action: "coverPointer", label: "underPointer" },
    { atSeconds: 19.2, action: "calibrate", label: "underPointer" },
  ],
};
const configPath = join(output, "probe.json");
writeFileSync(configPath, JSON.stringify(config, null, 2));
const probe = spawnSync(app, ["--probe", "cursor-geometry", configPath], {
  encoding: "utf8",
  timeout: 120_000,
});
process.stderr.write(probe.stderr ?? "");
if (probe.status !== 0) {
  throw new Error(`Cursor geometry probe failed: ${probe.stdout || probe.error}`);
}
const evidence = JSON.parse(readFileSync(join(output, "source/cursor-geometry.json"), "utf8"));

/** Raw interleaved RGB bytes of an image, so measurements never depend on a decoder library. */
function pixels(file) {
  const probeSize = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      file,
    ],
    { encoding: "utf8" },
  );
  const [width, height] = probeSize.stdout.trim().split(",").map(Number);
  const raw = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    {
      maxBuffer: 512 * 1024 * 1024,
    },
  );
  if (raw.status !== 0 || raw.stdout.length !== width * height * 3) {
    throw new Error(`Cannot read pixels of ${file}: ${raw.stderr}`);
  }
  return { width, height, data: raw.stdout };
}

/** Connected components of a boolean mask, with centroid, bounding box and fill ratio. */
function blobs(mask, width, height, minimumPixels) {
  const seen = new Uint8Array(width * height);
  const found = [];
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || !mask[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    while (stack.length > 0) {
      const index = stack.pop();
      const x = index % width;
      const y = (index - x) / width;
      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (seen[next] || !mask[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (count < minimumPixels) continue;
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    found.push({
      count,
      x: sumX / count + 0.5,
      y: sumY / count + 0.5,
      minX,
      minY,
      boxWidth,
      boxHeight,
      fill: count / (boxWidth * boxHeight),
    });
  }
  return found;
}

/** Solid neutral-black squares: the fixture's fiducials, not its labels or window buttons. */
function fiducials(image) {
  const mask = new Uint8Array(image.width * image.height);
  for (let index = 0; index < mask.length; index++) {
    const red = image.data[index * 3];
    const green = image.data[index * 3 + 1];
    const blue = image.data[index * 3 + 2];
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    mask[index] = red < 70 && green < 70 && blue < 70 && spread < 24 ? 1 : 0;
  }
  return blobs(mask, image.width, image.height, 120)
    .filter(
      (blob) =>
        blob.fill > 0.88 &&
        blob.boxWidth / blob.boxHeight > 0.7 &&
        blob.boxWidth / blob.boxHeight < 1.4,
    )
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

function decodeFrame(sourceFile, atSourceUs, durationUs, file) {
  const request = {
    id: "frame",
    operation: "media.frame",
    params: {
      source: sourceFile,
      output: file,
      atSourceUs,
      kept: { startUs: 0, endUs: durationUs },
      maxLongEdge: 8192,
    },
  };
  const run = spawnSync(worker, [], {
    input: `${JSON.stringify(request)}\n`,
    encoding: "utf8",
    timeout: 60_000,
  });
  const reply = JSON.parse(run.stdout.trim().split("\n").pop());
  if (!reply.ok) throw new Error(`Frame decode failed: ${JSON.stringify(reply.error)}`);
  return reply.data;
}

const durationUs = evidence.capture.durationUs;
const sourceDirectory = join(output, "source");

/** Sorted the same way on both sides, so a measurement is matched without consulting a prediction. */
function inReadingOrder(points) {
  return [...points].sort((left, right) => left.y - right.y || left.x - right.x);
}

function compare(measured, predicted) {
  const errors = predicted.map((point, order) =>
    measured[order] ? Math.hypot(measured[order].x - point.x, measured[order].y - point.y) : null,
  );
  return {
    measured: measured.map((blob) => ({ x: blob.x, y: blob.y, side: blob.boxWidth })),
    predicted,
    errorsPx: errors,
    maxErrorPx:
      measured.length === predicted.length && errors.every((error) => error !== null)
        ? Math.max(...errors)
        : null,
  };
}

const placements = evidence.placements.map((placement, index) => {
  const epochs = evidence.epochs.filter(
    (epoch) => epoch.placementIndex === index && epoch.sourceUs != null,
  );
  if (epochs.length === 0) {
    return { label: placement.label, index, skipped: "no placed geometry epoch" };
  }
  // The last epoch before the next move is the window's settled position for this placement.
  const settled = epochs[epochs.length - 1];
  const until = evidence.placements[index + 1]?.movedAtSourceUs ?? durationUs;
  const atSourceUs = Math.round(
    Math.max(settled.sourceUs, Math.min(settled.sourceUs + 200_000, until - 120_000)),
  );
  const file = join(output, `frame-${index}-${placement.label}.png`);
  const decoded = decodeFrame(join(sourceDirectory, "video.mov"), atSourceUs, durationUs, file);
  return {
    label: placement.label,
    index,
    windowFrameAppKit: placement.windowFrameAppKit,
    epoch: settled.epoch,
    geometry: settled.geometry,
    frame: { file, ...decoded },
    ...compare(fiducials(pixels(file)), inReadingOrder(settled.predictedFiducials.filter(Boolean))),
  };
});

const calibrations = evidence.calibrations.map((calibration, index) => {
  const clean = pixels(join(sourceDirectory, calibration.withoutPointerFile));
  const drawn = pixels(join(sourceDirectory, calibration.withPointerFile));
  const mask = new Uint8Array(clean.width * clean.height);
  let changed = 0;
  for (let pixel = 0; pixel < mask.length; pixel++) {
    let difference = 0;
    for (let channel = 0; channel < 3; channel++) {
      difference = Math.max(
        difference,
        Math.abs(clean.data[pixel * 3 + channel] - drawn.data[pixel * 3 + channel]),
      );
    }
    mask[pixel] = difference > 30 ? 1 : 0;
    changed += mask[pixel];
  }
  const pointer = blobs(mask, clean.width, clean.height, 30).sort(
    (left, right) => right.count - left.count,
  )[0];
  // Where the pointer image starts drawing relative to its hot spot, so the comparison does not
  // assume the drawn shape begins exactly on the reading.
  let drawnOffset = null;
  if (calibration.cursorImageFile && calibration.cursorImagePixels && calibration.cursorImageSize) {
    const cursorFile = join(sourceDirectory, calibration.cursorImageFile);
    const image = pixels(cursorFile);
    const rgba = spawnSync(
      "ffmpeg",
      ["-v", "error", "-i", cursorFile, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
      { maxBuffer: 64 * 1024 * 1024 },
    ).stdout;
    let minX = image.width;
    let minY = image.height;
    for (let pixel = 0; pixel < image.width * image.height; pixel++) {
      if (rgba[pixel * 4 + 3] <= 40) continue;
      minX = Math.min(minX, pixel % image.width);
      minY = Math.min(minY, Math.floor(pixel / image.width));
    }
    const perPoint = calibration.cursorImagePixels.width / calibration.cursorImageSize.width;
    drawnOffset = { x: minX / perPoint, y: minY / perPoint };
  }
  const scale = calibration.geometry
    ? calibration.geometry.scaleFactor * calibration.geometry.contentScale
    : null;
  const expected =
    calibration.predictedPointer && drawnOffset && scale
      ? {
          x: calibration.predictedPointer.x - (calibration.cursorHotSpot.x - drawnOffset.x) * scale,
          y: calibration.predictedPointer.y - (calibration.cursorHotSpot.y - drawnOffset.y) * scale,
        }
      : null;
  const measuredOrigin = pointer ? { x: pointer.minX, y: pointer.minY } : null;
  // The take itself must stay pointer-free. Where a pointer was demonstrably drawn in the paired
  // image, the recorded video at that same source time is compared against the same clean image:
  // a burned-in pointer would light up the identical box.
  let recordedPointerBox = null;
  if (measuredOrigin && calibration.sourceUs != null) {
    const file = join(output, `recorded-${index}-${calibration.label}.png`);
    const decoded = decodeFrame(
      join(sourceDirectory, "video.mov"),
      calibration.sourceUs,
      durationUs,
      file,
    );
    const recorded = pixels(file);
    const box = { x: measuredOrigin.x - 20, y: measuredOrigin.y - 20, width: 80, height: 80 };
    // A control box the pointer never occupied gives the compression noise floor to compare against.
    const control = {
      ...box,
      x: box.x + 200 + box.width < clean.width ? box.x + 200 : Math.max(0, box.x - 200),
    };
    const strongDifferences = (left, right, area) => {
      let count = 0;
      for (let y = Math.max(0, area.y); y < Math.min(left.height, area.y + area.height); y++) {
        for (let x = Math.max(0, area.x); x < Math.min(left.width, area.x + area.width); x++) {
          let difference = 0;
          for (let channel = 0; channel < 3; channel++) {
            difference = Math.max(
              difference,
              Math.abs(
                left.data[(y * left.width + x) * 3 + channel] -
                  right.data[(y * right.width + x) * 3 + channel],
              ),
            );
          }
          if (difference > 60) count += 1;
        }
      }
      return count;
    };
    recordedPointerBox =
      recorded.width === clean.width && recorded.height === clean.height
        ? {
            file,
            actualSourceUs: decoded.actualSourceUs,
            box,
            recordedPixelsDiffering: strongDifferences(recorded, clean, box),
            recordedControlPixelsDiffering: strongDifferences(recorded, clean, control),
            drawnPixelsDiffering: strongDifferences(drawn, clean, box),
          }
        : { file, actualSourceUs: decoded.actualSourceUs, box, mismatchedDimensions: true };
  }
  return {
    label: calibration.label,
    geometryEpoch: calibration.geometryEpoch,
    pointerGlobal: calibration.pointerGlobal,
    predictedPointer: calibration.predictedPointer,
    predictedEligibility: calibration.predictedEligibility,
    pointerDriftPoints: evidence.samples.calibrationDriftPoints?.[index] ?? null,
    pointerStillForMs: calibration.stillForMs ?? null,
    // A pointer that moved while the pair of images was taken cannot be compared to one reading,
    // and a prediction of "outside" is confirmed by the capture drawing no pointer at all.
    comparable:
      (evidence.samples.calibrationDriftPoints?.[index] ?? null) !== null &&
      evidence.samples.calibrationDriftPoints[index] <= 2,
    nearestSampleDistanceUs: evidence.samples.calibrationDistanceUs?.[index] ?? null,
    nearestSample: evidence.samples.atCalibrations?.[index] ?? null,
    changedPixels: changed,
    measuredPointerOrigin: measuredOrigin,
    expectedPointerOrigin: expected,
    pointerErrorPx:
      measuredOrigin && expected
        ? Math.hypot(measuredOrigin.x - expected.x, measuredOrigin.y - expected.y)
        : null,
    recordedPointerBox,
    fiducials: compare(
      fiducials(clean),
      inReadingOrder((calibration.predictedFiducials ?? []).filter(Boolean)),
    ),
    images: [calibration.withoutPointerFile, calibration.withPointerFile],
  };
});

// A numbered overlay of what was measured, for human review of placement rather than styling.
// Drawing happens on the raw pixels: this ffmpeg build has no text filter, and an overlay nobody
// wrote is worse than none.
const DIGITS = {
  0: ["11111", "10001", "10001", "10001", "10001", "10001", "11111"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["11111", "00001", "00001", "11111", "10000", "10000", "11111"],
  3: ["11111", "00001", "00001", "11111", "00001", "00001", "11111"],
  4: ["10001", "10001", "10001", "11111", "00001", "00001", "00001"],
  5: ["11111", "10000", "10000", "11111", "00001", "00001", "11111"],
  6: ["11111", "10000", "10000", "11111", "10001", "10001", "11111"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["11111", "10001", "10001", "11111", "10001", "10001", "11111"],
  9: ["11111", "10001", "10001", "11111", "00001", "00001", "11111"],
};

function paint(image, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
  const offset = (py * image.width + px) * 3;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
}

function outline(image, x, y, size, color, thickness = 2) {
  for (let step = 0; step < size; step++) {
    for (let edge = 0; edge < thickness; edge++) {
      paint(image, x + step, y + edge, color);
      paint(image, x + step, y + size - 1 - edge, color);
      paint(image, x + edge, y + step, color);
      paint(image, x + size - 1 - edge, y + step, color);
    }
  }
}

function number(image, value, x, y, color, scale = 4) {
  let cursor = x;
  for (const character of String(value)) {
    const glyph = DIGITS[character];
    if (!glyph) continue;
    for (let row = 0; row < glyph.length; row++) {
      for (let column = 0; column < glyph[row].length; column++) {
        if (glyph[row][column] !== "1") continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            paint(image, cursor + column * scale + dx, y + row * scale + dy, color);
          }
        }
      }
    }
    cursor += 6 * scale;
  }
}

function writeImage(image, file) {
  const encode = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-s",
      `${image.width}x${image.height}`,
      "-i",
      "-",
      file,
    ],
    { input: image.data, maxBuffer: 512 * 1024 * 1024 },
  );
  if (encode.status !== 0) throw new Error(`Cannot write overlay ${file}: ${encode.stderr}`);
}

const cyan = [0, 220, 255];
const magenta = [255, 0, 200];
const yellow = [255, 210, 0];

for (const placement of placements) {
  if (!placement.frame) continue;
  const image = pixels(placement.frame.file);
  placement.predicted.forEach((point) => outline(image, point.x - 9, point.y - 9, 18, magenta));
  placement.measured.forEach((point, order) => {
    outline(image, point.x - 18, point.y - 18, 36, cyan);
    // Keep the label inside the frame: a target near the right edge is numbered on its left.
    const label = point.x + 60 < image.width ? point.x + 24 : point.x - 50;
    number(image, order + 1, label, point.y - 14, cyan);
  });
  const overlay = placement.frame.file.replace("frame-", "overlay-");
  writeImage(image, overlay);
  placement.overlay = overlay;
}

// The pointer overlay shows the one thing a recorded take never contains: where the system drew
// the pointer, against where the sampled reading said it would land.
for (const [index, calibration] of calibrations.entries()) {
  if (!calibration.measuredPointerOrigin || !calibration.expectedPointerOrigin) continue;
  const image = pixels(join(sourceDirectory, calibration.images[1]));
  outline(
    image,
    calibration.expectedPointerOrigin.x - 20,
    calibration.expectedPointerOrigin.y - 20,
    40,
    magenta,
  );
  outline(
    image,
    calibration.measuredPointerOrigin.x - 12,
    calibration.measuredPointerOrigin.y - 12,
    24,
    yellow,
  );
  number(
    image,
    index + 1,
    calibration.measuredPointerOrigin.x + 28,
    calibration.measuredPointerOrigin.y - 16,
    yellow,
  );
  const overlay = join(output, `pointer-${index}-${calibration.label}.png`);
  writeImage(image, overlay);
  calibration.overlay = overlay;
}

const report = {
  command: "bun run lab:cursor-geometry",
  generatedAt: new Date().toISOString(),
  output,
  displays: evidence.displays,
  outputPixels: { width: evidence.outputWidth, height: evidence.outputHeight },
  capture: {
    state: evidence.capture.state,
    durationUs: evidence.capture.durationUs,
    pauses: evidence.capture.pauses,
    cursor: evidence.capture.cursor,
    failure: evidence.capture.failure,
  },
  cursorSamples: evidence.samples,
  expectedSamplesAtCadence: Math.round((evidence.capture.durationUs / 1_000_000) * 60),
  geometryEpochs: evidence.epochs.length,
  placements,
  calibrations,
  maxFiducialErrorPx: Math.max(
    ...placements.map((placement) => placement.maxErrorPx ?? Number.NEGATIVE_INFINITY),
    ...calibrations.map(
      (calibration) => calibration.fiducials.maxErrorPx ?? Number.NEGATIVE_INFINITY,
    ),
  ),
  maxPointerErrorPx: Math.max(
    ...calibrations
      .filter((calibration) => calibration.comparable)
      .map((calibration) => calibration.pointerErrorPx ?? Number.NEGATIVE_INFINITY),
  ),
  pointerOutsideAgreements: calibrations
    .filter((calibration) => calibration.predictedEligibility === "outside")
    .map((calibration) => ({ label: calibration.label, drawnPixels: calibration.changedPixels })),
};
// The slice's own bound: a recorded cursor lands within three output pixels of where it was.
// Reading that off a report and nodding is not a gate, so this run is one.
const toleratedErrorPx = 3;
report.toleratedErrorPx = toleratedErrorPx;
report.withinTolerance =
  Number.isFinite(report.maxFiducialErrorPx) &&
  report.maxFiducialErrorPx <= toleratedErrorPx &&
  (!Number.isFinite(report.maxPointerErrorPx) || report.maxPointerErrorPx <= toleratedErrorPx);
writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.error(`\nEvidence written to ${output}`);
if (!report.withinTolerance) {
  console.error(
    `Placement is outside the ${toleratedErrorPx} pixel bound: fiducials ` +
      `${report.maxFiducialErrorPx}, pointer ${report.maxPointerErrorPx}`,
  );
  process.exit(1);
}
