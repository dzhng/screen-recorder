# 17c — Literal text through the ordinary clip pipeline

Status: literal vertical verified, including fresh scoped visual and public skill reviews. Dependencies: [17a](17a-text-layout.md),
[17b](17b-font-admission.md). Parent17 remains open through occurrence seeding.

## Approved ownership

Text is an ordinary video clip with a typed, non-timed text source. Its literal,
exact font asset/face, size, color, alignment, wrapping and raster-box dimensions
are explicit. Existing track order, geometry/opacity processing and project,
content or normalized clip anchors apply. Remove the unshipped empty `captions`
container; do not retain a compatibility owner. Update active fixtures, while
historical frozen evidence remains untouched and identifies its older shape.

A text source has neither source clock nor playable media stream. Structural edits
reuse the existing clip graph, affine anchor resolver, partition and duplicate
owners. `text.set` changes literal/style without changing anchor or transcript.
The transparent raster's box is its source domain; ordinary geometry chooses the
destination rectangle, including an explicit one-to-one pixel placement when font
size must remain unchanged by fitting.

Composition owns text validation, scheduling, geometry and frame identity. Native
ports the frozen17a Core Text layout and shaped-run fallback check into the
existing picture executor, selecting only the exact retained file/face. Reuse is
bounded by active attempt surfaces and existing pixel budgets. No glyph service,
persisted text bitmap, second timeline or font-as-media binding is introduced.

One document asset dependency extractor includes real media and font assets. All
revision/history/package/adoption validation and window execution consume it;
fonts remain ordinary immutable asset resources with explicit native font bindings.

## Verification and next pickup

[Evidence](../assets/17c-literal-text/README.md) retains exact frozen17a raw RGBA
and final black/white/static control parity; all three anchor domains through
split/trim/retime/repeat; exact collection/same-name-different-hash rasters;
fresh-store package history/undo; Unicode cache red/green; explicit fallback
refusal; range preview and byte-identical full export. Public alpha checks retain
transparent PNGs while rejecting translucent final H.264 pixels, output opacity
and gaps; opaque cover over transparent canvas remains accepted.

Composition203 tests and core typecheck pass. Focused core36 passed; the unchanged
large-history cleanup exceeded five seconds under contention and passed in a
bounded20-second isolated run (8.31 seconds total). Native build and independent code
review/follow-up pass after the exact UTF-16 cache fix. Fresh scoped visual critique and implementer/parent inspections agree; Arabic
linguistic correctness and all-edge crop coverage remain unclaimed. Fresh public skill use passed explicit authoring/style/geometry, actual PNGs,
replay/preservation and face/fallback refusals.
Audio retiming readiness is unchanged. Text timing is proven independently of
unbound stretch. Native glyph-zero refusal is implemented separately from fallback;
the public unsupported-character fixtures exercised fallback, not glyph zero.

Next, parent17 must seed these same clips from pinned word occurrences, including
repeated speech, with occurrence provenance and explicit display-text correction.
This checkpoint is not completion of parent17 and cannot become a permanent
project-only subset.
