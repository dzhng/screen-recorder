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

No real captured gesture, scene reset or core-selected trail has been verified, and
the small-output renders have not yet had a fresh unprimed critique.
