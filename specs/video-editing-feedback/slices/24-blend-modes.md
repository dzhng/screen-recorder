# 24 — Define useful layer blend arithmetic

Status: implemented — independent raw arithmetic, public admission and full-raster declared-codec movie reproducibility pass; fresh visual and independent code reviews are clean. Depends on: [13](13-decode-replication.md).

## Contract

Multiply/screen/soft-light layer combinations retain independent linear-light
arithmetic in frames. Movies reproduce that arithmetic through their declared
codec and settings, checked over the full raster against the independently
authored arithmetic image encoded without blend operations. This does not promise
lossless RGB preservation from a lossy H.264 output.

## Seam and ownership

Composition picture combination/compiled records and existing native CompositionPictureExecutor; no separate overlay renderer.

Current owners and starting checks:

- [packages/composition/src/schema.ts](../../../packages/composition/src/schema.ts)
- [packages/composition/src/compiled-records.ts](../../../packages/composition/src/compiled-records.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)
- [apps/service/src/picture-recipe.test.ts](../../../apps/service/src/picture-recipe.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Freeze working color space, premultiplied-alpha handling, blend order and transparent/identity behavior against independent patches. Expose an explicit layer combination field/step owned by the current compositor. Do not substitute a different backend at runtime.

## Runnable checkpoint

`YapFrameTests --blend-modes` renders red/blue swatches through multiply, screen and
soft-light in the native compositor and checks the delivered pixels. Composition authoring
retains the explicit mode as a blend operation on the layer surface; the native media
contract carries the same mode. The [independent sheet checkpoint](../assets/24-blend-sheet/README.md)
freezes color/alpha/order/group and vignette arithmetic through the public compiler and
native still/movie seam. The public journey now verifies CLI authoring, MCP readback,
delivered pixels, exact rational movie support and committed export bytes/destination.
The [encoded-reference checkpoint](../assets/24-blend-sheet/encoding/README.md)
compares both movie samples without a mask. Its fresh visual critique accepts
complete boundaries and vignette falloff. The raw-reference hard-edge red remains
retained alongside the corrected [visual adjudication](../assets/24-blend-sheet/visual-review.md).

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Opaque/translucent/transparent operands, neutral patches, nested groups and layer order. Numeric reference arithmetic and native frame/movie parity precede aesthetic assessment.

Variable: blend response only. Mask: fixed swatches/overlay region; no new grade or motion.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

The focused pass is green when composition planning retains the explicit mode and native
delivery matches the expected swatch arithmetic. The complete still remains under
the original two-level tolerance. Both movie samples remain under the original
eight-level tolerance against matched encoded arithmetic references, with no
fringe mask; their exact physical support and export identities also pass. The
raw-reference hard-edge bound remains red because it included normal codec loss,
not an additional blend defect. No numeric gate or output setting was repinned.
The final [independent rereview](../assets/24-blend-sheet/encoding/review.md)
resolves reference-identity and default-case coverage hardening; the slice is closed
for this measured target. An unavailable stub or
undocumented fallback is not implementation completion.

## Delegated choices

Native implementation using a pinned tested blend recipe; no new per-backend policy.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Shared compositing, alpha and frame/preview/export phase remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
