# 23 — Highlight the spoken word in the existing clock

Status: complete for explicit timed display mapping and bounded entrance curves through public/native still, preview and export. Depends on: [22](22-styled-text.md), [10](10-alignment-and-boundaries.md).

## Contract

Caption active-word style and bounded entrance motion follow exact word occurrences through cuts/repeats/retiming.

## Seam and ownership

Text seed/display run mapping, composition curve/support/temporal owner and native text renderer.

Current owners and starting checks:

- [packages/core/src/text-seeds.ts](../../../packages/core/src/text-seeds.ts)
- [packages/composition/src/source-projection.ts](../../../packages/composition/src/source-projection.ts)
- [packages/composition/src/curve.ts](../../../packages/composition/src/curve.ts)
- [helpers/mac/Sources/YapFrames/TextRaster.swift](../../../helpers/mac/Sources/YapFrames/TextRaster.swift)
- [skills/yap/scripts/caption-proposals.mjs](../../../skills/yap/scripts/caption-proposals.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Add explicit timed style runs with active/inactive fields and selected entrance/pop recipe. Resolve word mappings using pinned source/occurrence support, not rounded display seconds or a new subtitle clock. Corrected display words need explicit mapping; unmatched/partial fragments remain diagnostic. Native frame/preview/export use the same absolute phase. Preserve external alpha-overlay pattern for advanced treatments.

Overlapping estimated intervals activate their explicit mapped runs simultaneously;
do not manufacture sequential word durations to create a one-word highlight. If
the caller wants exclusive timing, it supplies verified explicit active windows.
Instantaneous observations need an explicit display duration/mapping to animate;
the renderer does not widen them into supposed speech support.

## Runnable checkpoint

### Frozen completion recipe

Entrance motion uses ordinary caller-authored geometry and opacity curves, not a
caption preset or a second renderer. The fixture requests a centered scale from
0.85 to 1 over the first quarter of the cue and opacity from 0 to 1 over its
first eighth, with linear interpolation and held final values. Both use the
existing normalized clip clock, so retiming scales the explicit treatment with
the cue and splitting preserves its original evaluation range. The half-open cue
support remains unchanged; a mid-window preview samples the full-project phase.
These numbers are verification inputs, never product defaults.

The draft helper emits timed UTF-16 runs only when the caller selects explicit
active/inactive highlight colors. Its literal correction for a selected row maps
to that row's retained source fragments; wrapped separators remain outside word
runs, empty corrections have no displayed run, and partial/discontinuous evidence
keeps its diagnostics. The seed still retains original words and raw estimates.

Freeze typography, background, placement and word windows across three arms:
static baseline, curve-authored candidate, and independently sampled numeric
geometry/opacity reference. Judge active colors first without motion, then motion
with the same word windows. Compare caption-only pixels and full receipts at
before/on/after word landmarks and entrance start/interior/end. Repeated and
retimed occurrences, dropped display words and split cues are explicit cases.
The public CLI/native gate also compares a preview beginning inside the entrance
against its matching full-project sample and committed export; encoded caption
pixels allow only the codec error bound, not a different animation phase.

Frame strips immediately before/on/after word landmarks and separate entrance-motion preview, including corrected trend text.

The active-word checkpoint is implemented in the composition compiler and native
text rasterizer. Authored `timedWords` retain UTF-16 text ranges and source-clock
half-open windows; compiled frames resolve those windows through the seeded
occurrence's exact source-to-project mapping and emit `activeRanges`. Overlapping
windows remain active together. Native CoreText applies inactive and active colors
to those exact ranges and echoes the highlight style and ranges in its layout
receipt. The focused composition test uses an astral glyph to exercise UTF-16
offsets, and `YapFrameTests --text-highlights` checks receipt fields plus rendered
active-color pixels. The completed [public timed-motion checkpoint](../../../packages/test-harness/editing/caption-timed-motion.mjs)
adds corrected/wrapped display mapping, dropped display words, retained overlapping
windows and explicit entrance curves. It also caught and fixed an actual public
boundary refusal: authored `timedWords` must be resolved and removed before native
delivery; only `activeRanges` cross that compiled-text boundary.

[Accepted evidence](../assets/23-timed-captions/README.md) retains compiled frame records,
receipts, all still/movie samples, independent numeric comparisons, red/green
proof, fresh image-only critique and code-review triage. Existing geometry/opacity
curves supplied the entrance behavior without another renderer or motion preset.
No exit animation, continuous between-frame smoothness or speech-model accuracy is
claimed by this declared-word fixture.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Two occurrences of same source, overlapping estimated word times, dropped word, split cue, retime and preview beginning mid-animation. The expected lexical active mapping and delivered colored glyphs must agree. Highlight timing passes before entrance motion is judged.

Variable A: active glyph timing, caption-only mask. Variable B after A: entrance rhythm at fixed word timing. Grade, typography and position stay frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Run/layout caching and reversible motion parameters within declared recipes; no hidden word rewriting or timed-style drift.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Exact word pins/display separation, ordinary undo/packages and single composition clock remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
