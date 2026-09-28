export const codecChannelTolerance = 4;

export function mask(rgb) {
  const output = new Uint8Array(160 * 128);
  for (let i = 0; i < output.length; i++)
    output[i] = Math.min(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) > 200 ? 1 : 0;
  return output;
}
export function classify(rgb, references) {
  const actual = mask(rgb);
  const distances = references
    // A glyph-free colored frame is not a gap. Lossy black uses the same channel
    // tolerance as this corpus's declared-color check, rather than exact bytes.
    .filter(({ id }) => id !== "black" || rgb.every((channel) => channel <= codecChannelTolerance))
    .map(({ id, mask }) => {
      let differingPixels = 0;
      for (let i = 0; i < mask.length; i++) differingPixels += actual[i] !== mask[i] ? 1 : 0;
      return { id, differingPixels };
    })
    .sort((a, b) => a.differingPixels - b.differingPixels);
  return { ...distances[0], runnerUp: distances[1] };
}

// The fixed asymmetric corpus is shared by movie and direct-picture gates.
export function corpusReferences(readFrames) {
  const refs = [{ id: "black", mask: new Uint8Array(160 * 128) }];
  for (const [id, width, height, count] of [
    ["a", 160, 96, 8],
    ["b", 96, 128, 10],
  ]) {
    const pixels = readFrames(id);
    for (let n = 0; n < count; n++) {
      const canvas = Buffer.alloc(160 * 128 * 3);
      for (let y = 0; y < height; y++)
        pixels.copy(
          canvas,
          ((y + (128 - height) / 2) * 160 + (160 - width) / 2) * 3,
          (n * height + y) * width * 3,
          (n * height + y + 1) * width * 3,
        );
      refs.push({ id: id.toUpperCase() + n, mask: mask(canvas) });
    }
  }
  return refs;
}
