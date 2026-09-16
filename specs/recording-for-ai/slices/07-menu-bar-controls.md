# 07 — Usable menu-bar recording controls

Status: partial implementation; native acceptance remains open. Dependencies: 03, 06.

See [integration notes](../assets/recording-controls/integration.md) for the tested
boundary, unfinished verification, and next pickup. Delete and storage total are
still missing; this slice is not complete.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

The user can perform all agreed capture controls without invoking an editing UI.

Build the native status-bar shell over service operations: select display/window/region, mic device/on-off, optional system audio, start/stop/cancel/pause/resume/restart. Show recording/paused elapsed playback time, processing and interruption state. Add a small recent-recordings list with status, playback-preview action, two exports, delete and storage total; no trimming timeline. In this slice preview and export actions are visibly unavailable
until their owning slices are implemented; slice 13 wires preview and slice 14 wires
the two exports and verifies their menu behavior. Never fake successful actions.
Use stable app identity for permissions.

## Runnable checkpoint

Run bun run lab:recording-controls. Record each source type, pause to prepare a browser state, resume, restart a take, cancel another, stop and inspect newest status. Exercise permission denial and source loss. Supply keyboard shortcuts through the same operations and confirm their active-state behavior.

## Acceptance

Controls agree with CLI status; restart discards only the current take. Pauses omit media but retain elapsed marker. Toggle no-narration works. System audio label never implies selected-tab isolation. Suggested defaults: Control-Option-Command-R start/stop, P pause/resume, X cancel, N restart; collisions disable binding with a visible settings override rather than stealing an existing shortcut.

## Decisions delegated and scope firewall

Typography, spacing, icons and menu grouping are delegated within native conventions; controls/semantics are fixed. Source-picker and recording controls can be reviewed in two passes if the change touches distinct visual variables.

## Visual review

Judge state clarity and source selection. Retain separate captures of idle/selecting/recording/paused/interrupted; compare prior/reference states where available, then screenshot-critique last. Use preview-shots for a non-blocking human checkpoint.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

Confusion about active source, microphone or recording state warrants UI revision, not new product scope. Editing GUI remains in its future spec.

