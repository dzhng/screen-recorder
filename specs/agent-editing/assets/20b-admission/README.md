# CaptureClock admitted PCM candidate — bounded prototype

The phase/address method lives at the existing CaptureClock owner. **Production
CaptureWriter does not call it.** The method is for successfully accepted buffers:
failed/backpressured appends must not establish a phase or advance its state.
The prototype caller demonstrates first-accepted behavior; actual writer transaction
integration and exact journal records remain 20b work, not a shipped recording fix.

One per-role phase rounds the first relative source anchor to microseconds, nearest
with ties away from zero. Exact integer arithmetic classifies later positions on
that phase's native sample grid. Sample counts remain exact, and no later residual
moves the phase. Existing CaptureClock origin/pause eligibility supplies control
semantics; this pass does not redefine rational video-origin admission. Overlapping
positions refuse without advancing state. No second clock or generic exclusion API.

## Evidence and correction

Run `node packages/test-harness/editing/capture-pcm-admission.mjs --out EMPTY_DIR`.
It builds the existing native test/CameraReproduction targets, reads prerecorded
sources and invokes no live capture APIs. The test-owned mode is opt-in; the default
capture suite still runs and remains the preservation gate.

Controlled 44.1/48k timestamp groups of 1024 and 8192 samples produce identical sample
addresses and one run, rather than one run per callback. Nonzero origin/residue,
half ties, whole-buffer omission, pause-crossing rejection and overlap refusal have
explicit checks. The owner-computed omitted-buffer placements feed the banked sparse
materializer: actual full PCM and the late window agree, selecting original sample
52800 at 1.2s. This is an actual reader result, not a string receipt alone.

The first `initial-interpretation.json` incorrectly called a raw 1us timestamp
perturbation a supplied gap. The input had no support exclusion. Under the candidate,
that sub-sample residue classifies adjacent; it does not prove loss of an authored
exclusion. The old report is retained with this correction, not repinned as success.

The corrected test supplies the existing reader's real acquisition mask with a 1us
hole. Its unavailable receipt preserves that hole; exactly the corresponding nonzero
output sample becomes unavailable/zero in the convenience WAV and all other PCM is
unchanged. No silence is added to canonical media. Physical support and explicit
acquisition masks remain separate existing owners.

## Candidate support and remaining gates

Candidate capture support S is the union of successfully admitted sample intervals
[A+j/r,A+(j+N)/r), clipped to proven committed payload. Existing explicit external
acquisition/selection masks intersect S unchanged. Rejected buffers add no accepted
sample identities or support. Address skips carry holes; pause removal precedes
classification. New-layout journal support must come from these same admitted
addresses rather than mixing old per-buffer rounded raw support with new placement.
This is a declared admission policy, not a claim of raw-host equivalence.

Public microsecond support projections, resampled/mixed-rate output, format changes,
long-take residual drift, fractional editorial boundaries, actual append/journal
transaction failure, normal/crash-prefix recovery and production publication remain
unverified for this candidate. No writer rollout, source migration or 20a closure.
The retained worker/source hashes bound the result to this prototype. The earlier
support-interpretation report and native preservation log remain visible alongside
the final proof, including limits; passing this tracer does not satisfy all 20b gates.

Independent read-only review found no actionable defects within this scope. It
checked signed rounding, fixed-phase state, control handling, grouping assertions
and sample/mask comparisons; production integration and broader gates remain open.
