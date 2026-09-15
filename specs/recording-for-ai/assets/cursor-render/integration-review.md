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

- The small 160-pixel output does make the trail thin and the pointer tiny. Keep
  visual acceptance open for a focused minimum-output-size styling check.
- The wave crosses text and alpha blending changes its apparent color; the reviewer
  still found the text legible. A black halo is already rendered, contrary to the
  report's assumption that none exists. Recheck contrast alongside the small-output
  pass while preserving the required fading behavior.
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

No real captured gesture, scene reset or core-selected trail has been verified.
