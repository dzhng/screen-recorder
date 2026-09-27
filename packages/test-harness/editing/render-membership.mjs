export function mask(rgb) {
  const output = new Uint8Array(160 * 128);
  for (let i = 0; i < output.length; i++)
    output[i] = Math.min(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) > 200 ? 1 : 0;
  return output;
}
export function classify(rgb, references) {
  const actual = mask(rgb);
  const distances = references
    // No white glyphs does not prove an empty edit: this fixture's black is zero RGB.
    .filter(({ id }) => id !== "black" || rgb.every((channel) => channel === 0))
    .map(({ id, mask }) => {
      let differingPixels = 0;
      for (let i = 0; i < mask.length; i++) differingPixels += actual[i] !== mask[i] ? 1 : 0;
      return { id, differingPixels };
    })
    .sort((a, b) => a.differingPixels - b.differingPixels);
  return { ...distances[0], runnerUp: distances[1] };
}
