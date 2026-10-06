# 13 — Freeze a trustworthy decoded-picture recipe

Status: planned. Depends on: [01](01-certified-corpus.md).

## Contract

Picture comparisons identify actual pixels, presentation time, orientation and color interpretation instead of assuming FFmpeg equals the player.

## Seam and ownership

YapFrames color/source/composition executors and existing encoded-appearance reference labs.

Current owners and starting checks:

- [helpers/mac/Sources/YapFrames/VideoColorPolicy.swift](../../../helpers/mac/Sources/YapFrames/VideoColorPolicy.swift)
- [helpers/mac/Sources/YapFrames/SourceImageRenderer.swift](../../../helpers/mac/Sources/YapFrames/SourceImageRenderer.swift)
- [packages/test-harness/editing/COLOR-REPRODUCTION.md](../../../packages/test-harness/editing/COLOR-REPRODUCTION.md)
- [packages/test-harness/editing/output-quality-decode.swift](../../../packages/test-harness/editing/output-quality-decode.swift)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Replicate project AVFoundation sampling and current native/FFmpeg paths on matched frames. Retain actual sample timestamps, raster dimensions, transfer/primaries/matrix/range/profile and conversion recipe. Fix silent skipped-frame coverage and named count claims. Freeze one player-oriented observation recipe, permitted differences and supported profiles before metrics/grade consumers. Reuse native source reads for imported exports.

## Runnable checkpoint

Matched native/player-oriented/FFmpeg frame triptych and measured discrepancy report with asymmetric controls and real walls.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Pixel comparisons match timestamps/orientation/color transform first. Untagged source interpretation stays explicit. Failed decode samples appear in coverage, not a successful frame count. Encoded loss remains separate from source interpretation.

Variable: decoding/color interpretation. Mask: full oriented raster plus asymmetric chart patches; authored grade and geometry are frozen.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Declared observation-space choice and tolerance justified by matched reproduction; freeze before production consumers.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Existing SDR/HDR admission and same-source appearance semantics remain green; no undocumented decoder fallback.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
