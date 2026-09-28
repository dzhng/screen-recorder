---
name: screenrec
description: Record, inspect, edit, and export local recordings, or edit, preview, and export managed media projects through the screenrec CLI. Use when an agent needs to understand a narrated recording, locate unwanted speech, cut or trim footage, inspect edit results, deliver video and processed recording packages, configure ordered clip/track/group processing, compare raw and processed audio taps or waveform measurements, inspect selected-source or edited-project pictures, or inspect captured cursor and timeline evidence.
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
   features exist.
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
prove silence, speech boundaries or a natural join. Pin the project revision while
polling; an explicit waveform retry also retries its audio prerequisite.

For picture inspection, choose a raw source stream or a pinned project before
requesting frames. Source requests use asset/stream identity, optional acquisition,
and source time; do not add a recording or project revision. Project requests use
project time and the inspected revision. The returned global project sample can
precede the requested time; preserve its sample time, visible range and occurrence
provenance instead of treating it as a wrong frame. A raw source image excludes
project processing, crop/zoom and capture overlays. An unavailable source gap is
missing evidence, not a black frame. Poll the same selection while processing;
inspect failure before explicit frame retry. For batches, preserve per-item order
and errors, and deliver only ready pictures. Check the returned dimensions and
sample identity; an inspection size bound does not author a crop or aspect ratio.

For captured observations, use advertised `timeline.events` and `cursor.raw` reads.
A source request needs explicit acquisition authority and source time; project
reads use the pinned revision and the acquisition bindings of its clip occurrences.
Retain first-page coverage and all continuations, including empty pages. Unavailable
metadata is not evidence that nothing happened; unsupported categories remain
unknown. Keep exact projected times and occurrence identities alongside original
capture times. Raw cursor coordinates do not simulate the edited crop or zoom.

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
