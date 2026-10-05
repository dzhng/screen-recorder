# Capture popover and independent Library

The menu-bar control is a compact native capture popover. Saved recordings,
caller-created projects, tracked exports and storage belong to an independent
Library window. This separation keeps capture immediate without turning browsing
into a transient menu. The approved direction is Design A.

## Why these boundaries

The user clarified that *saved recordings* should move out of the menu, then
selected a Library that remains open independently until closed. Capture setup
therefore stays at the menu bar. Opening Library dismisses the popover; closing
Library does not quit the app. Reopening restores the same session-local window,
tab and browsing state, rather than creating another observer.

Camera Only was explicitly included during design selection. It uses an ordinary
primary camera source, because treating every camera as a companion would require
an empty screen recording or another persisted format. The selected camera ID
belongs inside the primary source; the existing companion field remains for
screen-plus-camera takes. Existing media remains readable without migration.

The user selected a hard cutover. The old list renderer is removed. Views consume
shared presentation facts and dispatch the same actions as Settings and shortcuts;
there is no hidden compatibility menu or separate UI recorder.

## Invariants

- Source media stays intact. Capture and browsing create no editing project,
  composition, crop, mix or other editorial treatment automatically.
- A requested camera requires an explicit device identity. A missing camera is
  never replaced silently. Active takes retain their observed inputs and keep
  finish/pause controls independent of idle setup requirements.
- Camera Only with system audio off does not prepare a screen source or cursor
  sampler. Requested system sound uses the existing audio-only screen-capture
  helper and authorization meaning; it does not publish screen video.
- Permissions are requested through explicit Allow actions. Failures remain
  visible beside capture controls or the relevant Library operation.
- Bounded pages retain the existing recording/project contracts. “Filter this
  page” describes only loaded items and clears on navigation. Exports is tracked
  delivery/recovery, not a complete historical archive.
- Native controls retain capture focus through refreshes. Library commands carry
  their explicit action identity even if an asynchronous refresh replaces a row.
- Refreshes do not activate the app. Opening Library or Settings is an explicit
  request that may focus its native window. The popover follows native transient
  dismissal and scrolls on short screens at the approved control sizes.

## Owners

The [native app](../../../apps/macos/README.md) names the capture and Library
presentation owners. `RecordingControls` projects shared state into `CaptureView`
and `LibraryView`; `CapturePopover` and `LibraryWindow` own native containers.
`CapturePresentation`, `LibraryPresentation` and `ExportPresentation` own display
facts and applicable actions. `LibraryController` owns pages and delayed replies.

[Capture admission](../../../packages/protocol/src/capture.ts) owns the public
camera source shape. The [native capture owner](../../../helpers/mac/Sources/ScreenRecorderCapture/README.md)
owns selected acquisition, the clock and publication. Primary versus companion
allocation remains distinct from device kind.

## Visual provenance

The [user reference](assets/references/user-menu-reference.png) inspired the
menu treatment. The user-selected [sharp Design A concept](assets/references/camera-idle-sharp.png)
and [dark concept](assets/references/camera-dark-sharp.png) define the four-tile
layout, device rows and separate Library. [Reference authority](assets/README.md)
preserves their provenance and hashes; the [clickable concept](visualizations/design-a-camera.html)
is a frozen design artifact.

[Final light capture](assets/final/capture-light.png),
[light Library](assets/final/library-light.png),
[dark capture](assets/final/capture-dark.png) and
[dark Library](assets/final/library-dark.png) render production native views with
synthetic facts. They show content geometry, not installed-app or live-device
acceptance. Native titlebar/shadow rasterization and truthful source icons differ
from the illustrative concept's chrome and thumbnails; no thumbnail pipeline was
introduced.

## Verification boundary and departures

The user explicitly asked to finish with live-device checks unverified, then
requested lean verification for this UI work. That superseded the planned physical
reproduction, screenshot matrices and full-suite ceremony. Final app compilation
passed, and a quick independent light/dark visual review found no remaining
visible defects in the captured idle state. [Verification](verification.md)
records the exact boundary. Camera/microphone and live system-audio behavior remain
**unverified** on this Mac, which has no camera or microphone input.

Early focused fixture/publication/admission/paging observations remain under
`evidence/` and `assets/evidence/`. They are historical scoped evidence, not proof
of physical acquisition. The original build plan is in Git before closure.

A separate capture-setup modal was rejected in favor of the selected popover.
A compatibility menu, screen donor for camera primary, generated thumbnails,
global search, complete export archive and new audio backend were deliberately
excluded. [User decisions](decisions.md) and the consolidated
[implementation choices](choices.md) retain the reasons future changes inherit.
