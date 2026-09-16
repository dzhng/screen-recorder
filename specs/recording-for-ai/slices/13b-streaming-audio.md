# 13b — Bounded retained audio stream

Status: bounded stream implemented and numerical/lifetime gates verified. See the
[comparison and scale evidence](../assets/streaming-audio/review.md). Parent
[13](13-edited-media.md) still owns AAC/video integration, pointer, public preview
and the complete audible editing journey. No speech audition was performed; that
gate remains explicitly open. This slice does not choose an ASR engine.

## Current pickup

The excerpt writer now consumes `AudioPCMStream`, the sole mixer. Its resolved
format, exact frame count and bounded blocks are ready for an AAC consumer. All
25 retained baseline WAVE fixtures have byte-exact PCM/format chunks; five-minute
output and held/canceled/failing sinks pass the recorded checks. Source priming is
also checked against an independent AAC decoder. This is not AAC encoding or A/V
mux proof. The public excerpt limit remains thirty seconds.

Next, specify and verify the AAC/movie sink using this backpressured lifetime and
the existing job attempt owner. Preserve original acquisition-gap metadata, and
keep adjacent-speech audition and five-minute A/V drift open until actually observed.

## One question and owner

Can the existing retained-audio execution produce the same samples and gap reports
without allocating memory proportional to the movie duration?

[AudioExcerpts](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioExcerpts.swift)
previously bounded decoding/conversion buffers but accumulated the entire mixed
output in a Float array. The implemented PCM stream removes that duration-sized
allocation. The excerpt writer and later movie encoder consume this one owner;
the thirty-second public inspection limit remains a separate API policy.
PCM means decoded numeric sound samples before compression.

The input remains the core's resolved ordered source spans and acquired track plans
(role, file, source offset, available intervals). Before consumption, the owner exposes the resolved output PCM format (sample rate,
channel layout and Float sample representation), exact total frame count and
quantized duration. Consumers never reconstruct format policy from input reports.
The output is a finite stream of bounded interleaved sample blocks with cumulative
playback frame positions and explicit valid frame counts, plus the existing
per-track availability report. The final block may be shorter than its capacity;
unfilled capacity is never emitted as padding or added duration. Buffer capacity and internal API
names are delegated. Memory may grow with the bounded plan metadata, never with
retained audio duration. Consumers apply backpressure: when the writer cannot accept
a block, decoding waits rather than accumulating a queue of blocks.

Keep the current excerpt API, lossless WAVE output and 30-second public limit. An
internal native harness may drain the stream to a longer temporary WAVE for proof;
that is neither a third export product nor a new public inspection route. The
production consumer introduced here must be the existing excerpt writer, not a
parallel demonstration-only mixer.

## Preserve the existing audio contract

The shared layout owner quantizes cumulative playback boundaries into audio sample
positions. Reuse that mapping for every block, source interval and join: never
round each block or span independently. Sample-rate conversion must retain its
state across output blocks. Do not reopen, seek or restart a converter at every
block; that changes phase, priming and tails at boundaries that are not edits.
Source-span and acquisition-gap boundaries remain explicit reset/read boundaries.

Retain current rate/channel policy, explicit mono-to-stereo mapping, unity gain
for one acquired track and 0.5 per track when both are present. Missing acquired
intervals contribute silence with unavailable metadata; they are not evidence of
recorded silence. Decode only the intersection of acquired intervals and occupied
container segments, respecting per-track offsets and codec priming/padding.

Apply the existing at-most-5ms ramps inside each retained span, clamped to half a
short span. The first outer edge does not gain an invented fade-in, nor the final
edge a fade-out. A block boundary introduces no ramp. Ramps neither overlap spans
nor add duration. No normalization, denoising, semantic cuts or new mix defaults.
Keep unknown/short decoded coverage an explicit failure rather than filling it
silently. Preserve both input files and the original recording timeline.

The existing worker owns process lifetime. Check cancellation and bounded forward
progress during reads, conversion and sink waits; errors terminate readers and
release buffers. Output publication and cleanup use the established attempt owner
when integrated with jobs; this slice must not introduce another process or queue.
A sink failing after several blocks must leave no completed output receipt.

## Runnable proof and acceptance

Use `swift run --package-path helpers/mac ScreenRecorderAudioTests` and
`node --test helpers/mac/Tests/audio.test.mjs`, extending the native harness with
generated streaming fixtures and independent PCM inspection.
Before replacing the old implementation, retain comparison receipts from its real
outputs for the accepted excerpt cases. Compare the streamed production excerpt
against those samples and metadata, not against a second reimplementation of the
mix formula. If a difference exposes a real old bug, prove the corrected consumer
contract and retain that explanation instead of blindly repinning a baseline.

Required cases include two tracks at different rates, mono/stereo, positive and
negative offsets, leading/internal/trailing acquisition gaps, true container gaps,
codec priming, cut joins on both sides of an output-block boundary, fractional
spans, sub-sample retained spans and many cumulative cuts. Keep all existing native
and public audio tests green, including explicit retry and source immutability.

Measure a generated short input and a five-minute input at the same format. Record
peak native RSS, output frames, decoded duration and source hashes. Demonstrate
bounded buffers under a held sink, then cancellation and sink failure, without
unbounded queue growth or surviving workers. Compare selected windows near joins
and far into the long output; count all output samples to expose truncation.

Retain a small playable audio artifact and the machine-readable report under
`assets/streaming-audio/`. Listen to the existing source/edited audition fixture
through the shared execution; report numerical checks and actual audition separately.
Generated tones alone cannot prove adjacent speech remains intelligible. If actual
audition is unavailable, keep that parent acceptance gate open and explicit.

## Remaining parent work

This seam supplies audio to the movie encoder; it does not prove AAC priming,
multiplexed A/V duration/drift, five-minute audiovisual synchronization, pointer
rendering, app playback or public preview/export. Materialize those next contracts
from the accepted stream and 13a artifacts before broad integration. Source and
package gap evidence must remain available even when an opaque movie represents
missing audio with silent samples. Exact cut policy remains owned by the core.
