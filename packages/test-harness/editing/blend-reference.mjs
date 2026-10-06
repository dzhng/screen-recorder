// Independent W3C Compositing and Blending Level 1 (§10.3) arithmetic.
// Operands/results are premultiplied linear-sRGB. No product renderer is imported.
export function blendPixel(source, backdrop, mode) {
  const sa = source[3],
    ba = backdrop[3];
  function channel(s, b) {
    switch (mode) {
      case "normal":
        return s;
      case "multiply":
        return b * s;
      case "screen":
        return b + s - b * s;
      case "soft-light": {
        const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
        return s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (d - b);
      }
      default:
        throw new Error(`Unknown reference blend mode ${mode}`);
    }
  }
  return source
    .slice(0, 3)
    .map(
      (s, i) =>
        (1 - sa) * backdrop[i] +
        (1 - ba) * s +
        sa * ba * channel(sa ? s / sa : 0, ba ? backdrop[i] / ba : 0),
    )
    .concat(sa + ba * (1 - sa));
}
