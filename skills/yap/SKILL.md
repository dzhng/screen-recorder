---
name: yap
description: Work with video for the user through the yap CLI — understand a recording they show you, or edit their footage end to end from a one-line prompt and optional inspiration into a finished, exported video. Use for launch/demo videos, podcasts, episode introductions, teasers and trailers; when the user shows you a recording (a bug, feedback, a walkthrough) to understand; wants a recording made, cut, tightened, captioned, reframed, cleaned up, restyled after a reference video or exported; for transcript/audio/frame inspection of their media; and on first-run setup, missing yap installation, skill installation/comparison or explicit refresh, and update-health questions.
---

# Yap

Users yap; you make it count. Video reaches you two ways. When the user shows
you a recording to explain something (a bug, design feedback, "watch me do
this"), read it as instructions: find what they said and what was on screen at
that moment, then act on that, without editing it. When they want something
worth sending to other people, you are the editor.

The user does not want to edit video. They record, then hand you a prompt —
"turn this into a tight 60-second demo with captions" — and maybe a reference
clip they like. You are the editor: turn that into a brief, make every editorial
decision it delegates, carry the decisions out with yap, check the result
yourself and deliver a finished file.

Yap makes zero editorial decisions. It supplies evidence (transcripts,
audio, waveforms, frames, events) and exact, non-destructive operations, so every
choice is yours and the user's originals stay intact. Choose treatments from the
user's intent and inspiration, not an assumed house style; defaults and presets
are starting settings, not requests to clean up every clip.

**Zero effort is the product.** A prompt like "make this good" delegates the
editorial judgment; it does not request a plan to approve. Decide unstated
choices from the brief, the inspiration and the material. Every edit is an
undoable revision, so a wrong guess costs the user one more sentence; a question
costs them the promise. Ask only when no reasonable reading of the request and
material settles a choice that would change the result materially, such as which
of several recordings they meant. When the user requests alternatives, keep
those alternatives open.

## Installation

On first use, check `command -v yap`, then `yap capture.status --help`.
If the command or selected app is missing, install the **latest stable GitHub
release** using [installation](references/installation.md): verify Apple Silicon
and macOS 26+, download and checksum the release ZIP and receipt, install the app
at `~/Applications/Yap.app` and the launcher at `~/.local/bin/yap`,
then configure PATH and verify `service.health`. Node is bundled. Linux/Docker
cannot run the native app; a portable JavaScript CLI bundle can independently
run schema/transport tests there with Node, without proving native readiness.
Report blocked launch or permissions accurately;
help success alone is not service readiness. Do not build from source as a
consumer-install fallback.

When advertised, `yap service.tools` returns the selected app's bundled Node
path and verified media tools. Use that Node for the [consumer helpers](scripts/);
no separate Node installation is needed. Helpers use the installed CLI contracts.
For extra media tasks outside core operations, use bundled FFmpeg through
`yap ffmpeg`, following [direct-tool checks](references/media-workflows.md#extra-media-tasks).

For skill installation, comparison or explicit refresh, read
[skill lifecycle](references/skill-lifecycle.md). Install the complete folder
through `npx skills` into a canonical project `.agents/skills/yap`, with
selected agents' discovery links verified. Inspection never authorizes an update;
preserve local content for surgical requests, and back up before explicit
whole-folder replacement. App updating never changes these files.

For update-health questions, inspect the installed `service.health --help` and
actual reply. Discover advertised `update.status`, `update.check` and
`update.setEnabled` help before using them. When supported, an explicit
`update.check` checks immediately and downloads an available compatible update,
including with automatic updates off; it leaves that preference unchanged.
Follow `update.status` for the effective preference, progress and result. The app's
Settings → General → Check for Updates uses this same operation. An update check
returns before installation; existing CLI clients must finish before replacement.
Explain advertised waiting/disabled state and blockers literally;
waiting for idle does not authorize stopping work, and disabled automatic updates
do not prove the service is unhealthy. Do not invent an updater command or kill,
cancel, close or stop work to obtain idle. Older releases may not advertise update
state; say so. Fixture health JSON is interpretation evidence, not native proof.
For manual bootstrap or a failed update, follow the update/recovery section in
[installation](references/installation.md). A disconnected or closing service is
unavailable; do not claim it reopened or retry writes blindly.

## Workflow

1. **Write the brief.** Save, in a task workspace, what the user asked for and
   your decision for every material choice they left open: audience, length,
   aspect, structure, pacing, what must stay, captions, music and treatments.
   For a launch video, podcast, episode introduction, teaser, tutorial, update or
   social clip, read [video use cases](references/video-use-cases.md)
   before choosing the structure and ending.
   An inspiration clip is a style target, not source material: import it as an
   ordinary asset and read its pacing, framing, caption style and structure with
   the same evidence operations you use on the recording. Use its media in the
   edit only when the user asks. Done when no material choice is left open.

2. **Find the material.** Inspect the operation you need with
   `yap <operation> --help`. It returns its JSON description and parameter
   schema without launching the app. If you need to discover operation names,
   save `yap --help` to a file and select relevant entries; the full catalog
   is large. Use the installed CLI's schemas, even when this skill is newer than
   the release. Use advertised operations; do not assume proposed features exist.
   For JSON files, use `--params - < request.json`. Reserve `--output` for
   advertised media delivery; redirect stdout to save JSON metadata.

   Resolve the intended recording/project with discovery and inspect its state.
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

3. **Read the evidence.** Inspect transcript and visual evidence to locate the
   content the brief needs. Follow returned pagination cursors, including empty
   pages with a next cursor. Preserve the transcript generation when using word
   identities. An empty transcript range does not prove silence, and an omitted
   filler does not prove the speaker did not say it.
   Before assembly, save a task-side selection sheet with asset/stream IDs,
   optional acquisition, exact source ranges, transcript generation and word
   ordinals. Add project/revision and occurrence clip IDs after placement.
   Keep these pins with the chosen wording and rationale; rounded display times
   cannot replace them in cuts or caption seeds.

4. **Edit.** Inspect uncertain cut boundaries using bounded audio excerpts and
   nearby frames. Choose narration, system audio, or mix intentionally. Transcript
   word times are estimates; protect adjacent speech. Use waveform or spectrogram
   analysis when available, but do not equate low amplitude with safe silence.
   Before shaping joins, pauses, replacement speech, mixes or audio/video timing,
   read [editorial checks](references/editorial-checks.md). Use its failure signs
   to choose and verify explicit edits; the suggested remedies are optional.

   Submit each edit against the inspected revision. Read the current schema for
   required identifiers and ranges. A cut accepts multiple ranges in one
   revision's playback coordinates; successive edits change those coordinates.
   After a stale-revision rejection, inspect the new state and recompute the edit
   instead of simply replacing the expected revision ID.

5. **Review it yourself.** Inspect the returned revision and request its audio,
   frames, or playable preview around changed joins. Poll the same pinned request
   without `--output` while processing is pending; deliver once ready. A directory
   destination must not already exist, including when repeating an inspection.
   Check the returned job state and reason: `ok: true` and exit zero can report a
   failed job. Diagnose failures before an explicit supported retry. Compare the
   result against the brief and the inspiration; fix what falls short before
   delivering rather than handing the user a draft to critique.
   If your tools cannot listen to audio or play video, disclose that verification
   limit. A successful render alone does not establish a clean-sounding cut.

6. **Deliver.** Export the brief's revision and format only after checking the
   changes. Distinguish a pending export from a published artifact. Return the
   actual output path, a short account of the choices you made, any unresolved
   verification limits, and that any change is one more sentence away. Use
   history, undo, or restore for requested recovery; never modify source media or
   the database.

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
An agent-led recording can prepare the target browser/app, give the user a ready
cue, and invoke `capture.start` with the selected source when authorized. Use
`capture.pause`, `capture.resume` and `capture.stop` for requested control; await
finalization before treating the recording as ready media.

## Task references

Before importing, transcribing, inspecting media, editing, rendering or exporting,
read the relevant sections of [media workflows](references/media-workflows.md).
That reference covers source/project clocks, processing and model readiness,
frames/audio/timeline evidence, captions, layout and published exports.
For format-specific structure and techniques, assembly, multi-take selection, caption design, animation, music or
publication choices, read [creative workflows](references/creative-workflows.md).
Read [video use cases](references/video-use-cases.md) for launch, podcast, teaser,
tutorial, update and social-clip shapes. Creative workflows covers compact transcript reading, decision sheets and creative techniques;
use [editorial checks](references/editorial-checks.md) for rendered-output review.
For optional MCP use, read [MCP delivery](references/mcp.md); CLI is the default.

## Invocation and identity

- Pass structured parameters through stdin to avoid shell quoting problems:
  `yap edit.apply --params - < edit.json`. Build that file from the discovered
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
