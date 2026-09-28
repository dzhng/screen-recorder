import assert from "node:assert/strict";

const clear = [0, 0, 0, 0];
const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

// Independent point-sampling oracle in top-left coordinates. It never consumes compiled
// transforms or native receipts. Pixel-edge interpolation is verified separately from interiors.
export function sourceSurface({ width, height, rgba }) {
  return {
    width,
    height,
    sample(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return clear;
      const at = (Math.floor(y) * width + Math.floor(x)) * 4,
        alpha = rgba[at + 3] / 255;
      return [0, 1, 2]
        .map((c) => srgbToLinear(alpha ? rgba[at + c] / (255 * alpha) : 0) * alpha)
        .concat(alpha);
    },
  };
}
export function background(canvas, rgba = [0, 0, 0, 1]) {
  return {
    ...canvas,
    sample: (x, y) => (x >= 0 && y >= 0 && x < canvas.width && y < canvas.height ? rgba : clear),
  };
}
export function over(below, above) {
  assert.deepEqual([below.width, below.height], [above.width, above.height]);
  return {
    width: below.width,
    height: below.height,
    sample(x, y) {
      const a = above.sample(x, y),
        b = below.sample(x, y);
      return a.map((value, channel) => value + b[channel] * (1 - a[3]));
    },
  };
}
export function opacitySurface(surface, opacity) {
  return { ...surface, sample: (x, y) => surface.sample(x, y).map((v) => v * opacity) };
}
export function geometrySurface(surface, settings, canvas) {
  const crop = settings.crop ?? { x: 0, y: 0, width: surface.width, height: surface.height };
  const rect = settings.rect ?? { x: 0, y: 0, ...canvas };
  const fit = settings.fit ?? "contain",
    scale = settings.scale ?? { x: 1, y: 1 };
  const pivot = settings.pivot ?? { x: 0.5, y: 0.5 };
  const turn = ((settings.rotationDeg ?? 0) * Math.PI) / 180;
  const fitX = rect.width / crop.width,
    fitY = rect.height / crop.height;
  const factor = fit === "cover" ? Math.max(fitX, fitY) : Math.min(fitX, fitY);
  const sx = fit === "stretch" ? fitX : factor,
    sy = fit === "stretch" ? fitY : factor;
  const padX = (rect.width - crop.width * sx) / 2,
    padY = (rect.height - crop.height * sy) / 2;
  return {
    ...canvas,
    sample(x, y) {
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height || !scale.x || !scale.y)
        return clear;
      const px = pivot.x * rect.width,
        py = pivot.y * rect.height;
      const dx = x - rect.x - px,
        dy = y - rect.y - py;
      const localX = (dx * Math.cos(turn) + dy * Math.sin(turn)) / scale.x + px;
      const localY = (-dx * Math.sin(turn) + dy * Math.cos(turn)) / scale.y + py;
      if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) return clear;
      const fromX = (localX - padX) / sx,
        fromY = (localY - padY) / sy;
      if (fromX < 0 || fromY < 0 || fromX >= crop.width || fromY >= crop.height) return clear;
      return surface.sample(fromX + crop.x, fromY + crop.y);
    },
  };
}
export function stackSurface(surface, steps, canvas, sourceDomain = false) {
  for (const { processor, enabled = true } of steps) {
    if (!enabled) continue;
    if (processor.type === "geometry") {
      surface = geometrySurface(surface, processor, canvas);
      sourceDomain = false;
    } else if (processor.type === "opacity") surface = opacitySurface(surface, processor.opacity);
    else assert.fail(`No authored reference for ${processor.type}`);
  }
  return sourceDomain ? geometrySurface(surface, {}, canvas) : surface;
}
export function expectedRgba(surface) {
  const bytes = Buffer.alloc(surface.width * surface.height * 4);
  for (let y = 0; y < surface.height; y++)
    for (let x = 0; x < surface.width; x++) {
      const sample = surface.sample(x + 0.5, y + 0.5),
        at = (y * surface.width + x) * 4;
      for (let c = 0; c < 3; c++)
        bytes[at + c] = Math.round(
          Math.max(
            0,
            Math.min(1, sample[3] ? linearToSrgb(sample[c] / sample[3]) * sample[3] : 0),
          ) * 255,
        );
      bytes[at + 3] = Math.round(Math.max(0, Math.min(1, sample[3])) * 255);
    }
  return bytes;
}

export function layerTree(canvas, media, settings) {
  const taps = new Map();
  const process = (name, input, steps = [], sourceDomain = false) => {
    taps.set(`${name}/dry`, stackSurface(input, [], canvas, sourceDomain));
    for (let i = 0; i < steps.length; i++)
      taps.set(
        `${name}/after:${steps[i].label}`,
        stackSurface(input, steps.slice(0, i + 1), canvas, sourceDomain),
      );
    const output = stackSurface(input, steps, canvas, sourceDomain);
    taps.set(`${name}/processed`, output);
    return output;
  };
  const screen = process("screen", sourceSurface(media.screen), settings.screen, true);
  const presenter = process("presenter", sourceSurface(media.presenter), settings.presenter, true);
  const screenTrack = process("screen-track", screen, settings.screenTrack);
  const presenterTrack = process("presenter-track", presenter, settings.presenterTrack);
  const combined = settings.reversed
    ? over(presenterTrack, screenTrack)
    : over(screenTrack, presenterTrack);
  const inner = process("inner", combined, settings.inner);
  const outer = process("outer", inner, settings.outer);
  const output = process("output", over(background(canvas), outer), settings.output);
  return { output, taps };
}

export function compareGeometry(actual, expected, width, height) {
  assert.equal(actual.length, width * height * 4);
  assert.equal(expected.length, actual.length);
  let compared = 0,
    maximumError = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      let uniform = true;
      for (let dy = -2; dy <= 2 && uniform; dy++)
        for (let dx = -2; dx <= 2 && uniform; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          for (let c = 0; c < 4; c++)
            if (Math.abs(expected[(ny * width + nx) * 4 + c] - expected[at + c]) > 2)
              uniform = false;
        }
      if (!uniform) continue;
      compared++;
      for (let c = 0; c < 4; c++) {
        const error = Math.abs(actual[at + c] - expected[at + c]);
        maximumError = Math.max(maximumError, error);
        assert.ok(
          error <= 2,
          `Interior pixel (${x},${y}) channel ${c}: ${actual[at + c]} != ${expected[at + c]}`,
        );
      }
    }
  assert.ok(compared > (width * height) / 2, "Reference has too few stable interior pixels");
  const moments = (bytes, channel, threshold) => {
    let count = 0,
      sumX = 0,
      sumY = 0;
    const bounds = [width, height, -1, -1],
      mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (bytes[(y * width + x) * 4 + channel] > threshold) {
          mask[y * width + x] = 1;
          count++;
          sumX += x + 0.5;
          sumY += y + 0.5;
          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], y);
        }
    return { count, center: count ? [sumX / count, sumY / count] : null, bounds, mask };
  };
  const shapes = [];
  for (const channel of [0, 1, 2, 3]) {
    let maximum = 0;
    for (let at = channel; at < expected.length; at += 4) maximum = Math.max(maximum, expected[at]);
    // Half-light edges are localized to a raster pixel; color is normalized to sRGB.
    const threshold =
      channel === 3 ? maximum / 2 : linearToSrgb(srgbToLinear(maximum / 255) / 2) * 255;
    const a = moments(actual, channel, threshold),
      e = moments(expected, channel, threshold);
    assert.equal(a.count === 0, e.count === 0, "Geometry unexpectedly added or lost a landmark");
    assert.ok(
      Math.abs(a.count - e.count) <= Math.max(1, e.count * 0.02),
      "Landmark coverage count changed beyond the rasterization budget",
    );
    if (e.count) {
      for (let axis = 0; axis < 2; axis++)
        assert.ok(
          Math.abs(a.center[axis] - e.center[axis]) <= 0.51,
          `Landmark centroid shifted on axis ${axis}`,
        );
      for (let edge = 0; edge < 4; edge++)
        assert.ok(
          Math.abs(a.bounds[edge] - e.bounds[edge]) <= 1,
          "Landmark boundary moved by more than one raster pixel",
        );
    }
    for (const [from, to] of [
      [a.mask, e.mask],
      [e.mask, a.mask],
    ])
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          if (!from[y * width + x]) continue;
          let matched = false;
          for (let dy = -1; dy <= 1 && !matched; dy++)
            for (let dx = -1; dx <= 1 && !matched; dx++) {
              const nx = x + dx,
                ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height && to[ny * width + nx])
                matched = true;
            }
          assert.ok(matched, `Landmark coverage missing near (${x},${y})`);
        }
    const { mask: _actualMask, ...actualShape } = a,
      { mask: _expectedMask, ...expectedShape } = e;
    shapes.push({ channel, actual: actualShape, expected: expectedShape });
  }
  return { compared, total: width * height, maximumError, shapes };
}
