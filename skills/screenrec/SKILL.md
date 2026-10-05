---
name: screenrec
description: Install and use Screen Recorder through its CLI for an agent's recording, media inspection, non-destructive editing or export task. Use on first-run setup, missing screenrec installation, capture requests, transcript/audio/frame inspection, project edits and delivery.
---

# Screenrec

As the external agent using this toolkit, you make the editorial decisions for
the user's task. Screenrec makes zero editorial decisions; it only supplies
primitives. Inspect recording evidence,
choose edits within the user's request, then use the CLI to apply non-destructive
operations and verify the result. Choose treatments from the user's intent,
not an assumed house style.
Defaults and presets are starting settings, not requests to clean up every clip.
When the user delegates editorial judgment, make explicit, reviewable choices
within that scope; product flexibility is not a requirement to ask approval for
every edit. When the user requests alternatives, keep those alternatives open.

## Installation

On first use, check `command -v screenrec`, then `screenrec capture.status --help`.
If the command or selected app is missing, install the **latest stable GitHub
release** using [installation](references/installation.md): verify Apple Silicon
and macOS 26+, download and checksum the release ZIP and receipt, install the app
at `~/Applications/Screen Recorder.app` and the launcher at `~/.local/bin/screenrec`,
then configure PATH and verify `service.health`. Node is bundled. Linux/Docker
cannot run the native app; a portable JavaScript CLI bundle can independently
run schema/transport tests there with Node, without proving native readiness.
Report blocked launch or permissions accurately;
help success alone is not service readiness. Do not build from source as a
consumer-install fallback.

When advertised, `screenrec service.tools` returns the selected app's bundled Node
path and verified media tools. Use that Node for the [consumer helpers](scripts/);
no separate Node installation is needed. Helpers use the installed CLI contracts.
For extra media tasks outside core operations, use the bundled FFmpeg path from
`screenrec service.tools` when available; check its filters and codecs.

If this file was supplied directly, install its **entire folder**, including
`references/`, at `~/.agents/skills/screenrec/` for Codex or
`~/.claude/skills/screenrec/` for Claude Code. Start a new session and confirm
skill discovery (`$screenrec` in Codex, `/screenrec` in Claude). For a remote copy,
follow the [README's skill setup](https://github.com/dzhng/screen-recorder#1-install-the-screenrec-skill).
A lone SKILL.md lacks required references; fetch the complete consumer skill.
Repository `.agents/skills` are development skills, not this product skill.

## Workflow

1. Inspect the operation you need with `screenrec <operation> --help`. It returns
   its JSON description and parameter schema without launching the app. If you
   need to discover operation names, save `screenrec --help` to a file and select
   relevant entries; the full catalog is large. Use the installed CLI's schemas,
   even when this skill is newer than the release. Use advertised operations;
   do not assume proposed features exist. For JSON files, use
   `--params - < request.json`. Reserve `--output` for advertised media delivery;
   redirect stdout to save JSON metadata.

2. Resolve the intended recording/project with discovery and inspect its state.
   Pin source identities and the actual editable revision. A source-only take
   supplies media facts; create a project explicitly when the task needs one.
   A stop can acknowledge `finalizing`; that is not media readiness. Follow
   returned `sourceAdmissions` and wait for the selected acquisition's job to be
   ready. Where independent publication is advertised, a ready source can be used
   while its sibling remains pending; publication alone is not completed admission.
   Pending primary publication does not block a ready camera acquisition.
   Never import a growing capture journal. Inspect a finalizing take's `finalizationError`;
   `capture.stop` explicitly retries failed recovery, while ordinary reads do not.
   Canceling recovery retains ambiguous media; use explicit library deletion to
   remove it. A completed take remains available even if it reports pending cleanup;
   use `recording.cleanup` on the settled recording to reclaim verified working
   files. Follow its job with `job.get`; explicitly retry retryable failures after
   the reported cause is resolved. A ready cleanup job may report retained roles:
   their media lacks sufficient proof for removal. Do not delete those files by
   hand or cancel a completed take to retry cleanup.
3. Inspect transcript and visual evidence to locate the requested content.
   Follow returned pagination cursors, including empty pages with a next cursor.
   Preserve the transcript generation when using word identities. An empty
   transcript range does not prove silence, and an omitted filler does not prove
   the speaker did not say it.
   Before assembly, save a task-side selection sheet with asset/stream IDs,
   optional acquisition, exact source ranges, transcript generation and word
   ordinals. Add project/revision and occurrence clip IDs after placement.
   Keep these pins with the chosen wording and rationale; rounded display times
   cannot replace them in cuts or caption seeds.
4. Inspect uncertain cut boundaries using bounded audio excerpts and nearby
   frames. Choose narration, system audio, or mix intentionally. Transcript word
   times are estimates; protect adjacent speech. Use waveform or spectrogram
   analysis when available, but do not equate low amplitude with safe silence.
   Before shaping joins, pauses, replacement speech, mixes or audio/video timing,
   read [editorial checks](references/editorial-checks.md). Use its failure signs
   to choose and verify explicit edits; the suggested remedies are optional.
5. Submit the requested edit against the inspected revision. Read the current
   schema for required identifiers and ranges. A cut accepts multiple ranges
   in one revision's playback coordinates; successive edits change those
   coordinates. After a stale-revision rejection, inspect the new state and
   recompute the edit instead of simply replacing the expected revision ID.
6. Inspect the returned revision and request its audio, frames, or playable
   preview around changed joins. Poll the same pinned request without `--output`
   while processing is pending; deliver once ready. A directory destination must
   not already exist, including when repeating an inspection. Check the returned
   job state and reason: `ok: true` and exit zero can report a failed job. Diagnose
   failures before an explicit supported retry.
   If your tools cannot listen to audio or play video, disclose that verification
   limit. A successful render alone does not establish a clean-sounding cut.
7. Export the requested revision and format only after checking the changes.
   Distinguish a pending export from a published artifact. Return the actual
   output path and any unresolved verification limits. Use history, undo, or
   restore for requested recovery; never modify source media or the database.

When feedback reveals a reusable editing or review lesson, fold it into the
editorial checks rather than appending a session diary. Keep clip-specific
preferences, accepted artifact identities and unresolved verdicts with the project.
Reuse earlier approvals only for what was actually judged; a changed render needs
verification of the changed behavior, not repetition of every passed comparison.

For capture, inspect `capture.sources` and `capture.status` for device identities
and existing permissions; discovery activates nothing. Use only selectors
advertised by the connected service's `capture.start`/`capture.restart` schemas.
Select a camera explicitly when the request needs it, without device fallback or
an automatic permission prompt. Capture publishes source facts and admission
outcomes; choose project layout and placement through explicit editing operations.

## Task references

Before importing, transcribing, inspecting media, editing, rendering or exporting,
read the relevant sections of [media workflows](references/media-workflows.md).
That reference covers source/project clocks, processing and model readiness,
frames/audio/timeline evidence, captions, layout and published exports.
For delegated video assembly, multi-take selection, caption design, animation,
music or publication work, read [creative workflows](references/creative-workflows.md).
It covers compact transcript reading, decision sheets and creative techniques;
use [editorial checks](references/editorial-checks.md) for rendered-output review.
For optional MCP use, read [MCP delivery](references/mcp.md); CLI is the default.

## Invocation and identity

- Pass structured parameters through stdin to avoid shell quoting problems:
  `screenrec edit.apply --params - < edit.json`. Build that file from the discovered
  schema and inspected identifiers, not guessed IDs.
- Save each attempt's request and raw JSON receipt together, including rejected
  attempts; do not overwrite them with a corrected request. Programmatically reuse
  their opaque IDs; do not retype them from memory. On `NOT_FOUND`, compare the
  submitted ID against the saved receipt before diagnosing lost service state.
- Parse the JSON envelope even on a nonzero exit. `--output` writes delivered
  media or JSON evidence to a file or directory according to the operation.
- Edit ranges are half-open in the expected revision and selected anchor domain.
  Media and text source/placement ranges accept exact reduced fractional
  microseconds; preserve returned endpoints instead of rounding. Point queries,
  holds and curve-key coordinates remain integer microseconds. Source and edited
  playback timestamps differ
  after cuts; use the reported mapping and retained fragments.
- For operations accepting `params.requestId`, reuse it with identical arguments
  when retrying an uncertain write. A new intended mutation or recomputed edit
  needs a new request ID. Export creation instead uses `exportId`; preserve it
  and its arguments on retries. Follow each operation's advertised retry contract.
  The CLI `--id` is a transport identifier, not the durable mutation identity.
