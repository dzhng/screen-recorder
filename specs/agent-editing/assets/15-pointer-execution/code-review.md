# Independent code review

First review found one P2: held-frame output reuse happened after eagerly drawing
a full source-sized pointer raster on every frame. Its `rasterizedFrames` metric
counted only final output rendering and therefore did not prove glyph reuse.

Resolved by validating and retaining only the current frame's prepared rows before
comparing the complete source/graph/pointer raster key. An exact cache hit returns
the existing output before glyph or primitive rasterization. New native diagnostic
`pointerRasterizations` and a malformed second-held-row movie control verify both
the avoided work and continuing evidence validation. No second overlay cache was
introduced; current-frame row retention is bounded by the attempt stream budget.

Second independent read-only review found no further actionable findings. It
confirmed that row validation precedes the full-key cache comparison and that the
counter plus corrupted-row test cover the original defect. It did not rerun tests;
the implementing pass reran the native pointer fixture, complete no-pointer layer
matrix and 28 native preservation tests after the fix. All 23 inspected PNGs are
byte-identical before and after the change. The full core/service suite passed
745 tests with three skips; typecheck and package builds passed.

The review accepted the explicit separation of scoped geometry evidence from red
color diagnostics. Subsequent root audit further narrowed the causal claim:
standalone PNG parity does not verify actual sequential movie writer inputs. That
unresolved experiment remains in the checkpoint README and slice06, with no relaxed
threshold or claim of whole-movie/full-slice acceptance.
