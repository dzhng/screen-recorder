# 13c — AAC and video assembly

Status: generated native feasibility checkpoint; **no production movie operation**.
The accepted video renderer and PCM stream remain the only production owners.
[Measured evidence](../assets/movie-assembly/README.md) distinguishes presentation
from decoder padding. Parent [13](13-edited-media.md) remains open.

## Contract and current result

The core's pinned kept-source plan drives both owners. Video retains exact
microsecond presentation; audio uses 13b's existing cumulative sample rounding.
AAC is lossy compression, so sample values need not be bit-identical after encoding.
There must be no systematic priming shift, accumulated drift, added ramp duration,
or reading of removed source samples. Acquisition gaps remain in track reports.

The candidate first renders video with `VideoRenderer`, then copies its compressed
H.264 samples into a final `AVAssetWriter` while `AudioPCMStream` feeds the AAC input.
No video decoding, PNG seeking, second mix policy or edit interpretation is added
by assembly. One actor owns the reader and writer. Two bounded pumps each retain
at most one block; while an input waits, the other can advance. Finishing waits
for both, and errors cancel the sibling pump before canceling the writer.

The movie clock must exactly represent both microseconds and audio samples: use
the least common multiple of one million and the resolved sample rate, refusing
an unrepresentable Core Media timescale. A microsecond-only movie clock rounded
an audio edit upward and exposed an extra decoded sample. The common clock avoids
that change without resampling or moving a cut. This is native timing policy,
not a new timeline owner.

The movie and video presentation duration stay exact. The audio track's quantized
end differs by at most half one sample, as already specified by 13b. Raw AAC
packet decoding can include codec padding beyond that end; a decoded array's
length alone is not the movie's playback duration. Independent FFmpeg summaries
also round stream duration to audio ticks. Report those facts separately rather
than introducing a broad drift tolerance. The probe compares native decoded
samples, track/edit metadata, independent decoded PCM and real muted AVPlayer end
notifications. It does not claim an audible or on-screen visual review.

### Supported consumer boundary

A retained nonzero 48 kHz sample in a 20 µs movie survives AVFoundation decoding
and the player ends at exactly 20 µs. FFmpeg emits no PCM for that movie. The
packet/skip metadata and nonzero values are retained in the report. Longer
fractional spans and ordinary clips align without a priming shift; changing all
excluded source samples leaves the retained decoded AAC unchanged.

This is not evidence of missing adjacent speech, nor a universal AAC requirement
for identical decoder arrays. The provisional internal integration decision is to preserve arbitrary
cuts and promote this candidate for the native personal-release playback route:
native presentation has the exact endpoint and retained nonzero samples. Record
the FFmpeg limitation for export/consumer documentation rather than adding a cut
minimum or dropping audio. Public export still owns its consumer contract. Do not
append audible padding or change PCM quantization to make one decoder green.

## Runnable checkpoint

Build the protocol/core packages and native `ScreenRecorderMovieTests` product,
then run `node --test helpers/mac/Tests/movie-render.test.mjs`.
`SCREENREC_MOVIE_EVIDENCE` retains generated files in a new empty absolute directory.
The executable is an optional probe, not another resident process, worker route,
or export format. Its code is a candidate to promote and remove from the probe
once the assembly contract is ready; production must not copy it into a second
implementation.

The suite uses real core plans, production video rendering, production PCM mixing,
and the production excerpt as the lossless numerical reference. It verifies
original, two middle cuts, fractional spans, mono/stereo and unequal rates,
offsets/acquisition gaps, silent movies and sub-sample movies. Compressed video
assembly must preserve decoded pixels and color tags. One explicitly named test
records the tiny AAC decoder discrepancy; its green result confirms the finding,
**not production readiness**.

## Next bounded passes

1. Promote one native assembly owner through the existing media worker and service
   attempt lifetime. Test deadline/abort during AAC pumping and finish, await actual
   child close before reclaiming attempts. Exercise video-pump failure while audio
   waits for readiness and preserve the primary error; observe cancellation during
   `finishWriting`, whose current await only checks before/after. Fence publication at the durable
   job owner. Preserve the thirty-second public excerpt limit.
2. Measure five-minute A/V synchronization and native peak memory at beginning,
   joins and far end, including sparse video, input AAC priming and container gaps.
   Exercise pinned mutation, undo, pause and failure cleanup in the real job path.
3. Run actual adjacent-speech audition separately from numerical generated-tone
   checks. Parent 13 still owns pointer rendering, app playback and public preview;
   export publication remains with its existing owner. No physical audio-device
   or speech-intelligibility claim follows from this checkpoint.
