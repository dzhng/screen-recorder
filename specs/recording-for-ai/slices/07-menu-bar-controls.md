# 07 — Usable menu-bar recording controls

Status: implemented; native acceptance remains open. A combination macOS itself holds is now
refused before it is asked for and named in the menu (`SystemShortcuts`), which is the detectable
half of the collision contract; another application's own registration cannot be detected through
any public API, and that limit is [recorded](../choices.md). Dependencies: 03, 06; delete/storage controls additionally require 15b.

See [integration notes](../assets/recording-controls/integration.md) for the tested
boundary, unfinished verification, and next pickup.
[Recent delete/storage controls](../assets/recording-controls/recent-storage.md)
pass focused state/identity checks, and both [export actions](../assets/export-controls/README.md)
pass controller and bundled-service checks. Actual native interaction and visual
review remain open; this slice is not complete. The [native shortcut collision probe](../assets/recording-controls/shortcut-collisions.md)
also identifies an unresolved availability contract; exclusive registration is not a safe fix.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

The user can perform all agreed capture controls without invoking an editing UI.

Build the native status-bar shell over service operations: select display/window/region, mic device/on-off, optional system audio, start/stop/cancel/pause/resume/restart. Show recording/paused elapsed playback time, processing and interruption state. Add a small recent-recordings list with status, playback-preview action, two exports, delete and storage total; no trimming timeline. Slice 13 wires preview and slice 14 wires the two exports and verifies their menu
behavior. Never fake successful actions.
Use stable app identity for permissions.

## Runnable checkpoint

The machine half of this runs as checks: every capture operation through the real app and
service, pause and resume, restart, cancel, and the newest take's status
(`apps/macos/tests/capture-service.test.mjs`, `recording-controls.test.mjs`,
`menu-updates.test.mjs`), permission states and source loss through the controls state
(`apps/macos/tests/ScreenRecorderControlsTests/`), and the shortcuts going through the same
operations the menu sends. The half that stays open is a person actually clicking this menu:
computer-use could not reach a menu-bar item on this Mac, which the
[integration record](../assets/recording-controls/integration.md) states rather than claims
around.

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

