# 09b — Native audio excerpts of retained source spans

Status: native execution and generated-media verification complete; the excerpt has
not been auditioned. Independent prerequisite: native workspace (00).
This extracts 09's audio-excerpt seam, under 13's join contract, so generated media
can verify it while revision lookup, caching and scheduling proceed elsewhere.
It does not close 09 or 13, and claims nothing about audible quality.

## Contract

A Swift audio owner accepts one or two immutable source files, each with the
recording source time of its own time zero, plus the ordered retained source spans
the TypeScript timeline already resolved. It concatenates exactly those spans and
writes one excerpt file. It never resolves recording IDs, reads the library,
schedules work, infers an edit, or moves a requested boundary.

Times are safe integer microseconds. Spans are half-open, strictly ascending and
non-touching: adjacent intervals would already have been unioned into one retained
span, so a touching pair would ramp a join no cut created. Their total is capped at
the contract's 30 seconds, and the span count at 1000.

One planned track plays at unity gain; two are summed at 0.5 each. Output sample
rate and channel count are the widest of the planned tracks, so nothing is
resampled downwards or dropped; a narrower track feeds every wider output channel
rather than one side. Each track is decoded at its own channel count and mapped
explicitly, because the platform's remix matrix would silently restate the gains.

Linear ramps of at most 5 ms sit inside the retained spans on both sides of every
join, clamped to half of a short span so two ramps never overlap and no span loses
a frame. The excerpt's own first and last boundaries are the request's edges, not
cuts, and are not ramped.

The result states the actual output sample rate, frame count, duration and byte
count, plus each track's own rate, channels, applied gain, and the intervals of the
requested spans for which it holds no media. Absence is decided from the edit list,
not from the samples: AVFoundation reads an empty edit back as silence, which is
indistinguishable from recorded quiet. A fully unavailable excerpt is a success
whose report covers every requested span, never a silent file that implies capture.

Output is 32-bit float PCM in WAVE, named by a caller-allocated `.wav` path. It is
written to a staging file and moved into place, so a failed write leaves neither a
truncated excerpt nor litter. Source media is never opened for writing; an output
that resolves onto a source, including through a directory symlink, or onto an
existing directory, is refused before any decoding.

## API seam

`ScreenRecorderAudio` owns execution; `AudioOperation` owns the `media.audio`
request boundary, mirroring `ScreenRecorderFrames` and `media.frame`.

```json
{
  "id": "excerpt-1",
  "operation": "media.audio",
  "params": {
    "output": "/absolute/derivative/excerpt.wav",
    "spans": [{"startUs": 1000000, "endUs": 1500000}, {"startUs": 4000000, "endUs": 4250000}],
    "tracks": [
      {"role": "narration", "source": "/absolute/source/narration.mov", "sourceOffsetUs": 0},
      {"role": "system", "source": "/absolute/source/system.mov", "sourceOffsetUs": 250000}
    ]
  }
}
```

Roles are `narration` and `system`, at most one of each; the separate-track and mixed
excerpts differ only in how many tracks the plan names. Failures use the shared
envelope with `INVALID_REQUEST`, `INVALID_RANGE`, `INVALID_OUTPUT`, `LIMIT_EXCEEDED`
and `NATIVE_DECODE_FAILED`.

## Implementation evidence and verification

`AVAssetReader.timeRange` was confirmed against real files to be asset time that
honours a track's edit list, and to report asset-time presentation stamps. The
excerpt therefore reads each available interval as its own bounded range: material
outside the retained spans is never decoded, rather than decoded and discarded.
Track availability comes from the same `ScreenRecorderMediaTime` segment mapping the
frame decoder uses.

Generated float PCM fixtures state their own position: each channel carries a
distinct frequency, a monotonic amplitude envelope makes two source positions a
whole number of tone periods apart distinguishable, one region holds full-scale
material no retained span includes, and one holds recorded silence. The excerpt is
compared sample by sample against an expectation stated from those definitions, and
the WAVE file is parsed from its own chunks rather than through the writer's API.

Verified: exact frame counts and placement across disjoint spans; positive and
negative source offsets; unity and half gain, measured per tone; widened rate and
channel count with a mono track reaching both channels; linear ramps, their clamp on
6 ms spans, and unchanged duration; empty edits reported unavailable while recorded
silence stays available; the 30 second bound at and one microsecond past it; twenty
refused requests leaving the source bytes unchanged. The worker test drives the
process, compares against independently decoded source samples, and shows a
structured failure does not poison later calls.

Every central claim was falsified once by breaking the implementation: shifted
placement, contiguous reads across a cut, fabricated availability, ramps that shorten
the timeline, unity gain on two tracks, and a mono track confined to one channel.
Independent review found a trap on the most negative source offset, which killed the
worker before validation could reject it; that is fixed with red tests at both the
library and the process seam. Reviewer sandboxes cannot decode media, so their
runtime checks are not evidence; root ran the suites outside the sandbox.

## Not verified here

No human has listened to an excerpt. Numerical agreement is not an audible-quality
claim, and the ramp length remains a stated contract rather than a measured one.
Real captured narration, mixed-rate resampling fidelity, and joins around speech
belong to the owning audition gate in 09 and 13.

## Decisions delegated and scope firewall

Reader granularity and PCM container details are delegated within these invariants.
Times, limits, gains and ramp behaviour are fixed by
[contracts](../contracts.md#audio-and-human-output). Human H.264/AAC video export
stays in 13; this pass adds no timeline, cache, worker pool or second media owner.

One AVAssetReader is created per available interval. That is bounded by the 30
second cap and cheap for uncompressed sources, where every frame is independently
addressable; a compressed source would make `reset(forReadingTimeRanges:)` worth it.

`SourceSpan` and `AudioFailure` deliberately restate `FrameInterval` and
`FrameFailure`, and the wire's two operation branches are near-identical, because
this pass may not edit the frame decoder. Promoting one interval type and one
failure protocol into a shared owner, and collapsing the wire branches onto it, is
the first cleanup for whichever pass may touch both.

## Stay green and feedback

`swift run --package-path helpers/mac ScreenRecorderAudioTests` and
`node --test helpers/mac/Tests/audio.test.mjs`, both registered in the Mac package's
default test command. Keep the capture and frame suites green. Tests must pin the
stated contract, not the arithmetic that implements it; full-suite closeout belongs
to slice 15.

If an audition finds a click at a join, distinguish the ramp contract from the span
the core resolved before changing either; never widen a boundary the agent asked for.
