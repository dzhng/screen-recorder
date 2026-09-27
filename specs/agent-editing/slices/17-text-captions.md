# 17 — Text and attached captions

Status: not started. Dependencies: [10](./10-project-evidence.md), [16](./16-keyframes.md).

## Contract

Explicit text overlays and transcript-seeded captions render legibly and follow occurrence-specific edits.

## Seam and ownership

Caption/text objects use the existing anchor algebra and compiler. Native text rasterization executes explicit styles. Fonts are resolved dependencies, not ambient fallbacks. Source transcript is never overwritten by caption corrections.

## Work and review surface

Support literal text, font identity, size/color/alignment/box/wrapping and source/project anchors. Seed captions from pinned word occurrences including repeated speech; edits to display text remain distinct from regenerated audio. Render transparent text assets or a native text primitive through the same layer pipeline.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/captions.mjs --case repeated-retimed-speech
```

## Acceptance

Repeated occurrences appear twice; captions survive split/trim/retime with correct ranges. Test punctuation, long words, multiline wrap, clipped boxes, mixed dimensions and missing fonts. Verify legibility and exact requested text at matched preview/export times.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **text layout and legibility**, using caption and title bounding boxes over previously accepted footage; underlying animation/layout are frozen. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If font or layout results differ by host, pin/retain usable dependencies or report the missing font. Do not silently switch fonts or hard-code a house caption style.

Delegated: Text rasterization API and internal glyph cache. Text, placement, typography settings and missing-dependency behavior are explicit.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

