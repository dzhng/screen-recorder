# 19e — Retained audio excerpts

Status: complete; public lifecycle, exact PCM, portable origins, preservation and fresh skill-consumer gates pass. [Evidence](../assets/19e-retained-audio-excerpts/README.md). Parent: [19](19-voice-assets.md). Dependencies: [11](11-audio-inspection.md), [02](02-assets.md), [19e1](19e1-finite-audio-conversion.md).

The [finite conversion prerequisite](19e1-finite-audio-conversion.md) owns native
conversion of complete selected PCM. The [shared asset publication prerequisite](../assets/19e-asset-publication/README.md)
owns immutable byte publication. Public extraction shares selection rendering with
inspection and stores typed historical origins on ordinary assets.

## Contract and seam

`audio.extract` is the explicit durable-excerpt operation. Unlike full-output
`audio.prepare`, its completed asset does not own the donor project graph. It uses
existing source selectors (including acquisition support), or a required pinned
project revision and processing tap, plus an explicit rate/channel rendition.
Existing `job.retry` and `job.cancel` own retry and cancellation.

An explicit raw or processed audio selection becomes an ordinary immutable audio
asset, reusable as a voice reference, room tone or another edit. Extend/consolidate
the existing audio preparation seam; do not add a voice enrollment registry or a
second renderer. Preserve existing full-project prepared-output semantics.

Accept an admitted asset/stream/source-clock range or a pinned project revision,
range and existing processing tap. External files use asset.import; past-project
selections use the same pinned selection. Return a retained asset/stream, actual
sample count/rate/channels and typed extraction provenance. Output format is
explicit: voice uses mono24kHz Float32, ordinary excerpts retain their declared
profile. Reuse native selection/conversion and the composition temporal owner.

Already-canonical complete reference WAVs pass through without changing PCM or
header bytes for the frozen parity gate. Native conversion of other source formats
is a distinct measured operation, not promised to match the historical ffmpeg
reference. Do not silently normalize, trim silence or expand selected ranges.

Retain source dependencies while the job executes. At success retain the extracted
bytes; donor IDs/ranges/processing identity are historical provenance, not a reason
to retain the entire donor graph. The user can delete the donor after acquisition.
Use typed asset origins and preserve them in portable projects. Identical bytes may
have multiple origins; callers can identify the selected origin or carry the
explicit multi-origin set. Do not invent an origin from content deduplication.
The transcript remains explicit in the later frozen generation request; it does
not require a separate mutable reference object.

## Verification and review surface

Exercise raw/processed selections through public CLI/MCP, including source clocks,
gaps, exact canonical passthrough and stereo/non24k conversion. Inspect actual PCM,
counts and truthful provenance. Acquire references from a current project, external
file and past project, delete donors after success, restart and verify the retained
excerpts still play. Include equal audio with different extraction origins.

Use existing shared jobs and staged immutable asset publication. Cancel/crash must
not publish partial audio. Portable export/import retains the excerpt and required
provenance without donor availability. Keep asset import, prepared audio, processing
taps, resource deletion and package gates green. A playback artifact is not a
listening verdict; no automatic playback is required.

Delegated: internal publication refactoring within the existing asset owner. Public
selection clocks, processing semantics and historical versus owning dependencies
are fixed. User feedback on desired excerpt profiles updates this contract.

## Retention and finite-source decisions

The completed asset carries the chosen extraction origin; equal bytes may also carry
other origins. Those donor identities do not create dependency edges. The existing
job owns donor inputs only while executing and the resulting asset at publication.
Publication is unpinned to a filename because the result binds asset and stream IDs.

For an implicit complete raw source with zero origin, one fully available stream and
a verified Float32 WAV, actual WAV frames are authoritative. Matching profiles reuse
the entire original file; other profiles convert that complete file. Explicit ranges
and project taps use the common selection renderer. This prevents rounded
microsecond duration from discarding the last frame of odd-length reference audio.
Returned duration is floored from actual output frames, which remain authoritative.

The public evidence compares complete WAV bytes and exercises delivery after donor
deletion; it does not claim listening acceptance or ffmpeg conversion equivalence.
