# 22 — Lay out readable native captions

Status: complete — native layout/decorations and public static-sheet/Unicode evidence are accepted. Depends on: [06](06-exact-removal.md).

## Contract

Native text has explicit vertical alignment and useful stroke/shadow/background styling with truthful layout receipts.

## Seam and ownership

Composition text schema/seed and native CoreText TextRaster; caption sidecars continue to represent displayed literal text.

Current owners and starting checks:

- [helpers/mac/Sources/YapFrames/TextRaster.swift](../../../helpers/mac/Sources/YapFrames/TextRaster.swift)
- [packages/composition/src/schema.ts](../../../packages/composition/src/schema.ts)
- [packages/composition/src/text.test.ts](../../../packages/composition/src/text.test.ts)
- [packages/core/src/text-seeds.test.ts](../../../packages/core/src/text-seeds.test.ts)
- [packages/composition/src/caption-sidecars.test.ts](../../../packages/composition/src/caption-sidecars.test.ts)
- [helpers/mac/Tests/TextFidelity/render.mjs](../../../helpers/mac/Tests/TextFidelity/render.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Extend explicit text fields for vertical alignment, stroke/shadow and caption background. Freeze typography/layout first, then decorations in a separate artifact. Retain font asset/glyph authority and exact UTF-16/run semantics. Rendered visibility/bounds are evidence. Plain SRT/VTT discards styling explicitly; display correction never rewrites source words.

Check native color emoji and complex-script glyph coverage explicitly. If a requested
glyph cannot render faithfully, expose the limitation and use an explicitly imported
graphic for that brief; never silently replace it with a monochrome/tofu glyph.

## Runnable checkpoint

The native `YapFrameTests --text-vertical` checkpoint exercises a real CoreText font and
asserts glyph-path bounds for omitted/top, center and bottom alignment, including
centered and edge-clipped receipts. `YapFrameTests --text-decorations` renders a real
font with stroke, shadow and rounded background, checks the returned decoration fields
and bounds, and inspects nontransparent pixels. Composition authoring and public frame
receipt validation retain and compare the same bounded decoration request. The public `captions.mjs --case styled-sheet` checkpoint now proves matched
plain/styled glyph placement and real PNG pixel changes through CLI/MCP; its
`unicode` case proves explicit color emoji and complex-script imports while retaining
substitution/missing-glyph refusals. [Retained evidence](../assets/22-styled-text/README.md)
owns accepted artifacts, reviews and scoped limits.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Vertical top/center/bottom, clipping, missing glyphs, fallback fonts, alpha and long line wrapping. Verify actual PNG/glyph bounds, not echoed styles. Animation is frozen in this slice.

Variable A: vertical/glyph placement, text-box mask. Variable B after A: stroke/shadow/background legibility, caption-band mask. Framing/color remain frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

The vertical and decoration passes are green with native glyph-bounds/decoration receipts,
focused authoring checks and an actual-pixel assertion. Public static-sheet/Unicode evidence, matched comparisons and unprimed critique
are complete. A pointed-glyph stroke regression failed with589 pixels outside
reported bounds and passes with rounded joins; matching cache recipe identities
prevent old pixels surviving the change. Mild finite-raster antialiasing and the
caller-authored shadow remain explicit aesthetic/coverage limits. An unavailable stub or undocumented fallback
is not implementation completion.

## Delegated choices

Style field names/bounded decoration parameters and reversible example aesthetics. No forced house caption preset.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Font identity, literal text fidelity, caption source pins and sidecar surviving support remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
