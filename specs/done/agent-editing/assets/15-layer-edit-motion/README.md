# Moving footage through processed edits

A moving source makes temporal errors visible: each physical frame carries a
translated bar and a different asymmetric binary landmark. The expected picture
comes from the independently decoded source frame and the existing layer geometry
oracle. It does not come from compiler instructions or renderer receipt times.

The public journey exercises fractional split, duplicate, nonaligned move and trim
through actual CLI/MCP operations and the frozen native renderer. PNG delivery must
agree across transports and with the authored source membership and crop/placement.
Pure split preserves exact PNG bytes. The original clip/revision and independent
narration remain unchanged; audio is checked as exact PCM, never played.

Whole and fractional-range previews preserve the global picture clock and its
partial leading/trailing durations. Every decoded movie image is compared, including
blank intervals between edited clips. MCP artifact delivery must equal the CLI file.
H.264 blank backgrounds have no landmark mask to compare, so their explicit check
requires every RGB channel to remain within the existing two-code-value budget of
black and every alpha channel to equal 255. Nonempty images keep the existing
landmark gates. This is blank-codec support, not wider color acceptance.

[Verification](verification.json) records the worker, live scope, negative controls,
static preservation and independent review. The complete [visual set](visual)
contains every current still, decoded movie state and source, with enlarged
processing-region crops. A is the independent expected image; B is native delivery.
[Fresh visual review](visual-review.md) found no unequal shapes, framing or temporal
sequences. Shared edge fringes are expected sampling support and retain the original
geometry gates. Generic [pair metrics](pair-metrics.json) locate differences; they
are diagnostic, not the acceptance rule. Blank images illustrate why: negligible
codec noise can dominate an edge-energy ratio without creating a visible shape.

Run `packages/test-harness/editing/layer-edit-motion.mjs` with a frozen
`SCREENREC_NATIVE` and fresh `--out` directory. The fixture uses all-intra H.264
calibration media to preserve authored landmarks under the existing source check.
Scratch services and sources are removed on completion. The retained PNGs, previews,
receipts and visual sheets are evidence; raw decoded buffers are reproducible and
are not retained here.

This closes the named moving-source edit checkpoint. It does not establish pointer
execution, real-world codec/color breadth, deep-GOP performance, retimed speech,
pitch quality or listening acceptance. No desktop capture, UI launch or playback
was performed. The existing static journey also passes with all 62 reviewed PNG
hashes unchanged.
