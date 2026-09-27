# 06 — Reproduce native multi-source rendering

Status: reproduction implemented and frozen, 2026-09-27; bounded temporal mechanism selected, independent visual/code review confirms the demonstrated temporal cases. General untagged-input color policy remains open. Dependencies: [00](./00-corpus.md), [01](./01-composition.md).

The [frozen report](../assets/06-render/report.json) records nine cases, exact
requests, source/code/output hashes, versions, decoded counters, PCM and resources.
The bounded reader/CI/writer passes every temporal/duration/refusal gate. Standard
AVMutableComposition video export shifts the nonzero preview, holds a picture
through an explicit empty edit, and truncates the subframe/VFR tail cases.
Independent AVAudioMix output equals the WAV-derived float PCM oracle exactly;
final PCM16 stays within one quantization step, and measured impulse offsets are
zero. Worker peak RSS is recorded per case, not claimed as long-project evidence.

The original corpus is unchanged. Separately hashed tagged derivatives declare
the generator's known source color interpretation. Their red landmark survives
within the unchanged four-level RGB tolerance. Original untagged raw BGRA,
guessed native color metadata, default CI conversion and explicit sRGB diagnosis
are recorded separately; no generic camera-footage color assumption is adopted.

The [reproduction notes and preservation map](../../../packages/test-harness/editing/RENDER-REPRODUCTION.md)
define the selected mechanism and adoption limits. The full driver and frozen
verifier pass; the negative test rejects a corrupted movie and a failed temporal
verdict. JS lint/format checks pass. No production executor, installed app, capture,
playback or listening acceptance was changed or exercised. Slice 07 must preserve
these matched-input observations and keep the open production color policy explicit.

The [native color follow-up](../../../packages/test-harness/editing/COLOR-REPRODUCTION.md)
separates preservation of platform-decoded appearance from lossy encoding. Its
frozen tagged, untagged, rotation and recorded-fixture evidence supports the native
conversion path; intended untagged color and a production encoding-quality profile
remain unaccepted. The unchanged whole-pixel gate still exposes encoding loss.

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

The [independent full-set color critique](../assets/06-color/visual-review/README.md)
confirms native conversion and finds visible low-bitrate encoding artifacts. All
four frozen color/render oracle checks pass on the integrated tree; production
Rec.709 rendition/profile acceptance remains open.
