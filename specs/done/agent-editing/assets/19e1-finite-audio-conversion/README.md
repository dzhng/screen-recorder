# Finite selected PCM conversion

The [native gate](../../../../../helpers/mac/Tests/selected-audio.mjs) exercises
`media.convertSelectedAudio` and its bounded PCM source without voice models,
live capture or playback. `evidence.tar.xz` retains actual native requests,
receipts, complete input/output WAVs and repeated-process comparisons. The receipt
reports authoritative input frames and rate, exact output frames and profile,
conversion identity, channel policy and selected-input context policy.

The output count is the checked integer floor of input frames times target rate
divided by input rate. All validated selected input remains permitted filter
context, including the odd final input frame that does not earn a whole output
frame. Converter phase persists across blocks. Existing source and composition
callers still use their original output-duration-derived decoder demand.

A 17-frame 48 kHz selection with its only impulse in frame 16 produces a nonzero
8-frame 24 kHz result. Deliberately restoring the old input truncation makes that
same assertion fail; `logs/context-red.log` preserves the failure. A shortened
16-frame zero source is also retained as a numerical control. The regular matrix
covers 24/44.1/48 kHz, one-frame and odd lengths, non-microsecond durations and
varied delivery partitions. Repeating the complete gate in a fresh process yields
identical WAV bytes for 65 fixtures. Ordinary conversion promises numerical PCM
and declared format, not equivalence to another resampler's WAV encoding.

Rate conversion preserves channels before channel mapping. Equal, left-only,
right-only and opposite stereo cases prove the explicit average. Summing in Double
and rounding once to Float32 avoids intermediate Float32 sum overflow without
clipping or normalization. Same-rate channels preserve numerical values, including
values outside [-1,1]. An exploratory stronger bit-pattern assertion exposed the
existing platform converter normalizing a signed-zero lane. Its failed logs are
retained; canonical original-file identity remains the separate verified-copy
contract in parent 19e, not a reason to introduce a new resampler here.

Poisoning excluded donor regions and acquisition gaps before source selection
leaves the entire converted WAV identical. The conversion takes only the completed
selected WAV; it never reapplies a contributor's gap mask to mixed output.
Filtering can spread selected neighbors into selected zeroes. This is permitted
context, not admission of excluded donor samples.

Lifecycle checks cover zero output refusal, empty/truncated input, invalid output
profiles, one consumption, bounded blocks, sink failure, cancellation before and
during consumption, non-finite output rejection, no partial publication and closed
WAV headers. Conventional input-layout validation is shared with SourceTrack and
its existing source-format gate. An attempted four-channel fixture was refused by
the existing WAV writer before conversion; it is retained as a fixture failure,
not counted as conversion coverage.

## Preservation and review

Existing source support/phase/late-window and finite-demand extension checks pass,
as do the native audio and composition suites, full music/replacement mix gate,
unchanged 10/300-second streaming gate and all 16 decoder-accounting cases with
the original enforced read-ahead bound. Their logs and reports are banked without
weakening thresholds. The streaming oracle remains its original sampled oracle;
this does not claim complete independent resampler parity or listening acceptance.

The isolated build reuses authenticated local dependency sources and builds its
own worker. The root frozen worker is unchanged. Build failures include an absent
local model-source link and test-expression type-check limits; no downloads or
model inference resolved them. `logs/archived-selected-build.log` and the successful
complete gate identify the actual final test build. The earlier wire/repetition
run after a failed test rebuild exercised the previous binary and is retained only
as intermediate evidence, not final expanded coverage.

Shape review retains one rate converter and one WAV writer; finite context is an
explicit case beside existing caller semantics. Diff review uses the shared decode
failure code for malformed WAVs. Independent Codex review found no actionable
code defects but could not verify runtime behavior inside its sandbox (compiler/
SDK and native-reader failures); the implementing agent's isolated build and gates
supply that evidence. Documentation review preserves the native-only boundary:
this is not public excerpt publication, original history recovery, ASR conditioning,
model acceptance or audible quality approval.
