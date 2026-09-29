# Native capture and media

This Swift package holds everything that must run natively: capture under the app's stable
identity, and the bounded media worker the service spawns for decode, render, recovery and
package storage. [Package.swift](Package.swift) is the roster of targets; the rule for what
belongs where is:

- **ScreenRecorderCapture** is the only library the app links. It owns device state, source
  selection, the capture clock, media writers, the acquisition journal and cursor geometry.
- **ScreenRecorderMedia** holds primitives every native owner shares and that must not drift
  between them: how a media file or inherited handle is opened, how asset time maps to media time,
  the half-open microsecond span, the one failure type and new-output publication.
- **ScreenRecorderFrames** and **ScreenRecorderAudio** decode, draw, mix and encode exactly what
  they are given. They never interpret edits, choose cursor history or decide cuts: the timeline,
  trail and scene owners live in `packages/core`.
- **ScreenRecorderWire** is the worker boundary: request decoding, the operation table, and the
  operations that exist only in the worker (recovery, evidence export, archives, storage).
- **ScreenRecorderNative** is the `screenrec-native` executable around that boundary.

## Compiled video

Composition rendering consumes the compiler's frame stream, including the original
sample time and clipped visible interval. Native code only resolves physical
sample support and executes pixels; it never reconstructs cuts or frame phase.
The [video renderer](Sources/ScreenRecorderFrames/CompositionVideoRenderer.swift)
shares source support and orientation with existing delivery. Its wire reader
consumes bounded JSONL records, and publication uses the existing new-file owner.
A compiler-excluded source picture becomes background after native validation of
its exact stream and physical timestamp, even when that occurrence's acquisition
mask excludes existing samples. Physical empty edits also become background;
unknown physical timing and unavailable attached ancestors still refuse. Decoder
reuse remains keyed by media, while the exclusion applies to each compiled picture. Profile adoption evidence belongs to the
[editing spec](../../specs/agent-editing/assets/07-video/README.md).

## Capture timing

All delivered tracks use the ScreenCaptureKit host timestamp domain. The first complete video
sample establishes source zero, and samples before it are omitted. Pauses remove real elapsed time
from every track, including late samples delivered after resume; an audio buffer that intersects a
pause boundary is omitted rather than letting speech recorded during the pause through. Omission is
counted separately from dropped samples: dropped means writer backpressure, and intentional pause
omission is not an encoder stall.

Video is H.264 in MOV at a microsecond timescale; narration and system audio are separate float PCM
MOV files. System audio is requested at 48 kHz stereo from a separate whole-display stream, so
selecting a window cannot narrow audio to that application, and it excludes the recorder. The
microphone keeps its device rate and channels. Nothing is resampled or mixed at capture. A
submitted buffer can extend past the clipped file end, so submitted-sample statistics are not
decoded availability.

Missing requested tracks and stream failures return an interrupted take, never complete media. A
healthy unchanged tail holds the last available frame through the stop boundary and reports how
long it held. Stopping routinely lands while the encoder drains, so the held frame waits for the
writer input to accept it rather than reading backpressure as a broken take; only a writer that
stopped accepting samples, or never drains within a bounded wait, truncates the take. An
interruption stops at the last available sample rather than inventing tail media.

Hidden and minimized windows remain valid sources, and ScreenCaptureKit can deliver blank frames
for them; these are preserved as delivered, not classified by pixel color. A closed window its
application retains can be indistinguishable from a hidden one, so destruction is taken only from
ScreenCaptureKit's delegate signal. On that signal, or any stream error, the native owner seals the
clock and writers immediately and notifies `onInterruption`; the app's capture controller ends the
take through the same joined stop or discard, so interruption never owns a second teardown. The
take's identity comes from the service: `sourceId` is what the journal header records, while the
session's own generation guard keeps a superseded session from interrupting a later one.

The app never requests permission or starts capture at ordinary launch. Preflight only reads
authorization; an explicit permission action invokes the macOS authorization API without starting
capture, so a fresh install can request access before System Settings shows the toggle. Denials
still require the user's decision in System Settings.

Writers emit movie fragments while recording, so a crashed process leaves a decodable prefix. The
first fragment bounds the vulnerable opening; a crash before it can leave no usable video. These
are process-crash guarantees, not power-loss durability.

## Acquisition journal

[CaptureJournal](Sources/ScreenRecorderCapture/CaptureJournal.swift) owns ordered acquisition
evidence beside the media. Each event's name, payload type, validation and durability live in one
place, so the writer and every reader decode the same record the same way. Boundaries a recovery
needs to place the take in time are synchronized when written; per-buffer audio ranges, geometry
and cursor batches are ordinary writes whose file order still puts an epoch before the samples
citing it. Reported device transitions are records too, so the sequence a live report carries is
the sequence the file holds.

Records are numbered from one without gaps, and a record that could not be encoded or written does
not consume a number. A reader keeps the valid prefix and reports where the file stopped being
believable, in one of two ways that mean different things:

- `incompleteTail`: the last line has no terminator. That is a crash boundary.
- `invalidAtSequence`: a record will not decode through its written type, breaks the numbering, or
  is an unterminated run longer than any record the writer produces. That is corruption, and
  nothing after it is believed.

A clean ending alone does not mean a take finished. `inspect` accumulates completed pauses and
audio ranges for recovery; `streamEvidence` delivers them through callbacks without retaining
timing arrays, because a take samples the pointer sixty times a second.

## Cursor sampling and geometry

[CursorGeometry](Sources/ScreenRecorderCapture/CursorGeometry.swift) owns pointer sampling and the
source transform. The sampler reads `NSEvent` pointer state on its own queue at a 60 Hz cadence only
while a take records: no event tap, keyboard observation or Accessibility authorization. Its
handoff to the capture queue is bounded, so a queue that falls behind refuses and counts readings
instead of queueing without limit, and missed ticks are reported, never filled with movement nobody
observed.

AppKit reports the pointer in a bottom-left space anchored to the display at the global origin,
which is not necessarily `NSScreen.main` (that follows the key window). Readings convert through
that display's height, and each take journals the height whenever it changes, so a consumer checks
a reading against the height the recording used rather than today's display arrangement.

Geometry comes from each delivered frame's own `SCStreamFrameInfo`, including idle and blank frames
whose pixels are never written. `contentRect` places content in the surface in points,
`scaleFactor` converts surface points to output pixels, and `contentScale` is the source-point to
surface-point ratio: a window that grows past the surface is letterboxed rather than rescaling the
take, so fixed output dimensions do not imply fixed source geometry. Measured on this host, a
window's `screenRect` is its frame in global display points with a top-left origin, including on a
display whose global origin is negative. Display and region captures fall back to the request's own
global rect, a fallback not yet measured against a display or region take; if such a frame does
report a screen rect, the frame wins.

Geometry that differs from the current one opens the next epoch, and every sample cites the epoch
it was projected through. A reading is projected through the geometry in effect when it was taken,
not when it was written: frames report placement milliseconds after the moment they describe, and
the sampler enqueues independently of frames, so only a reading the track has been handed lets
earlier geometry be forgotten. Retention is also bounded by count, because a paused cadence stops
that watermark. A sample no retained geometry covers cites epoch 0. Output-pixel coordinates are
never clamped: a point outside the capture keeps its projected coordinates and is marked `outside`.
Eligibility means the point falls inside captured content, not that macOS drew a pointer;
`CGCursorIsVisible` has been unsupported since 10.9, and this recorder never renders a cursor into
the source.

The capture probe and lab drive these owners against real captures; their request shapes live in
[CaptureProbe](../../apps/macos/Sources/ScreenRecorder/CaptureProbe.swift) and
[CursorGeometryProbe](../../apps/macos/Sources/ScreenRecorder/CursorGeometryProbe.swift), run through
`scripts/native-capture-probe.mjs` and `bun run lab:cursor-geometry`. A successful compile or clock
test is no evidence of microphone, source-loss, drift or framing behavior; those need real captures
and decoded or auditioned media. The lab's pointer hot-spot conversion reads the journaled
`scaleFactor * contentScale`, so a change to how `CaptureGeometry` scales must be made there too.

## The worker boundary

The worker is owned work, not a service. Each request line is decoded strictly: a request type's
`Codable` shape is the single statement of its fields, and a field it does not read is a caller
mistake at any depth. Every failure is a `NativeFailure` whose `retryable` says whether the identical
request can succeed later. A changed identity, a malformed request or an occupied output cannot; a
decode failure or a transient filesystem error can. The operation table in
[Wire](Sources/ScreenRecorderWire/Wire.swift) names, per operation, only what an unrecognised
platform error means.

[ParentLifetime](Sources/ScreenRecorderNative/ParentLifetime.swift) binds the worker to the process
that spawned it. End of input cannot carry that meaning, because a runner writes one request and
closes stdin immediately. macOS announces a parent's exit through a Dispatch process source on its
own queue, and the parent is read again once the watch is registered: an orphan is reparented to
launchd without any announcement, and only that second reading distinguishes a recycled process ID
from a living owner. Abandoned work exits 75, meaning the owner disappeared rather than the request
failed. The worker never cancels in-process work; the service cancels by killing the process.

## Descriptors, identities and publication

Storage work is contained by descriptors, never by re-resolving paths. The service resolves and
pins what an operation may touch, then hands it over as inherited descriptors in a fixed order each
operation defines, beginning at fd 3. A pinned directory or file carries a
`dev`/`ino` identity as decimal strings; the worker checks the descriptor still names it, and walks
beneath it only with `openat` and no-follow flags. Exclusive ownership is a `flock` on the shared
open-file description, so a lock taken by the parent's descriptor stays held while any inherited
copy lives, and a crashed worker cannot release what its owner still holds.
[Descriptors](Sources/ScreenRecorderWire/Descriptors.swift) owns these primitives.

A new output is either a caller-created writable handle (`/dev/fd/N`), filled in place, or a path
that must not exist yet. [NewFile](Sources/ScreenRecorderMedia/OutputFile.swift) assembles a path
output in a private staging directory beside it and publishes it with one `link`, which never
replaces a name that appeared meanwhile; nothing partial is ever visible at the path, and a path
output can never alias a source. A worker killed mid-operation can leave that staging directory
behind, so outputs belong in an attempt directory whose owner removes it.

Export publication to a user's destination is a separate protocol with its own durable receipt:
[PublicationOperation](Sources/ScreenRecorderWire/PublicationOperation.swift) keeps a completed
staging link until its caller durably acknowledges the outcome, and reconciles a destination by
inode and digest after a restart. ZIP reading and writing bind the OS libarchive through
[CLibArchive](Sources/CLibArchive/README.md) and read only bytes whose size and file version match
what the service admitted.

## Recovery and source evidence

[MediaRecovery](Sources/ScreenRecorderWire/MediaRecovery.swift) decodes each source independently
and is read-only; reconciling the library belongs to the service. Video determines the recovered
take extent, optional audio never shortens it, and missing media keeps an explicit per-track
failure. Audio the journal header never requested is an allowed absence; without a header an
absence stays unexplained.

AVFoundation can return silence for empty audio edits and unavailable durations for decoded video,
so recovery excludes empty segments and clips to the track's media range. A take's last frame has no
successor to bound it, so its duration comes only from a sample cursor that states it, positioned
through the media-time mapping because readers report asset time while cursors navigate media
time. Without that cursor the interval stops at the last decoded timestamp and the track fails with
`UNKNOWN_TAIL`: the gap to the previous sample is not evidence. Audio also intersects the journal's
acquisition ranges, so decoder padding never counts as recorded speech. Adjacent ranges coalesce
across a one-microsecond seam, the rounding contiguous samples can acquire; larger holes stay gaps.

[SourceEvidenceExport](Sources/ScreenRecorderWire/SourceEvidenceExport.swift) normalizes a finalized
or recovered journal into JSONL outside the source directory, streaming without retaining cursor
history. Cursor samples stay observations in source time with geometry and display-space records
in journal order; nothing is recalculated and no gesture is inferred. File order is observation
order per record type, not global source-time order, so consumers index the explicit timestamps.
Its receipt echoes the requested locator only after proving it names the created inode, and keeps
the journal's integrity markers: `finished` is the journal's claim, not a new validation of media.

## Frames, renders and audio

Frame selection works inside a kept interval the timeline owner supplies. Sample cursor timestamps
are media time and are compared in asset time through the shared mapping, so selection and recovery
cannot disagree about where a sample sits; the exact native timestamp is kept for decoding, and the
response reports the actual sample time and distance. An overlay is drawn in source pixels before
the crop and long-edge bound, so overlay points and crops share one geometry. The core supplies
every point already clipped at pause, cut, scene and geometry boundaries; native draws nothing
between two runs, because a gap between them is a gap in the evidence. Output pixels are half-open
everywhere: a coordinate equal to the width is past the raster. Clean visual observations reuse the
same selection and decoding, reusing a held frame's pixels while keeping each request's own
timestamp, and accept explicit timestamps rather than a cadence or scene policy.

Movie rendering executes a render plan without interpreting it. Retained source spans are ascending
and never touch, because adjacent retained spans are one span, and video and audio refuse the same
malformed plan through one rule. Explicit empty edits render as the default player's opaque black;
an unexplained gap never inherits the previous image. Presentation evidence walks the same
sequential decode and publishes bounded JSONL records. Cuts that retain the same decoded sample
reuse its thumbnail, while each interval retains its exact timing record. Thumbnail retention is
bounded to the current sample and clears on empty edits.

Recording excerpts read only where the caller's acquisition evidence and the file's own occupied segments
agree; everywhere else is reported unavailable and silent, because a container decodes padding for
holes nothing was captured over. Joins between retained spans get short ramps, and every span
boundary is quantized from cumulative playback time so rounding never accumulates across spans.

Composition audio consumes the composition compiler's independent sample schedule
and ordered processing tree. Its source decoder selects an actual admitted stream;
it does not assign recording roles. Parents process summed child PCM, and empty or
bypassed stacks add no gain policy or join fades. Unavailable regions remain
explicit in the receipt. The [execution evidence](../../specs/agent-editing/assets/08-audio/README.md)
owns current conformance and the bounded source-resampling context decision; this
native boundary does not itself make public rendering ready.

## Speech

**ScreenRecorderSpeech** is the only target that links FluidAudio, with its traits disabled, and
only the worker reaches it. It transcribes each readable narration interval on its own, through
the same audio stream owner, so unavailable time is never heard as silence and every word maps back
into the interval it came from. The request pins every model file by size and digest, and nothing
loads until the directory holds exactly those files. FluidAudio would purge and re-download a model
that fails to load, so the worker runs it offline and a failure is only ever reported. Core ML
prints diagnostics to standard output, so the response channel is diverted while the engine runs.

Words are grouped from the engine's tokens exactly as the evaluated FluidAudio CLI groups them, so
the worker and that CLI can still be compared token for token. A word's _time_, though, is the
extent of its tokens that carry speech, not the span the engine gives it: this model ends a
sentence with a punctuation token of its own and places it where it decided the sentence was over,
which on measured narration is up to a second after the last sound. The raw record keeps both, and
everything downstream — cuts, excerpts, frame requests — is aimed by the spoken extent.

Media probing describes original bytes without normalization. Stream bounds use
one shared presentation origin and retain empty edits separately; compressed
packet timestamps are not interchangeable with presented sample times. The probe
uses the media target's existing edit-list mapping and keeps only timing summaries,
not an in-memory timestamp for every frame. Decodability metadata remains a platform
capability report; successful import/export needs its own actual decode checks.

Composition movie assembly binds both compiler planes once. The existing H.264
renderer feeds the existing mux, and the bounded composition PCM source feeds
AAC directly; WAVE export consumes the same source. Window sample positions are
rebased only at this consumption boundary. Exact movie and edit-list clocks remain
authoritative when external tools report AAC duration rounded to native samples.
See [native assembly evidence](../../specs/agent-editing/assets/09-assembly/README.md)
for verified behavior and remaining public integration gates.

The audio target directly links the [fixed RNNoise dependency](../denoise/README.md).
Its verified local model preparation is an explicit native-build prerequisite;
the app build checks it before invoking Swift. Runtime processing never downloads
or prepares weights.
