---
name: screenrec
description: Record, inspect, edit, and export local recordings, or edit, preview, and export managed media projects through the screenrec CLI. Use when an agent needs to understand a narrated recording, locate unwanted speech, cut or trim footage, inspect edit results, deliver video and processed recording packages, or configure ordered clip/track/group processing.
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
batch. Read the target stack, then set its entire ordered list through `edit.apply`.
Keep step IDs when changing order, settings or bypass; omit them when copying to
another target so the copy gets independent IDs. Parent stacks process combined
results; an exception needs clip treatment or a separate track, not an inherited
override. Check `processing.capabilities`: authored settings with execution unavailable
are not processed audio/video. Verify returned settings separately from rendered
media, and report whichever stage is still unavailable.

Use project time for a managed preview range. Keep the returned revision and range
when polling so a concurrent edit cannot change the result. After replacing only
audio or video, inspect both planes: the requested replacement must change while
the protected plane keeps its source and timing. A downloaded preview is a viewing
artifact; it does not establish that a durable export intent has published.

## Invocation and identity

- Pass structured parameters through stdin to avoid shell quoting problems:
  `screenrec edit.cut --params - < cut.json`. Build that file from the discovered
  schema and inspected identifiers, not guessed IDs.
- Parse the JSON envelope even on a nonzero exit. `--output` writes delivered
  media to a file or directory according to the operation.
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
