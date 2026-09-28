# Animated crop, dimensions and pivot

All numeric geometry fields use the same typed scalar-curve clock. Crop coordinates
remain preceding-image pixels, rectangle dimensions remain canvas pixels, and
pivot coordinates remain normalized to the rectangle. The numeric geometry
compiler is still the only owner of transform order and sampling support.

Each field keeps its static domain over the entire curve. Width/height must stay
strictly positive; pivot coordinates must stay in [0,1]; coordinates, scale and
rotation must stay finite. These constraints include cubic interior extrema.
The smallest representable positive number is the inclusive size lower bound,
which excludes zero without inventing a larger minimum. Numeric matrix compilation
still rejects unsafe emitted values. Whole-curve scalar validation does not claim
that every combination can produce a representable matrix at every instant.

Static crop/placement permits rectangles outside the source/canvas. Animation
preserves that behavior: there is no new coupled requirement that x+width or
y+height stay inside the source. Positive extents and bounded pivots are independent
field domains; the established compiler owns their combined sampled geometry.

The public `keyframes.mjs --case moved-split-geometry` journey exercises all geometry
scalar families together, independent static controls, move/split/trim and activation
windows. It also submits invalid cubic interiors through both CLI and MCP and
checks refusal without changing the authored stack. All 39 PNG checks and seven
whole-curve refusals pass, including the subnormal-size regression.
Full preview and export bytes
match. Encoded mean RGB differences are 0.560–3.671, maximum 243; full/range means
are 0.375–1.136, maximum 45. The inherited mean<=12 membership/layout gate does not
accept these encoded color/edge errors. Fresh unprimed review of all 47
captures/crops finds consistent nonmovie geometry
and clipping across paired groups. It confirms dimmer red detail, blockier blue
edges, dark blue blocks and colored fringes in movie frames; these remain open.
See [the scoped verdict](review/verdict.md). Stills do not establish continuous
motion or real UI/text quality.

Independent pure checks pin numeric source crop corners and pivot placement rather
than relying only on a second route through the same scalar mapper. Taking crop
width from height fails that landmark test. Allowing a zero dimension fails four
whole-curve tests with legal endpoint values. These deliberate mutations are
retained separately from the restored passing suite.

All 182 composition tests and the type check pass, including independently
falsified domain and coordinate contracts. Independent Codex review found no actionable regressions and
ran those same checks; the native public journey was verified separately.

A late boundary audit found that tiny coefficients could underflow the shared
extrema validator's derivative discriminant. Positive subnormal keys hid an
interior zero. The retained red test reproduces that missed refusal. Normalizing
nonzero coefficients in both directions fixes the shared validator without
changing curve sampling; the all-zero polynomial keeps a unit divisor. The final
independent review reran all 182 tests/types and found no actionable regression.

The complete public static-layer journey passes, including independent geometry,
whole/range movies, unchanged PCM, exports and lifetime checks. All 64 current tap
PNGs remain byte-exact against the previous position/rotation pass.

Final public confirmation preserves all 39 reviewed PNGs and eight reviewed decoded
movie pictures exactly; measured movie/range errors are also unchanged. No visual
capture changed after the fresh review. Preview's four-sheet document was verified
and closed after the nonblocking checkpoint; no human acceptance is claimed.
