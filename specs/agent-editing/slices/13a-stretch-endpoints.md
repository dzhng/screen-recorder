# 13a — Preserve selected speech at stretch endpoints

Status: Signalsmith numerical candidate reproduced; full-support plots, request-specific admission and guarded real-speech auditions prepared. The user accepts clarity/naturalness of the [complete familiar sentence at0.8×,0.9× and1.25×](../assets/13a-familiar-sentence/README.md), with slight0.9× echo explicitly tolerated. The [familiar internal0.8× join](../assets/13a-familiar-internal-join/listening.json) is also accepted. The [opening0.8× candidate](../assets/13a-short-word/listening.json) sounded complete and natural, but the subsequent [boundary check failed](../assets/13a-short-word/boundary-listening.json): its cut splits “Okay.” Whole-word short-speech coverage and protected word labels remain OPEN; correct the boundary before new rate auditions. Dependencies: the numerical reproduction in [13](./13-stretch-reproduction.md). This gate must pass before [14](./14-retiming.md) enables public stretching. The isolated [native parity prerequisite](13b-native-stretch-parity.md) may preserve the frozen recipe without claiming this acceptance.

The [pinned Signalsmith experiment](../assets/13a-signalsmith/README.md) passes
the measured count/pitch/source-isolation cases with explicit upstream endpoint
handling and exact unit-rate bypass. A separately measured short-window candidate
handles the tested 10 ms selections; some 5 ms cases remain unsupported. No
automatic preset/minimum-duration policy or speech-quality gate is accepted.

The [independent-review correction](../assets/13a-support-review/README.md)
supersedes the original experiment's censored support windows. Full admitted
output and isolated endpoint impulses are now measured; short-tone acceptance
requires an available estimate below the unchanged 1% pitch-error limit.
Corrected runs reproduce all original exact output hashes. Deliberate support,
octave and silent-output mutations fail, then the restored measurement tests pass.
The [endpoint verification pass](../assets/13a-endpoint-verification/README.md)
recovers hash-verified isolated outputs, tests admission boundaries separately
from pitch quality, and prepares real-speech joins with explicitly authored guards.
Its whole-utterance control has transcript provenance but no word times.
Listening, independently protected whole-word joins and short-speech acceptance
remain open; original reports/media remain historical evidence.

The [short-input alternative experiment](../assets/13a-short-capability/README.md)
finds a tone improvement with Rubber Band R3 short windows, but worse isolated
endpoint peak displacement. This research-only candidate is not promoted; selected
whole-word quality, licensing/adoption and the existing listening gate remain open.

## Contract and seam

Prepare a selected PCM range into its exact declared output sample count without
silently admitting excluded source material or dropping speech at either endpoint.
Keep this work in the standalone stretch reproduction until its output is accepted;
slice 14 then adopts the frozen preparation recipe through the shared job owner.
There is no second editorial timeline and no implicit source-range expansion.

## Evidence and next question

The [endpoint probe](../../../packages/test-harness/editing/stretch-endpoints.mjs)
and its [frozen measurements](../assets/13-stretch/endpoints.json) reject a universal
zero-padding plus fixed latency crop. Rendered impulse support can cross nominal
boundaries at both ends; first/last peak offsets differ and change with context.
Real neighboring samples also affect retained output. Their inclusion is not a
transparent implementation detail. A low discarded-energy fraction on one phrase
is not proof that a short final consonant survives.

Reproduce with a fresh scratch directory:

```sh
node packages/test-harness/editing/stretch-endpoints.mjs /tmp/stretch-endpoints-fresh
```

The current numerical candidate is the pinned Signalsmith exact recipe. Next judge
the [real-speech auditions](../assets/13a-endpoint-verification/README.md) and add
independent protected whole-word labels at both joins. Request admission must use
the actual selected/output counts and recipe, separate from quality acceptance.
The short-window probe does not authorize automatic window switching or a global
minimum duration. Keep the fixed pitch gate and selected-source contract.

The [familiar complete sentence](../assets/13a-familiar-sentence/README.md) supplies
clearly labeled original/slower/faster material for optional listening without
repeating unfamiliar word-fragment QA. Its numerical/native-file checks do not
establish word retention or naturalness, and do not enable public retiming.

## Acceptance

At 0.8×, 0.9×, 1× and 1.25×, preserve the exact compiler-declared output count,
less than 1% tone pitch error, bit-identical untouched neighbors, and independence
from samples outside the explicitly selected source interval. Measure first/last
impulse support, not only the largest peak. Deliberately poisoned excluded samples
must expose any accidental context admission. Include phase-offset cases and real
speech with independently labeled protected words at both joins. No clipped word,
intelligibility and naturalness require independent listening; the gate stays open
without it. Do not equate energy conservation with speech quality.

Freeze source/parameter/input/output identities and the compensation policy with
its failed alternatives. Compare against slice 13's raw outputs at matched inputs.
Keep the existing [preservation contracts](../verification.md) unchanged.

## Review surface

Judge endpoint support in aligned boundary waveform panels, using a ±100 ms crop
around each nominal join; global plot styling is outside this slice. Run
[compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md), followed
by unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md)
as the last visual check before acceptance. Show audition files and plots with the
existing non-blocking review workflow. Silence is not evidence of audio quality.

If no tested mechanism passes, record a failed gate and reslice the unresolved
preparation seam. Do not silently narrow the feature to whole-phrase speed changes.

The [familiar internal-join pair](../assets/13a-familiar-internal-join/README.md)
slows only the middle of the same complete sentence, preserving both neighbors
exactly. It is presented for the distinct local-transition listening gate; its
authored ASR-gap boundaries do not establish independent word labels.

The [remaining local rates](../assets/13a-familiar-internal-rates/README.md) and
[short-word packet](../assets/13a-short-word/README.md) fill the pending review
surface. Root independently verified retained file hashes, exact original spans,
selected-output identity and both deliberate pause insertions. Their numerical
checks pass; naturalness verdicts remain attached to their exact files. The
first boundary failed whole-word containment. Judge the
[revised boundary reference](../assets/13a-word-boundary-correction/README.md)
before preparing corrected selections.
