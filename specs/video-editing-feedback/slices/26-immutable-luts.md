# 26 — Apply an explicitly imported LUT

Status: implemented immutable/LUT response and package contract; complete two-frame held-shot movie response, with broader movie fidelity open. Depends on: [25](25-tone-controls.md).

## Contract

Immutable LUT bytes are admitted through `asset.import`, with non-playable `lut`
metadata, then retained as explicit revision dependencies. `processing.set` accepts
`{type:"lut", assetId, colorSpace:"linear-srgb", interpolation:"trilinear"}`
in the existing ordered picture stack. No new asset kind or global lookup exists.

## Seam and ownership

Asset admission/metadata and existing processing dependencies; native shared picture executor.

Current owners and starting checks:

- [packages/core/src/assets.ts](../../../packages/core/src/assets.ts)
- [packages/composition/src/schema.ts](../../../packages/composition/src/schema.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)
- [packages/core/src/portable-assets.test.ts](../../../packages/core/src/portable-assets.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Frozen recipe: UTF-8 3D .cube up to 4 MiB, size 2–33, red-fastest samples, optional
unit domain headers, finite unit RGB outputs. The native sampler uses Float32
trilinear interpolation in unpremultiplied linear sRGB, extends edge cells linearly
for extended inputs and preserves alpha. Final clipping stays with existing output
conversion. Exact identity grids return the original image unchanged. Native loads
verify immutable SHA256 bytes; active tables share a 16 MiB sample working-set bound.
Malformed/unknown transforms, domains and grid rows refuse.

Direct Apple cube candidates failed the unchanged 0.0002 numerical tolerance. The
accepted float sampler passes independent nonlinear response/alpha/order controls;
identity bypass also passes exact real-shot delivered pixels. These delegated
format/provider choices are frozen in [evidence](../assets/26-immutable-luts/README.md).

## Runnable checkpoint

Identity and independently known numeric LUTs plus real-shot output and relocated-package read.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Malformed grid/domain, unsupported size, missing bytes, ordering, alpha, relocation and declared color interpretation. Byte identity and interpolation parity are distinct from a pleasing grade.

Variable: LUT color response. Mask: chart patches/declared face/neutral zones; other treatments frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Bounded supported grid size/interpolation after reference reproduction; freeze before public schema. No generalized raw filtergraph.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Immutable dependency retention and source integrity; current output interpretation remains correct.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.

## Retained pass verdict

[Public checkpoint](../../../packages/test-harness/editing/lut-assets.mjs) proves
CLI/MCP import/discovery, exact identity PNG, known gain response within one code
value, ordered native execution, byte refusals, revision/undo retention and exact
PNG replay after donor scratch state deletion and independent package adoption.
Focused checks and immutable source controls pass; composition 320 tests, composition
and service typechecks and scoped lint pass. Four existing Core index type errors
remain outside this pass. Full suite waits until final spec completion.

[Unprimed final visual critique](../assets/26-immutable-luts/matched-visual-review.md) accepts
lossless PNG response and framing. The matched native-encoded independent
reference passes complete RGB over both held-shot frames at MAE 0.47703/255, with no boundary mask; fresh full/crop critique
accepts matching response. Both encodings retain mild lift/softness versus lossless
images. The raw independent-reference mismatch remains MAE 3.37562/255, maximum 37.
This certifies the complete held-shot response, not moving-shot/general delivery
fidelity. The latter shared gate remains open. Preview was unresponsive, and the
owned AppleEvent attempt was canceled; artifacts are directly viewable with no human
QA dependency. Scoped code/shape/docs review and choices audit are retained with
the evidence.

The independent code review's sole compatibility finding is intentionally
dismissed: legacy prepared-audio manifests without `luts` refuse under the
explicit hard cutover. No default reader or migration was introduced. See
[review receipt](../assets/26-immutable-luts/code-review.json).
