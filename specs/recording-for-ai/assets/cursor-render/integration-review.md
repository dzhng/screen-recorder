# Native cursor rendering integration

Root ran the frame suite and rebuilt the integrated worker; all ten native worker
process tests pass, including audio and recovery neighbors. All twelve generated
PNGs are byte-identical to the submitted candidate images. The comparative
[metrics](metrics.json) cover only the review frames sharing the same source/time;
behavior fixtures at other timestamps are not treated as before/after pairs.

Independent code review found a successful-response failure path: nil bitmap/image
creation omitted the overlay while reporting its points as drawn. Root changed
those failures to `NATIVE_DECODE_FAILED`. A forced nil-image check reproduced the
old false success, then proved the corrected error and absence of output. The
original source hash stayed unchanged; the injection was removed and the production
worker rebuilt. See [failure evidence](raster-failure-check.json).

## Visual disposition

A fresh Opus session inspected every full image plus enlarged crops. Its
[raw critique](independent-visual-review.md) is evidence to interpret, not a list of
instructions to change captured paths.

- The small 160-pixel output did make the trail thin and the pointer tiny, and the
  focused styling pass that followed found the cause: widths were chosen in source
  pixels, so the long-edge bound averaged the halo into the core and left a
  washed-out hairline with no outline. Minimums are now stated in delivered pixels.
  See the measurements in [review](review.md) and
  [delivered-sizing.json](delivered-sizing.json).
- The wave crosses text and alpha blending changes its apparent color; the reviewer
  still found the text legible. A black halo is already rendered, contrary to the
  report's assumption that none exists. Rechecked at the small output: the halo now
  survives the downscale, and the label keeps 82% of its pixels full size and 69%
  halved. The fading behaviour is unchanged.
- A gesture trail is historical cursor movement, not a ring centered on today's
  pointer or the whole button. The pointer at the circle's edge is correct for the
  supplied path. Re-centering it would falsify the evidence.
- Clipping at a requested crop edge is intentional. Disconnected runs and an absent
  pointer are explicit input evidence, not missing models. Native must not bridge
  those gaps or invent a current pointer.
- Uneven opacity around the path communicates age. The white pointer's black outline
  is visible on the light button; no orientation or layering inversion was observed.
- The enlarged crops used nearest-neighbor resampling, not smooth interpolation as
  the report inferred. Source text softness is already present in the clean frame.

Every mode is now rendered at 320x240, at a 160-pixel bound and at a 48-pixel
thumbnail, with the previous small renders kept beside them for comparison. Frames
delivered at source size are byte-identical to the images this replaces, so the
change is confined to what the downscale reaches.

## Delivered-sizing integration (2026-09-15)

The integrated frame suite passes 28 checks and all 14 worker process tests pass.
All 19 current PNGs are byte-identical to the candidate renders; see
[sizing integration](sizing-integration.json). The same-source before/after worker
comparisons in [delivered sizing](delivered-sizing.json) prove that small-output
pixels changed while full-size output and reported geometry remained unchanged.
Independent code review found no actionable sizing defect; its native runtime
checks were blocked by sandbox cache access, so the root ran the integrated checks.

A fresh Opus reviewer inspected all 19 current images and 28 nearest-neighbor
crops. The [raw sizing critique](sizing-visual-critique.md) has these dispositions:

- **Accepted limitation:** small trails cross and obscure some text. At 160 pixels,
  the wave changes 31% of label pixels and the circle changes 17% of button pixels.
  Root can still read both labels, but does not infer universal readability from
  this fixture. The 48-pixel clean source itself is illegible. Default inspection
  is 1600 pixels; callers requesting very small images can request a larger or
  clean frame to resolve obscured content. No content-aware path displacement.
- **Accepted styling tradeoff:** the delivered-pixel floor makes the pointer larger
  relative to downscaled content. The alternative previously lost the pointer's
  shape. Its floor is capped on thumbnails; these fixtures preserve the hotspot.
- **Visible but limited:** the straight trail has small brightness steps at age-band
  joins. It has no raster gaps: all 60 interior columns contain magenta, with minimum
  red-minus-green 86/255. The review's missing/dotted-path diagnosis is unsupported;
  subtle band joins remain a styling limitation, not missing cursor observations.
- **Rejected inferred defects:** scaled/gap behavior fixtures intentionally omit a
  pointer. The crop fixture deliberately supplies a pointer off the horizontal
  trail; tests pin its independent hotspot. No pointer was dropped or mispositioned.
- **Rejected changes to evidence:** circles are supplied cursor history, not click
  rings. Their centers must not move to the current pointer or avoid labels. Crops
  clip the requested area; insetting would change the requested coordinates.
- **Intentional age semantics:** opacity fades along history. The 2s/10s suffixes
  are trail durations, not mark ages, so the slower fade is correct. A black halo
  exists and survives downscaling; the arrow is white-filled with a black outline,
  contrary to the review's color/layering inference. No contrast guarantee over
  arbitrary source content is claimed.

Generated-media native styling is accepted with those limits. No real captured
gesture, scene reset or core-selected trail has been verified; parent slice 10
remains open.
