---
name: screenrec
description: Record, inspect, edit, and export local recordings, or edit, preview, and export managed media projects through the screenrec CLI. Use when an agent needs to understand a narrated recording, locate unwanted speech, cut or trim footage, inspect edit results, deliver video and processed recording packages, compose presenter overlays, crop/fit/zoom footage, configure ordered clip/track/group processing, compare raw and processed audio taps or waveform/spectrogram evidence, inspect source or edited-project screenshot indexes and pictures, or inspect source scene changes, captured cursor and editorial project-cut evidence.
---

# Screenrec

Make editorial decisions from recording evidence, then use the CLI to apply
non-destructive edits and verify the result.

## Workflow

1. Discover the installed interface with `screenrec --help`. It returns JSON
   descriptions and parameter schemas without launching the app. If the launcher
   is missing and you are in the built source checkout, use
   `bun run screenrec --help`. If neither works, report the missing build or
   installation. Use the advertised operations; do not assume proposed editing
   features exist. For JSON files, use `--params - < request.json`. Reserve
   `--output` for advertised media delivery; redirect stdout to save JSON metadata.
2. Resolve the intended recording with the discovery operations, then inspect
   its state and revision. The latest recording may still be capturing or
   processing. Pin the recording ID and revision for subsequent reads.
3. Inspect transcript and visual evidence to locate the requested content.
   Follow returned pagination cursors, including empty pages with a next cursor.
   Preserve the transcript generation when using word identities. An empty
   transcript range does not prove silence, and an omitted filler does not prove
   the speaker did not say it.
4. Inspect uncertain cut boundaries using bounded audio excerpts and nearby
   frames. Choose narration, system audio, or mix intentionally. Transcript word
   times are estimates; protect adjacent speech. Use waveform or spectrogram
   analysis when available, but do not equate low amplitude with safe silence.
5. Submit the requested edit against the inspected revision. Read the current
   schema for required identifiers and ranges. A cut accepts multiple ranges
   in one revision's playback coordinates; successive edits change those
   coordinates. After a stale-revision rejection, inspect the new state and
   recompute the edit instead of simply replacing the expected revision ID.
6. Inspect the returned revision and request its audio, frames, or playable
   preview around changed joins. Poll the same pinned request while processing
   is pending; a failed job requires diagnosis and an explicit supported retry.
   If your tools cannot listen to audio or play video, disclose that verification
   limit. A successful render alone does not establish a clean-sounding cut.
7. Export the requested revision and format only after checking the changes.
   Distinguish a pending export from a published artifact. Return the actual
   output path and any unresolved verification limits. Use history, undo, or
   restore for requested recovery; never modify source media or the database.

## Managed projects and processing

When the connected service supports managed projects, discover the project and pin
its revision before editing. During the development cutover these operations need
an explicitly supplied isolated-service `--socket`; the installed recording service
can return `NOT_READY` even when checkout help lists their schemas. Do not reinterpret
a project request as a recording edit or claim an unavailable operation succeeded.

Prepare imported media through the advertised asset/job operations before the edit
batch. For an existing captured-source directory, use the advertised acquisition
import/get operations to retain its journal and capture gaps. Wait for the import
job, then use its returned asset/stream bindings and explicitly set `acquisitionId`
on those clips. Omitting it uses physical file support. For synchronized placement,
convert each asset timestamp back to capture time by subtracting that binding's
`sourceToAssetOffsetUs`; do not independently zero every stream. Replacing media
selects a new complete binding: omitted acquisition means physical support even
when processing is kept.

For imported speech, select the returned `assetId` and audio `streamId` explicitly
when requesting a source transcript; include `acquisitionId` only when you intend
its capture gaps. These ranges are normalized file timestamps, not project time.
Keep the complete returned cursor when paging or searching; changing selection or
generation requires a fresh read. Reads can prepare transcription with ready local
models but never download models. Inspect model readiness and use explicit model
preparation when needed; diagnose failed/canceled work before explicit transcript
retry. A source phrase cannot cross an inference segment.

For speech as it appears in an edited project, request the project transcript at
the intended revision. Rows identify each repeated/retimed clip occurrence and
retain exact source/project fragments. A query window selects words; it does not
trim their editorial fragments or change whether the edit cut a word. Preserve
fractional timestamps instead of rounding them into edit boundaries. Keep the
complete continuation, including across empty pages; it pins the original revision
even when the head changes. If evidence expires or changes, start a fresh query.
Project retry rebuilds the query manifest only; diagnose and explicitly retry any
failed source dependency using its returned selection. Use project phrase search
only when advertised; source search cannot stand in for edited speech order.

Read the target stack, then set its entire ordered list through `edit.apply`.
Keep step IDs when changing order, settings or bypass; omit them when copying to
another target so the copy gets independent IDs. Parent stacks process combined
results; an exception needs clip treatment or a separate track, not an inherited
override. Check `processing.capabilities`: authored settings with execution unavailable
are not processed audio/video. Verify returned settings separately from rendered
media, and report whichever stage is still unavailable.

For visual layout, change the canvas for the output aspect ratio and place overlapping
footage on separately ordered video tracks. Place imported PNG/JPEG images with
`source: { kind: "hold", atUs: 0 }` and a project placement duration; that zero
selects the whole image, not a sampled instant. Images use the same geometry,
opacity, target taps, previews, exports and retained project indexes as footage.
Use advertised geometry/opacity steps;
changing an inspection size does not change the edit. Geometry uses top-left pixels:
the first clip geometry consumes the oriented source, later geometry and parent
stacks consume a canvas-sized image. Read admitted source dimensions before cropping.
Use the destination rectangle for position/size and choose contain or cover to
preserve aspect; stretch deliberately distorts it. Preserve independent audio clips
when changing picture layout. Inspect the processed output and relevant target taps,
including every layer's picture provenance. Parent opacity affects the combined
picture, so it is not interchangeable with opacity on each child. H.264 delivery
requires an opaque final canvas; report an unsupported transparent movie request
rather than silently adding a background after the output stack.

For audio inspection, choose the source stream or a pinned project deliberately.
Source selection uses asset/stream identity and optional acquisition; its range is
source time. Project audio uses project time and defaults to processed output.
Start with a bounded range. Read the target stack to select a dry, after-step or
processed tap using returned target/step IDs. Dry skips only that target's stack;
its children remain processed. Child taps exclude ancestors. Compare the same
pinned range across taps to isolate level or processing changes; do not normalize
or judge a join's sound merely because rendering succeeds. Preserve the returned
sample clock, channel layout and unavailable ranges when analyzing delivered WAVs.

For waveform inspection, reuse the same source/project selection, range and tap.
Read the delivered JSON file, not just its readiness receipt. Start with the
automatic overview, then narrow the range and set bucketFrames for short sounds.
Preserve its sampleRate and absolute sampleRange; a ranged excerpt does not reset
the clock to zero. Compare channels separately and account for partial edge
buckets and unavailable support. Min/max/RMS can locate energy changes but cannot
prove silence, speech boundaries or a natural join. For a visual view, request
format:image and open the delivered PNG. Use spectrogram.get on a short window to
inspect frequency content; narrow the range or adjust the advertised resolution
when a limit refuses the request. Read each channel's axes and scale before comparing
images. Incomplete FFT warnings can reflect missing audio outside the displayed
range; inspect the returned context as well as the visible support. Pin the project
revision while polling. Explicit acoustic retry recovers its prerequisites;
ordinary reads do not restart canceled or failed work.

For picture inspection, choose a raw source stream or a pinned project before
requesting frames. Read the admitted stream kind first. For a raw PNG/JPEG image,
use assetId and streamId with optional maxLongEdge; omit atUs and acquisitionId.
The delivered PNG is already upright; its receipt retains the source orientation.
An image has no sample clock. Timed video requests use asset/stream identity,
optional acquisition, and source time; do not add a recording or project revision.
Frame batches remain timed; inspect multiple images individually. Project requests use
project time and the inspected revision. The returned global project sample can
precede the requested time; preserve its sample time, visible range and occurrence
provenance instead of treating it as a wrong frame. `atUs` is the request instant;
`frame.visibleRange` is the full interval displaying that project frame. Authored
clip edges can fall inside a displayed frame; use the sampled frame and its range
to describe visible changes, rather than assuming an edit edge is a new picture.
A raw source image excludes
project processing, crop/zoom and capture overlays. An unavailable source gap is
missing evidence, not a black frame. Poll the same selection while processing;
inspect failure before explicit frame retry. For batches, preserve per-item order
and errors, and deliver only ready pictures. Check the returned dimensions and
sample identity; an inspection size bound does not author a crop or aspect ratio.

For a storyboard, choose a source index for raw footage or a project index for the
edited composition. Source selection uses asset/stream and optional acquisition;
project selection pins a revision and optionally a video tap, defaulting to processed
output. Project indexes cover the whole revision, including holds and background.
Poll the same selection while preparation is pending; inspect terminal failures
before explicit index retry, which also recovers retryable prerequisites. Read
`index.coverage` as well as entry pages, following every returned cursor. Fetch
images using returned complete references; do not
reconstruct their revision, generation, tap or size. Preserve per-image batch errors.
A ready index can contain zero images. Project coverage proves only each delivered
frame's sampled visibility; unproven intervals do not establish unchanged pictures.
Use direct frames or a preview to investigate those intervals. Source support gaps
are known exclusions, while unavailable observations remain missing evidence. Source
indexes exclude project edits; measured source scenes are not authored project cuts.

For timeline inspection, use advertised `timeline.events` reads. Video scene changes
need a selected asset/stream, not capture metadata; add acquisition only to apply
its support. Source ranges use source time, while project reads use the pinned
revision and identify repeated/retimed occurrences. For whole-project inspection,
omit the range or derive it from the inspected revision, never from source duration.
A partial query cannot establish every occurrence or gap. Preserve exact physical sample
clocks, projected times and first-page coverage. Follow every returned cursor,
including empty pages. A scene change is measured source evidence, not an authored
project cut; unsupported categories remain unknown. Initial reads may prepare
scenes: inspect returned dependencies/jobs, poll the same selection and explicitly
retry failed/canceled prerequisites using the advertised job operation. Retrying a
project query alone does not repair its source dependencies.

In project event results, distinguish editorial cuts from measured source scenes.
A cut reports a track-local source-mapping transition: inspect both sides, exact
project time and audio/video plane. Entrances/exits can belong to an overlay while
underlying tracks continue. Pure splits add no cut; rate changes can, without
proving an audible or visible discontinuity. Project cut authority comes from the
pinned revision, not a source generation. Keep availability gaps separate and do
not infer missing capture metadata from an empty cut list.

For capture-specific cursor, pause, geometry and interruption evidence, use an
explicit acquisition binding; a scene row does not supply capture provenance.
Keep original capture times alongside source/project times. Unavailable metadata
is not evidence that nothing happened. Raw cursor coordinates do not simulate the
edited crop or zoom. Capture-end interruption markers close their supported range;
follow the operation's boundary rules rather than treating every event as an
ordinary half-open point.

Use project time for a managed preview range. Keep the returned revision and range
when polling so a concurrent edit cannot change the result. After replacing only
audio or video, inspect both planes: the requested replacement must change while
the protected plane keeps its source and timing. A downloaded preview is a viewing
artifact; it does not establish that a durable export intent has published.

## Invocation and identity

- Pass structured parameters through stdin to avoid shell quoting problems:
  `screenrec edit.cut --params - < cut.json`. Build that file from the discovered
  schema and inspected identifiers, not guessed IDs.
- Save raw JSON receipts and programmatically reuse their opaque IDs; do not retype
  them from memory. On `NOT_FOUND`, compare the submitted ID against the saved
  receipt before diagnosing lost service state.
- Parse the JSON envelope even on a nonzero exit. `--output` writes delivered
  media or JSON evidence to a file or directory according to the operation.
- Edit ranges are half-open integer microseconds in the expected revision's
  playback timeline. Source timestamps and edited playback timestamps differ
  after cuts; use the reported mapping and retained fragments.
- For operations accepting `params.requestId`, reuse it with identical arguments
  when retrying an uncertain write. A new intended mutation or recomputed edit
  needs a new request ID. Export creation instead uses `exportId`; preserve it
  and its arguments on retries. Follow each operation's advertised retry contract.
  The CLI `--id` is a transport identifier, not the durable mutation identity.
- CLI and `screenrec mcp` expose the same operation registry. Use whichever
  interface the calling agent has; preserve the same revision and retry rules.
