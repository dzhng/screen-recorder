# 13c — AAC and video assembly

Status: production native assembly and shared service attempt lifetime implemented;
**no public preview route**. [Production evidence](../assets/movie-assembly/production/README.md)
records real worker/lifetime checks. Parent [13](13-edited-media.md) remains open
for long A/V verification, audition, pointer and app playback.

## One assembly owner

The core's pinned kept-source plan drives both native owners. `VideoRenderer`
retains exact microsecond presentation; `AudioPCMStream` uses the existing
cumulative sample rounding. AAC is lossy compression: sample values need not be
bit-identical after encoding. There must be no systematic priming shift,
accumulated drift, added ramp duration or reading of removed source samples.
Acquisition gaps remain in track reports.

`media.renderMovie` first renders video, then copies its compressed H.264 samples
into one final `AVAssetWriter` while the shared PCM stream feeds AAC. Assembly
adds no PNG seeking, second video encode, mix policy or edit interpretation. One
actor owns its reader/writer. Independent bounded pumps retain at most one block
each and yield while their writer input waits. A video-pump failure is shared
immediately with audio; both settle before output publication. Task cancellation
can cancel the SDK writer while its finalization call is suspended.

The movie clock represents microseconds and audio samples exactly: its timescale
is their least common multiple, with explicit refusal if Core Media cannot
represent it. A microsecond-only clock rounded an audio edit upward and exposed
an extra decoded sample. The common clock fixes that without resampling or moving
a cut; it is container timing policy, not another timeline owner.

Movie/video presentation duration stays exact. The audio track's quantized end
differs by at most half a sample, as already specified by 13b. Raw AAC decoding can
include codec tail padding beyond that end. Independent FFmpeg duration summaries
also round to audio ticks. Report those separately, not with a broad drift
allowance. The proof compares native decoded samples, track/edit metadata,
independent PCM, and actual muted AVPlayer end notifications.

## Native playback and export boundary

A retained nonzero 48 kHz sample in a 20 µs movie survives native decoding and
AVPlayer ends at exactly 20 µs; FFmpeg emits no PCM for that movie. Packet/skip
metadata and the nonzero values are retained in the
[initial evidence](../assets/movie-assembly/README.md). Ordinary and fractional
clips align without a priming shift. Replacing all excluded source samples leaves
the decoded retained AAC unchanged.

The provisional internal integration decision is to preserve arbitrary cuts for
native personal-release playback. Document the tiny AAC difference for the later
human-export/consumer contract; do not invent cut minima, drop retained audio,
append audible padding or change PCM quantization to satisfy one raw decoder.
No adjacent-speech or physical-device audition follows from generated tones.

## Service lifetime and metadata bounds

`withRenderedMedia` is the single service render-attempt owner. It accepts resolved
core video spans and optional acquired audio tracks. Omitted tracks retain the
real video-only worker path; provided tracks select movie assembly, including an
empty set for silent recordings. Acquisition planning belongs to the core, not
this adapter. The output receipt keeps the video contract plus optional audio
format, input frame count and availability reports.

Both routes use the existing one-call media worker and actual-child-close
boundary. Deadlines budget source-prefix video work and, when audio is present,
retained playback for AAC assembly, capped to the platform's safe timer range.
Abort/deadline/error reclamation happens only after terminal native work. The
consumer's durable commit must still fence or reconcile publication; this adapter
cannot undo its side effects or supply restart cleanup for future jobs.

Internal PCM metadata limits now match the renderer's 10,000-span bound and allow
10,000 acquisition intervals per track. Ordered overlap planning advances a cursor
rather than multiplying those limits. Public excerpts remain at 1,000 spans,
1,000 acquired intervals and thirty seconds. Plans beyond the internal limits
fail explicitly; paging/chunk execution remains necessary before claiming
unlimited revision history support.

## Next bounded passes

1. Measure five-minute A/V synchronization and peak native memory at the beginning,
   joins and far end, including sparse video, input AAC priming and container gaps.
   Preserve sample counts, original bytes and the same resolved core plans.
2. Use this attempt owner in the real pinned preview job: mutation, undo, pause,
   durable publication and restart reconciliation, without another process owner.
3. Perform actual adjacent-speech audition separately from numerical generated
   checks. Parent 13 owns pointer rendering, app playback and public preview;
   human-export publication retains its existing owner and consumer caveat.

Build protocol/core/service and native `screenrec-native` plus
`ScreenRecorderMovieTests`; run `movie-render.test.mjs` and
`packages/test-harness/movie-lifetime.mjs`. The optional target now exercises the
production owner rather than maintaining another assembler.
