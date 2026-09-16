# 13 — Playable edited media and audio joins

Status: native video timing, bounded PCM and encoded movie assembly verified; full edited playback remains open.
Dependencies for full completion: 09, 12.
Start with [13a — native render timing feasibility](13a-native-render-timing.md),
which can prove the existing render-plan/native-worker seam before speech and the
full CLI/MCP journey are ready. [13b — bounded retained audio](13b-streaming-audio.md)
can proceed independently through the existing excerpt consumer. These checkpoints
do not relax this parent's completion gates.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

[13d1 — presentation evidence](13d1-presentation-evidence.md) isolates the
held-picture versus nearest-frame distinction needed before movie pointer planning.
[13d2](13d2-presentation-pointer-core.md) shares pointer policy over exact presentation support.
[13d3](13d3-pointer-schedule.md) persists sequential reset state for native composition.
[13d4](13d4-pointer-composition.md) streams those states into the existing encoder
with an exact clock.

## Contract and API seam

The same revision inspected as words/images can be played and heard as edited video.

Execute the core's pinned kept-source render plan with AVFoundation. Render H.264/AAC MP4 with current pointer and agreed track mix. Add the defined in-span audio ramps at joins without changing duration. Expose temporary preview job/result and wire the previously unavailable menu preview action to app playback; verify it displays the pinned revision. No separate native range interpreter or edit store.

## Runnable checkpoint

Run bun run lab:edited-media. Render trims, two middle cuts, cut across pause, very short retained span, mid-word cut, undo and restored original. Decode frame numbers and isolated/mixed audio around joins. Compare source hashes and expected duration; inspect preview while another edit commits.

## Acceptance

Output represents its pinned revision, not whatever is current at completion. Both audio tracks and cursor follow the same cut spans. No deleted frame/word leaks at a boundary; adjacent kept speech is audible. Source hashes never change. No extra duration from ramps; target A/V drift still holds.

## Decisions delegated and scope firewall

Encoder bitrate/AVFoundation composition internals are delegated subject to readability and timing tests. No hidden snapping, crossfade overlap, or post-processing AI. Reuse native frame/render primitives instead of another media stack.

## Visual review

The [production cut-join review](../assets/video-render/joins/README.md) accepts
frame identity/orientation. The [color-metadata correction](../assets/video-color/README.md)
then improves source-color preservation in actual player windows and owned capture
frames. The [owned browser text comparison](../assets/text-fidelity/README.md)
then checks captured-resolution light/dark text at two sizes against three
bitrate-only variants. Independent review finds no meaningful full-frame
readability win over automatic bitrate; retain that default. This is bounded
source-relative text evidence, not pixel-perfect reconstruction, motion-quality
acceptance or disappearance of all earlier enlarged label artifacts. It stays
distinct from exact temporal membership and pointer placement. Full-original
preview also needs the separately observed capture/container tail mismatch fixed.

Temporal joins/pointer placement only; compare near-join frames to source-span expectations, then screenshot-critique last. Listen to source and edited excerpts for audible artifacts.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If exact cuts clip neighboring speech, distinguish bad ASR timing from render error and reopen the owning gate; do not alter user-requested ranges silently.


AAC assembly now has a [bounded feasibility checkpoint](13c-aac-movie-assembly.md).
It preserves the common presentation clock in native playback and records tiny
AAC decoder differences. Native movie assembly now shares the service attempt
owner and passes five-minute encoded A/V checks. [Preview publication](13e-preview-publication.md)
owns the next job/cache boundary; pointer composition and public playback remain open.
