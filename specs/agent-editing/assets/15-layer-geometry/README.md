# Compiled geometry and layer execution

Geometry belongs to composition. The worker receives sampling clamps, affine
matrices, polygon coverage and explicit rasterization boundaries; it never
chooses fit, pivot, crop coordinates or layer placement. Sampling color and
geometric coverage are distinct: scaling an opaque crop must not introduce
transparency inside its destination footprint, and excluded source pixels must
not leak into its boundary. A later geometry step deliberately resamples the
preceding fixed canvas.

[Verification](./verification.json) records the worker identities, authored
matrix, source-domain preservation, decoded movie geometry, unchanged narration
PCM and fresh visual critique. The contact sheets preserve every final captured
state. The native probes are reproducible with
[layers-native.mjs](../../../../packages/test-harness/editing/layers-native.mjs)
and [source-display.mjs](../../../../packages/test-harness/editing/source-display.mjs):
pass a fresh output directory and `SCREENREC_NATIVE`; source-display also needs
`SCREENREC_BASELINE_NATIVE` pointing at the frozen historical executable.

The source display probe preserves identity, quarter-turn and oblique pictures
exactly. Its white-on-white counterexample establishes why preserving every old
pixel would be incorrect: the old sampling domain admitted a dark edge from
outside the source. The correction changes only the border in that control;
stable interiors stay exact. The historical held-tail movie has the same
attributed edge correction: [source pixels](./held-tail-source-changes.json)
and [encoded changes](./held-tail-encoded-changes.json) retain its measured scope.
The [corrected movie baseline](./corrected-movie-pixels.json) admits only that
exact before/after hash pair; all other historical fixtures still require exact
old decoded pixels. Original strict-hash failure remains in verification evidence.

Lossless frame colors retain the fixed two-code-value interior gate. H.264
comparisons assert geometric coverage, bounds, centroid and source-clock phase;
their measured codec error is reported separately. They do not accept the still
open general codec/color contract. PNG retains post-output alpha, while the
current H.264 profile explicitly refuses a nonopaque final canvas. No background
is inserted after output processing.

The unsuccessful CI crop/intermediate trials matter because apparently harmless
grouping and output ROI changed their boundary alpha. The final polygon contract
replaced that mechanism; the thresholds were not widened to accept it. Source
interpolation was isolated from compositing: the tagged CoreVideo709 source uses
Apple's documented gamma1.961, while an independently tagged sRGB source follows
its own transfer. Both interpolate encoded samples; parent compositing operates
in premultiplied extended-linear-sRGB, with RGBAh intermediates. See Apple's
[working color space](https://developer.apple.com/documentation/coreimage/cicontextoption/workingcolorspace)
and [CoreVideo transfer convention](https://developer.apple.com/documentation/accelerate/vimagebuffer_initwithcvpixelbuffer(_:_:_:_:_:_:)).

This is a compiler/native checkpoint. Public CLI/MCP preview/export readiness,
source-attached pointer adoption, image-asset execution and additional output
profiles are not accepted by this evidence. The main integration must invalidate
old immutable probe/catalog state and every affected source/project/scene pixel
recipe; ordinary reads must not re-probe or reinterpret old metadata.

[Combined-runtime confirmation](integrated.json) preserves compiler frame-boundary
selection and source no-picture behavior after integration. Native layer/admission
and display probes, full composition/core tests and existing public project-frame
and source-index journeys pass. Catalog format and all affected pixel/scene recipe
identities now invalidate earlier admitted geometry and rendered data; capture
journal and audio recipes remain unchanged because this correction does not reach
their execution paths. Public geometry activation and its journeys remain next.
