# Immutable LUT checkpoint

This checkpoint judges an explicit imported color transform, not whether an
editorial grade looks pleasing. The source is the frozen Lily picture; the
single variable is LUT RGB response. Composition, canvas, exposure, alpha and
source bytes stay fixed. [The public journey](../../../../../packages/test-harness/editing/lut-assets.mjs)
owns executable reproduction and isolated managed-state cleanup. The
[native numeric test](../../../../../helpers/mac/Tests/YapFrameTests/LUTTests.swift)
owns parser, interpolation, alpha, extrapolation, step-order and byte-refusal
controls.

## Frozen recipe

[Admission](../../../../../helpers/mac/Sources/YapMedia/CubeLUT.swift) accepts bounded
UTF-8 3D .cube grids, with red changing fastest, optional unit domain headers
and finite unit RGB samples. Unknown transforms, incomplete/extra grids,
non-unit domains, nonfinite/out-of-range samples and unsupported sizes refuse.
No .cube file identifies its camera profile or gamma: the explicit caller must
choose the admitted linear-sRGB interpretation. The public schema is closed;
there is no log/profile inference or ambient installed-LUT lookup.

[The shared native recipe](../../../../../helpers/mac/Sources/YapFrames/LUTColor.swift)
uses Float32 table samples in a CoreImage trilinear sampler kernel. Edge cells
extend linearly for extended input values, preserving the existing output
conversion's ownership of final clipping. Alpha never comes from the LUT.
Exact identity grids return the original image so that an identity request
cannot change filter fusion or cause another rasterization/quantization step.
Its implementation identity binds this recipe and the OS provider. Imported
bytes are hash-checked before the renderer caches immutable samples; active
frames retain a bounded LUT working set.

The direct Apple CIColorCube candidates failed the fixed numeric gate: a
nominal 0.125 response became 0.1254902, and 0.375 became 0.3764706. The accepted
sampler recipe keeps the unchanged 0.0002 numeric tolerance. An initial
identity sampler changed some real-shot PNG code values through additional
filter fusion; exact identity bypass resolves that without loosening the
identity comparison. These are frozen research findings, not parallel backends.

## Scope of proof

[Public requests and replies](report.json) prove CLI/MCP import, typed asset
metadata, execution discovery and compiled LUT dependency delivery. An identity
size-3 table reproduces the complete dry delivered RGB exactly. The independent
reference decodes sRGB codes, applies linear gains 0.8/0.9/1 and re-encodes sRGB;
[comparison](comparison.json) measures complete PNG RGB and face/left-wall/right-wall
masks. Every channel differs by at most one code value; full-raster mean
absolute error is 0.12463/255. [The comparison sheet](comparison-sheet.png)
is dry → independent reference → PNG → decoded movie.

A processed project ZIP was exported, then all owned donor managed state was
removed. Adoption into another scratch root reproduces the complete graded
PNG exactly. Immutable .cube bytes remain dependencies of the authored revision,
bypassed steps and retained history; undo/portable tests exercise a cleared
current stack whose older LUT revision survives. External original media and
frozen inputs are never removed.

The shared movie executor also commits a two-frame held-shot movie carrying
this LUT. Its first decoded frame differs from the PNG by RGB MAE 3.3797/255,
within the existing SDR codec checkpoint tolerance of four. The unmasked mismatch
against the independent lossless reference is separately retained: MAE 3.37562/255,
maximum 37 code values. These raw-reference observations do not establish
lossless-to-codec equivalence.

A matched native-encoded independent-reference movie uses the same public held-shot
composition and encoder. The complete RGB raster over both frames differs by
MAE 0.47703/255, maximum 7, passing the predeclared mean-one-code-value response
gate. No boundary mask is used. This establishes LUT response parity for the
complete two-frame held-shot movie, not moving-shot/general delivery fidelity.
The independently judged movie discrepancy is recorded separately below; it
cannot redefine the lossless PNG/interpolation gates.

## Verification and review

The pure public-composition test first failed on the unsupported LUT processor;
the non-playable immutable-asset test first failed admission. The standalone
native parser first refused the identity fixture, then passed after implementation.
Rejected Apple cube responses above preserve a genuine native red/green numeric
control. Focused asset/portable/revision tests pass, and the composition package
passes 27 files / 320 tests. Composition typecheck, service typecheck and scoped
lint pass. Core build still reports only the pre-existing source/project index
`faceObservationRequest` errors; no full-core typecheck success is claimed.
The full repository suite remains reserved for final spec completion.

Shape review keeps .cube parsing with physical asset admission and color
execution with the shared picture owner. No resource kind, table, scheduler,
export pipeline or dependency was added. A common immutable-file binding replaces
the font-specific name now shared by fonts and LUTs. The public manifest contains
only active LUTs while revision retention includes bypassed/history LUTs.

A Preview display was attempted for the comparison sheet and enlarged face
crops. Preview was unresponsive alongside the root session's display attempt;
our pending AppleEvent subprocess was canceled and the root cleaned the owned
application. Artifacts remain directly viewable. There is no human QA gate.

[The unprimed visual verdict](visual-review.md) accepts PNG geometry, response and
absence of banding/halos. It identifies mild decoded-movie tonal drift and
softening, with no obvious block seams, ringing or banding. That finding remains
a delivery limitation, not an interpolation failure: the lossless reference and
PNG agree independently, and codec/moving-shot fidelity is not closed here.
[The completion receipt](visual-review.json) freezes the critique scope.

[The final matched unprimed critique](matched-visual-review.md) inspected five full
frames and five 4x face crops. PNG matches the independent reference; encoded
reference and candidate are visually indistinguishable, with shared mild softness
and tonal lift relative to lossless images. Its characterization of the dry
frame's warmer response as a defect is not an editorial requirement: that color
difference is the explicitly requested transform. The raw mismatch above remains
visible and retained. [Receipt](matched-visual-review.json) freezes scope and triage.

[Independent code review](code-review.md) reports one compatibility finding: the
new required `manifest.luts` makes old prepared-audio manifests unreadable. This
is confirmed and intentionally dismissed under the user's explicit hard cutover,
no-shim/no-migration instruction and disposable current data. No compatibility
default was added. [Receipt](code-review.json) records that decision and the
reviewer's sandbox-check limits; all other reviewed LUT paths were consistent.
The docs link chain and scoped lint pass.
