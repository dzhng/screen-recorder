# Public behavior and data contracts

This document settles implementation choices left open by the discovery map.
Names are internal working names; changing labels is delegated, changing semantics
requires updating the owning slice and this contract.

## Timeline and revisions

Public numeric times are safe integer microseconds, explicitly named `*Us`.
Human CLI accepts seconds or `mm:ss.mmm` and converts once at its boundary. All
ranges are half-open `[startUs,endUs)`. Native retains original CMTime provenance;
round only at the agreed boundary, not per repeated edit.

A finalized recording with usable video has immutable source duration and revision `r0` retaining
`[0,sourceDurationUs)`. A revision has a fresh opaque ID, parent ID, monotonic ordinal,
operation label, creation time, duration, and ordered non-overlapping kept-source
spans. Playback is their concatenation. No reordering, duplicating, speed changes,
fades between clips, or generative edits are included. Native stream timestamps
already omit paused time; source playback time and elapsed real time are distinct.

`cut` receives ranges in the inspected revision's playback coordinates. Validate the
whole batch, sort and union overlapping/adjacent intervals, then subtract once from
that revision's spans. `trim` retains the supplied range in the inspected revision.
Reject negative/zero-width/reversed/out-of-bounds ranges, an empty batch, and removal of the
entire recording. A trim covering the entire revision is a successful no-op and
returns that revision. Edits are unavailable until a finalized or recovered source
duration is known, but do not require transcript readiness.

All revision-changing edits carry `expectedRevisionId`. Under a short transaction compare the
current ID, then commit exactly one revision or nothing. `STALE_REVISION` returns
the current ID; no silent rebase. A client-generated `requestId` makes retry after
a lost response return the prior result for identical arguments, even if current
has since advanced. Reusing it with different arguments errors. This is request
deduplication, not a bypass for new edits based on old revisions. Persist successful
edit replay records keyed by recording ID, operation, and request ID, with argument
fingerprint and result in the same transaction as the revision. Check a matching
replay before comparing current revision; retain records until recording deletion.

Other state-changing operations use request IDs without a revision requirement.
Capture controls require the active recording/session ID (start allocates it),
validate native device state, and return already-achieved state idempotently where
safe (pause an already paused take, stop an already finalized take). Restart names
the take to discard and returns a distinct new take ID; replay returns that same
new ID. Persist lifecycle request outcomes in core so a lost response does not start
another take. Model prepare/retry and package-open deduplicate by their stable input
identity while running. Delete requires only an explicit recording ID and is
idempotent by absence. Invalid capture transitions return INVALID_STATE.

`undo` appends a new revision restoring the most recent still-active edit's prior
span list. Maintain an undo target stack so repeated undo walks prior edits rather
than toggling between states. `restore` appends a new revision copying any explicitly
named prior revision, including original, and is itself undoable. Never resurrect an
old revision ID; old stale tokens must stay stale. History is preserved until the
recording is deleted. An empty undo stack returns NOTHING_TO_UNDO without a new
revision. Example: original O; cut A pushes O; cut B pushes A; undo appends C with
A's spans and pops A; undo appends D with O's spans and pops O; another undo errors.
Restore B from D appends E with B's spans and pushes D; undo appends F with D's spans
and pops D; another undo errors. Every letter is a distinct ID. No general
branching/merge UI is planned.

## Read identity and readiness

`latest` selects newest non-canceled recording by creation sequence, irrespective
of readiness or edits. It returns `recordingId`, state, current/finalized revision
when available, and independent artifact status. Starting another take does not
retarget subsequent ID-based calls. Active capture is discoverable but inspection
may report `NOT_READY`; source images become available after media finalization.

If start fails or interruption leaves no decodable video, retain the recording's
identity and failure details without creating `r0` or a zero-duration timeline.
Video-dependent operations return `UNAVAILABLE` after this terminal outcome;
they do not remain pending forever. Available diagnostic/source files remain
accounted for in storage and manual deletion. Surviving audio remains accessible
under the recovery contract; audio alone does not create an editable timeline. A usable video prefix follows normal recovered-source
registration, even when optional audio is missing.

Recording lists run newest first by creation sequence. A continuation begins
strictly before the last returned sequence, so newer takes never enter that
traversal. Canceled/deleted takes are absent; each returned row carries its current
state and revision identity. The list does not freeze evolving recording metadata.

History pagination pins the highest revision ordinal visible on its first page.
Later edits do not enter that traversal; a fresh history request sees them. Return
each retained revision once in ordinal order within that bound.

Resolve omitted/current revision once at request start. Page cursors and long jobs
pin recording, revision, artifact generation, and filters. A changed artifact never
silently joins the previous page: retain that generation or return
`ARTIFACT_CHANGED` to restart pagination. Return actual revision/generation in all
results. An in-flight job publishes only into its captured identity.

Recording states: `preparing`, `recording`, `paused`, `finalizing`, `complete`,
`interrupted`. Allocation is discoverable as preparing; first accepted capture
start transitions to recording. Failed permission/native start leaves an interrupted
entry with start-failure reason and zero usable duration, rather than a false
recording state. Cancel removes it explicitly. A native death before any sample
has the same honest zero-media outcome.
Canceled takes are removed from discovery. Artifacts use `not_requested`, `queued`,
`processing`, `ready`, `failed`, `unavailable` with reason and retryability. There
is no endlessly ambiguous processing state after restart: interrupted jobs become
failed/retryable. One automatic processing attempt; explicit retry resumes or starts
one job, returning the existing job if already queued/running.

Default processing transcribes narration only. Mic-disabled/missing narration gives
an empty transcript with `unavailable:no_narration`, not fabricated silence text.
Audio extraction is available for narration/system/mix so the consuming agent can
inspect sound. System audio transcription/diarization is not part of this release.

## Words, events, frames, and cuts

Source transcript words carry text, source start/end, available confidence,
model/runtime identity, and `kind: speech|filler|vocalization` when actually provided
or deterministically classified from recognized text. Never invent missing words.
Raw model output is retained; no rewriting or cleanup pass. Word timing and filler
fidelity must pass slice 04 before promising the filler-edit workflow.

Project transcript through kept spans. Fully removed words vanish; intersected
words retain their source text but are explicitly `partial:true` with retained
fragments. Human rendering marks them as fragments rather than intact speech.
This is evidence projection, not a fresh recognition of edited audio.

Events include pauses (`atSourceUs`, real `elapsedPauseUs`), cuts (new playback
boundary plus removed-source spans), capture interruption, and source geometry
changes. A pause survives if retained material touches its boundary; one inside a
removed interval disappears. At a join, coalesce equal-position pause/cut events
in a stable source order. A leading/trailing retained pause may remain to explain
the transition. Marker-only time never creates video duration.

The core maps a requested edited frame time to a source span. At a cut boundary,
use the following kept span; requesting exactly duration returns out-of-range.
Native decodes the closest frame inside that span (earlier wins ties), returning
requested/actual source and playback times. Never select a deleted frame because it
is nearer. Tolerance target is one captured frame; sparse/static captures report
actual distance and hold the last valid unchanged frame only within the same span.

Cursor samples include source time, video-pixel x/y, visibility, buttons when
observed, and geometry epoch. Preserve raw samples; timestamps must share capture
clock. Default images add current pointer plus preceding 2 seconds of fading trail.
`clean:true` disables both; `trailUs:0` retains only current pointer. Custom trail
duration is capped at 10 seconds per request. Reset at pause, cut, detected scene,
or geometry boundary. Return actual trail start/end and cutoff reason.

If whole-recording scene analysis is not ready, a frame request analyzes only its
bounded requested trail interval through the same boundary producer. It need not
wait for the global index. Cache observations with the policy version; failure to
analyze the interval is explicit rather than an unverified promise of trail resets.

Scene detection uses clean low-resolution video, excluding pointer overlays. Start
with 5 Hz analysis, scene boundaries from broad pixel change, a 5-second coverage
interval, and a 1-second ordinary candidate spacing. First/last and pause/cut/scene
boundaries are retained. Accumulate cursor displacement independently and retain
the end of a motion burst (300 ms idle, or 2 seconds continuous motion), allowing
gesture evidence even when background pixels match. Static scenes with identical
cursor evidence collapse; coverage records still identify covered intervals.
Scene thresholds are settled by slice 10's fixture verdict and selection thresholds
by slice 11's; both use the same boundary producer. Do not label
heuristics as semantic gesture recognition. Visual evidence of circling is the goal.

## Operation surface

The protocol registry declares operation name, input/output schema, read/mutation
status, CLI help, and MCP exposure. Service composition binds core handlers to those
IDs; protocol must never import core handlers. Both adapters must cover every public
operation. CLI JSON and MCP structured results share fields; diagnostics go to
stderr. MCP frame results add actual image content; CLI writes files and returns
their absolute paths and MIME types. A future editing UI invokes CLI JSON only.

For example, this illustrative edit request removes two intervals from a fixture
revision containing 20 seconds of uncut source. The same params are used by MCP and
the CLI JSON interface:

```json
{
  "operation": "edit.cut",
  "params": {
    "recordingId": "rec-demo",
    "expectedRevisionId": "rev-before",
    "requestId": "cut-demo-1",
    "ranges": [
      {"startUs": 3000000, "endUs": 4000000},
      {"startUs": 10000000, "endUs": 12000000}
    ]
  }
}
```

Its new revision retains source intervals `[0,3000000)`, `[4000000,10000000)`,
`[12000000,20000000)`, with duration `17000000` microseconds. Response includes
recording/new revision/parent IDs, duration and per-artifact readiness. A second
new request using `rev-before` returns `STALE_REVISION`; replaying the identical
`cut-demo-1` returns the already committed result. Neither case adds another cut.

Operation results use `{ok:true,data}` or `{ok:false,error:{code,message,retryable,
details}}` inside the shared service/CLI envelope; MCP maps operation failures to
its error result while retaining the same structured error. Use stable codes for
`NOT_READY`, `UNAVAILABLE`, `STALE_REVISION`, `INVALID_RANGE`, `INVALID_STATE`,
`NOTHING_TO_UNDO`, `ARTIFACT_CHANGED`, `LIMIT_EXCEEDED`, and processing/native errors.
No transport-specific text parsing is required to decide whether to retry.

| Family | Operations and minimum semantics |
| --- | --- |
| Capture | sources, start, status, pause, resume, stop, cancel, restart; source IDs or explicit region; source selection may require visible native picker. |
| Discovery | recordings list/latest/get; readiness, source description, timestamps, duration, current revision, interruption details. |
| Inspection | transcript (paged, optional time filter), transcript search (literal text, returns word ranges), timeline events, frame index, frame(s), raw cursor range, audio excerpt, playable revision preview. |
| Edit | trim, cut batch, history, undo, restore; explicit revision and request ID for mutations. |
| Processing | status, retry artifact, model status/prepare; no cloud inference fallback. |
| Export | video or package only; returns pinned job ID/status/output path; no third export format. |
| Library | storage usage, recording delete; explicit ID required, no implicit delete-latest. |
| Package | open/close a relocated package for read-only use with the same inspection operations and explicit package handle. |

`preview` is a temporary playable derivative of the requested edit, not another
export product. Editing can be audited from images, transcript, and audio excerpts
before preview rendering completes. Cut commands never run a semantic model.

Default limits: list 20/max100; transcript 250/max1000 words; index 50/max200;
frame batch max8; audio excerpt max30 seconds; cut batch max1000 intervals.
Cursor queries require a bounded time range (max60 seconds), page 1000/max5000
samples; events/history/search page 100/max500 entries. Every list returns an
explicit continuation cursor rather than truncating silently. Search results carry
word IDs/ranges and share the pinned transcript generation. Pagination never loads
all cursor samples to return one page.
Images default to max1600-pixel long edge, with full captured resolution and crop
available (max8192 long edge and 32 MiB encoded per image; report limit errors,
never silently unreadable content). Each image uses a decoded source reference and
metadata; local file paths are not substitutes for MCP pixels. Per-source pixel
capture is capped to 4096 long edge at 30 fps SDR, preserving aspect ratio.
Revisit a default only with measured fixture evidence and update this document.

Frame service caches by recording/revision/source-time/geometry/trail/options.
Two native frame jobs maximum, one heavy transcription/export job at a time, one
durable queue. Cap derived cache at 1 GiB with LRU eviction; never evict original
media, retained transcript, revision manifests, or selected index evidence as cache.
Active recording takes priority over heavy background work; pause scheduling of new
heavy jobs while capturing. No unbounded retries, polling, or whole-video buffers.

## Audio and human output

Microphone on by default; optional system audio off until selected. Store tracks
separately. For the initial release system capture means all system audio excluding
the recorder, including browser audio; label it clearly so a selected window does
not imply tab-only sound isolation. Per-tab audio isolation is deferred.

Human video is H.264/AAC MP4 with current pointer, no trail, edited timeline and
mixed captured tracks. A single track uses unity gain; when both are present use
0.5 gain each to avoid summing two full-scale tracks. No noise suppression or echo
cancellation promise. Capture fixtures use headphones to distinguish software
track separation from acoustic microphone pickup.

Cuts remove identical spans from all tracks. Use at most 5 ms audio fade-out/in
inside retained spans at joins, never overlap video or shorten the timeline. Short
spans clamp ramps to half their duration. Verify audible adjacent speech; no hidden
word snapping or automatic changes to agent-specified boundaries.

## Portable AI package

Export a ZIP containing `manifest.json`, `source/`, `revisions/`, and `evidence/`.
The manifest has schema version, recording ID, pinned export revision ID, source
inventory (relative path, size, hash, track role, duration), capture metadata,
revision/edit history, and artifact readiness/provenance. Source includes original
video, separate audio, raw cursor/geometry journal, and pauses. Evidence contains
raw source transcript and the pinned edited transcript, selected images/index,
and timeline events. Include source scene/geometry boundaries, their policy version
and options, so arbitrary trail requests can reproduce cutoffs without the original
analysis cache. Include explicit source versus edited time labels everywhere.

Open the ZIP by extracting into a package cache with traversal/link/size checks,
then use the same read-only inspection core and native decoder. A relative-path
directory form is an implementation detail of opening, not a third export choice.
No original library absolute path, SQLite file, model weight, runtime executable,
or user credential is required in the package. Source media plus edits permit
additional frames/trails. Compatibility guarantee is the initial macOS CLI; raw
files are ordinary inspectable formats elsewhere. Linux tooling and general
library import/merge are deferred. Packages remain read-only; no hidden edits to ZIPs.

Exports pin one revision before work, write staging output, and atomically publish
on success. Package export awaiting evidence remains queued with explicit dependency
IDs and holds no worker slot; schedule missing dependencies first, then acquire the
export slot when ready. This prevents export from blocking its own transcription.
Failed
required evidence returns an actionable error, not a deceptively complete package.
Legitimate no-narration is an explicit allowed absence. Interrupted recordings may
export their validated recovered duration, marked interrupted. Video export needs
only usable media, not a transcript. Concurrent edits never change an export job.

## Delete and recovery

Delete names an ID and stops/cancels work using it before deleting originals and
derived artifacts. An already absent ID is a successful no-op. In-flight export
from that recording is canceled before deletion; explicit completed exports outside
the library are not removed. Model assets and other recordings are untouched.
Storage usage reports source/evidence/cache totals; no automatic recording expiry.

Recovery claims cover observed process termination. Prefer AVAssetWriter file
fragmentation (5-second checkpoint candidate, first fragment 1 second) and validate
separate-track recovery. If it fails, compare finalized short segments in slice 02.
Only after evidence choose one mechanism. Recovered source duration is the validated
video duration, not the minimum across optional audio tracks. Keep per-track usable
intervals and offsets, cursor gaps, and untrusted tails explicit. Missing audio is
silence during playback/export but remains an unavailable interval for transcript
processing; never feed a fabricated silence track as evidence of recorded narration.
If no video is recoverable, retain any surviving audio with an interrupted zero-video
status and allow audio access; video-dependent operations report unavailable.
Report recoverable duration/track gaps;
never claim survival of sudden power loss from process-kill tests.
