# 13a — Preserve selected speech at stretch endpoints

Status: accepted for the frozen Signalsmith exact recipe and named source selections. Numerical count/pitch, full impulse support, identity and excluded-source checks pass. The user accepts the familiar complete sentences and all four [corrected A–D local selections](../assets/13a-corrected-selections/listening.json) for complete words and natural joins. The [visual supplement](../assets/13a-visual-clarity/README.md) resolves the earlier readability findings; its [review](../assets/13a-visual-clarity/review.md) distinguishes fresh full-image review from corrected-crop fallback inspection. [Root verification](../assets/13a-visual-clarity/root-verification.md) checked all86 retained artifacts and64 reconstructed PCM hashes. Dependencies: [13](./13-stretch-reproduction.md). [14](./14-retiming.md) now owns production integration, stereo, long-run preparation and explicit pitch-follow verification. Acceptance does not establish arbitrary tiny selections or automatic boundary expansion.

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
Its then-pending listening and word-containment gates are resolved by the corrected
selection packet linked above; original reports/media remain historical evidence.

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

The accepted implementation is the pinned Signalsmith exact recipe. Adopt it
through the shared preparation owner with matched-input parity. Request admission
uses actual selected/output counts and the recipe, separately from quality
acceptance. The short-window probe does not authorize automatic window switching
or a global minimum duration. Keep the fixed pitch gate and selected-source
contract. The corrected placement protects complete word groups; the earlier
cut that split “Okay” remains a failed historical selection.

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
original first boundary failed whole-word containment. The user accepts the
[revised boundary placement](../assets/13a-word-boundary-correction/listening.json);
the [corrected candidates](../assets/13a-corrected-selections/README.md) have their own explicit A–D listening PASS, independent of old verdicts.
