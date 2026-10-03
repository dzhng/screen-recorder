# Current AAC mixed full/range case

One current-worker case passes exact PCM agreement between the complete two-second
mix and its fractional range. The retained 44.1kHz mono AAC overlaps the same
retained 48kHz stereo reference. Both complete WAVs and raw native replies are
banked before comparison. No source was regenerated and no tolerance, shift,
decoder, cache identity or processing recipe changed.

The [report](report.json) pins the worker, host, inputs and original/current
requests. The worker is the frozen `8a0c7732…` binary. Only the two referenced
asset pathnames, output pathname and request identity change; unused manifest
entries remain unchanged. The probe deep-compares each relocated request against
its original after reversing pathname relocation. It invokes the actual
`media.mixCompositionAudio` owner once for the full 96,000 stereo frames and once
for `[5925,86992)`, retaining all 81,067 range frames. Both processes exit zero;
their complete PCM comparison has zero differing samples.

The archived `6663e0c1…` `mix-verified` full/range pair is independently rechecked
from its retained bytes: 4,530 scalar samples differ, maximum
`5.960464477539063e-8`, RMS `3.1973591513322384e-9`. Current full PCM matches that
historical full PCM; current range matches its full slice and differs from the
historical ranged output. The earlier failed independent-sum run is also still
retained in the parent archive. Nothing here establishes why the historical
invocation differed. The separate eight-process source cohort remains source-only
evidence and is not relabeled as mixed-output coverage.

The [archive manifest](archive.json) authenticates every file in
[captures.tar.xz](captures.tar.xz), including the executed probe, unchanged inputs,
both historical/current pairs, original/relocated requests and raw stdout/stderr.
The executed probe takes repository root and a fresh output directory; it uses
the parent's retained archive and refuses a worker whose hash differs. Its native
timeout is the existing 30 seconds. No builds, installation, models, playback or
additional repetitions occurred. The camera owner released the native lane before
execution; both children were reaped before that lane was released again.

Shape/diff/docs review keeps this as retained evidence, with no production owner,
API or dependency added. Independent Codex review verified archive membership,
hashes/sizes, report consistency, exact current full/range PCM and the historical
nonzero comparison: no actionable defects. Its artifact-only review did not run
the native worker. The final archive also retains the review log.

## Completion boundary

This closes the named current-worker mixed full/range evidence gap identified by
the read-only 08 audit. Together with existing gain/channel/gap/selected-input,
mixed-rate/format, bounded delivery, cancellation/restart, thirty-minute drift and
the accepted public 12d narration-join evidence, it supports scoped completion of
08's stated contract. Root owns the checklist decision.

Preserve the historical AAC red, unknown causal mechanism and lack of general
bitwise decoder determinism. Actual negative occupied-origin media remains
unverified; the retained construction attempts normalized or refused it. No
universal codec/rate claim follows from representative coverage. Accompaniment
perceptual balance has not been heard, and this pass supplies no such judgment.
Retiming, speech-boundary/inventory quality, denoise/voice listening, broader
scale and final workflow acceptance retain their own owners and open gates.
