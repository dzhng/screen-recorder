# 06 — Reproduce native multi-source rendering

Status: not started. Dependencies: [00](./00-corpus.md), [01](./01-composition.md).

## Contract

A frozen native reproduction proves that multi-source independent AV can be rendered without losing the existing presentation behavior.

## Seam and ownership

Feature-owned research entry point and evidence manifest, consuming slice 00 assets and the slice 01 time examples. Compare AVMutableComposition/custom composition with a generalized bounded AVAssetReader/CIContext path; FFmpeg is a comparator/failure alternative, not an assumed shipped dependency.

## Work and review surface

Reproduce documented native mechanisms before porting. Build A–B–A, replace video over retained A audio, and place another audio stream independently. Include VFR, hold/gap and non-zero range previews. Freeze a runnable winner, exact versions/settings and its complete requests/results for slice 07.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/render-reproduction.mjs --case av-replacement
```

## Acceptance

Decode frame counters at boundaries/interiors and detect expected tones/impulses. Compare short/full output membership, A/V offset within one output frame, truthful gaps and held tails. Record peak resources and real-time factor. Exact source membership is the decisive verdict, not subjective smoothness.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **temporal source membership**, using full frame-counter region across sampled times; typography, overlays and animation styling are out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If the native composition mechanism loses source timing, test the bounded reader path. If neither passes, reslice decoding/timing before production rendering; do not keep two production backends or silently drop VFR/holds.

Delegated: Candidate probe implementation. Selection must follow the recorded gates and be frozen before slice 07.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

