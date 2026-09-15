I read all 12 full images and all 12 crops. Findings below, ordered by severity.

## Context first: what is source vs. overlay

The red square (top-left), blue square (bottom-right), the 8-cell black/white barcode row, and the green `t=2.500s` / `frame 25` text are **deliberate source test markers** baked into the recorded frames — not overlay. The only overlay elements are the pink ring, the pink trail/wave, and the white-and-black arrow pointer. Also note `review-clean-text-4x`, `review-circle-2s-text-4x`, `review-circle-10s-text-4x` and `review-pointer-only-text-4x` appear pixel-identical — the text region is untouched in all four, so only the wave case interacts with text.

## Findings

**1. Trail is drawn straight through the `frame 25` text with no separation — worst readability hit.** `review-wave-2s`: the pink sine crosses the glyph bodies of `m`, `e`, `2`, `5` and clips the baseline of `frame`. Text stays legible, but the stroke cuts letterforms with no halo, outline, or gap. *Confidence: high. Visible at both full size and crop.*

**2. The trail appears alpha-blended, so its color is inconsistent across backgrounds.** In `review-wave-2s-text-4x` the stroke reads bright magenta over the dark background but shifts to a dull dark maroon where it crosses the green glyphs — same stroke, two apparent colors. Same effect on the ring where it crosses the light `Send` button (`review-circle-crop-4x`): the arc is visibly paler over the light plate than over dark. An overlay mark should hold constant contrast; this one loses saliency exactly where it overlaps content. *Confidence: medium-high. Clearest at crop, inferable at full size.*

**3. Ring is not centered on the pointer hotspot — offset by roughly one radius.** In all three circle crops (`review-circle-10s-button-4x`, `review-circle-2s-button-4x`, `review-circle-crop-4x`) the arrow tip sits on the ring's **right edge**, not at its center; the ring center lands over the `n`/`d` of `Send`. If the ring is meant to mark the cursor point, this looks like an off-by-radius error in the center calculation. If it's meant to encircle the button, it's mis-framed the other way — it isn't centered on the button either. *Confidence: medium (intent-dependent, but the geometry is visibly inconsistent with both readings). Visible at both.*

**4. Ring bottom arc is clipped by the frame edge in `review-circle-crop`.** The lower arc runs off the bottom of the image, leaving an open, broken ring. Whether or not the crop rect is intentional, the resulting mark reads as a partial shape rather than a circle. *Confidence: high. Visible at both.*

**5. Marks do not preserve stroke weight when the output is downscaled.** `overlay-scaled` and `review-circle-scaled` (both ~160×120): the trail collapses to a barely-visible 1px hairline, the ring becomes a thin, dim, partially-dotted outline, and the pointer shrinks to ~4–5px — in `review-circle-scaled-4x` the ring is visibly aliased into broken segments. Stroke width is being scaled with the frame instead of held constant, so annotations fall below usable at small sizes. *Confidence: high. Visible at full size of those two images, confirmed at crop.*

**6. `overlay-gap`: trail renders as two disconnected stubs with blunt caps, and no pointer is drawn at all.** The two short segments at bottom-right have flat butt ends and read as broken dashes rather than a stroke with a deliberate break; combined with the absent cursor there's nothing anchoring the mark. If a gap is the intended test condition, the *rendering* of it is still ambiguous. *Confidence: high on what's visible, low on whether the gap is intentional. Visible at full size.*

**7. `overlay-cropped`: the trail runs edge-to-edge and the pointer is not at the trail terminus.** The pointer sits above and short of the line, which continues past it to the right edge. This may simply be a different source frame (as with the differing timestamps elsewhere), so I'm not treating it as a paired regression — but as a standalone image the cursor/trail relationship doesn't read. *Confidence: medium-low. Visible at full size.*

**8. Ring opacity is uneven around its circumference in the `2s` variant.** `review-circle-2s-button-4x` shows a dimmer, desaturated lower-left arc against a brighter top arc; `review-circle-10s-button-4x` is uniform. Note both frames are the **same source frame** (`t=2.500s`, `frame 25`), so the difference is purely overlay, not timing. If this is a fade/age encoding it reads as an inconsistent stroke rather than a deliberate gradient. *Confidence: medium. Crop only — not distinguishable at full size.*

**9. Pointer white fill has weak contrast on the light button plate.** `review-pointer-only-button-4x`: against the `Send` button's near-white background, only the thin black outline carries the shape. It is readable, but there's no drop shadow or thickened contour, so the arrow relies entirely on a 1px outline. *Confidence: medium, low severity. Crop only.*

## Non-findings worth stating

- **Pointer orientation is correct everywhere** — standard arrow, tip at top-left, consistent across all frames. No flipped, rotated, or mis-hotspotted pointer.
- **The blur on `Send` in the 4x crops is enlargement artifact, not an overlay defect.** `review-clean-button-4x` (no overlay) shows identical softness, so the crops were upscaled with smooth interpolation. Don't read that as rendering blur.
- **No layering inversion observed** — overlay marks consistently paint above the source content, never behind it.

The two highest-value fixes are #1/#2 (give trail and ring a constant-contrast treatment — opaque stroke plus a contrasting outline or shadow) and #3 (the ring/hotspot offset).
