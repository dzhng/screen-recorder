# 13a — Preserve selected speech at stretch endpoints

Status: Signalsmith numerical candidate reproduced; listening, protected-word joins, short-input treatment and independent visual review remain OPEN. Dependencies: the numerical reproduction in [13](./13-stretch-reproduction.md). This gate must pass before [14](./14-retiming.md) integrates stretching.

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
Listening, protected-word joins, short-speech policy and visual acceptance remain
open; the original frozen reports/media are retained as historical evidence.

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

The next experiment compares explicit endpoint-preparation mechanisms against
these fixed inputs. Candidate implementation and bounded algorithm selection are
delegated; new source material, changed project duration, hidden speech truncation,
and silent quality-threshold relaxation are not. Test the existing FFmpeg candidate
as an alternate mechanism if native cannot meet the complete contract. Record its
distribution implications before selection.

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
