# 25 — Add explicit tonal and color controls

Status: complete for the frozen acceptance envelope — 25A tonal recovery and 25B caller-authored split-tone/LUT response both pass independent public/native receipts with region masks. General movie fidelity and aesthetic matching remain outside this scoped contract. Depends on: [13](13-decode-replication.md), [14](14-picture-statistics.md).

## Contract

Caller-selected bounded shadows/highlights controls can shape source footage without crushing a face to darken its wall. The existing exposure/contrast/saturation/neutral controls remain one ordered correction step; caller-authored split-tone and curve responses use the existing immutable LUT owner.

## Seam and ownership

Existing SDR correction/processing registry and shared native executor; exactly one explicit ordered grade recipe.

Current owners and starting checks:

- [helpers/mac/Sources/YapFrames/SDRCorrection.swift](../../../helpers/mac/Sources/YapFrames/SDRCorrection.swift)
- [packages/composition/src/schema.ts](../../../packages/composition/src/schema.ts)
- [helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift](../../../helpers/mac/Sources/YapFrames/CompositionPictureExecutor.swift)
- [packages/test-harness/editing/COLOR-REPRODUCTION.md](../../../packages/test-harness/editing/COLOR-REPRODUCTION.md)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

The current bounded representation adds `shadows` and `highlights` to the existing source-neutral correction contract and lowers them to the shared native `CIHighlightShadowAdjust` stage after temperature, exposure and color controls. Working space, alpha and clipping behavior remain those of the existing executor. Freeze tone shaping first, then explicit hue/split-tone treatment. Measurements remain evidence; no automatic face grade. Simple vignette/grain can be authored with existing geometry/blends and deterministic imported overlays under [33](33-editing-references.md).

## Runnable checkpoint

25A preserves the public zero-identity convention and translates the provider's
reversed highlight convention in the existing native owner. Its
[frozen evidence](../assets/25-tone-controls/README.md) separates lossless response,
matched movie encoding and historical former-control parity.25B uses26's explicit
immutable LUT contract for caller-authored curves and hue/split-tone, with a
separate frozen numerical/color reference. The retained [25B public receipt](../assets/25-tone-controls/split-tone/public/README.md) drives CLI/MCP import, authoring and native delivery; its independent chart matches within one code value and retains neutral, shadow-color and highlight-neutral masks.

Chart/real-wall before/after scopes and reference-conditioned grade frames.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Identity, endpoint monotonicity, dark face/bright wall, neutral region, order effects and alpha. A dark reference must not impose source crushing; no universal aesthetic metrics. Freeze chosen recipe before promotion.

Variable A: tonal distribution, face/wall masks. Variable B after A: hue/split tone, declared color/neutral masks. Vignette, geometry and captions frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

Composition schema/native parameter coverage and the frozen public/native receipts are green for this envelope. The accepted proof covers the declared chart, masks, codec and LUT recipe; arbitrary reference-conditioned movie fidelity remains a separate future slice. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Curve representation and parameter names selected by replication; default identity and explicit treatment are fixed.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Source interpretation, existing grade order semantics and shared native output remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
