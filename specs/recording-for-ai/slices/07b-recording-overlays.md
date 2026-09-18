# 07b — Countdown and recording overlay

Status: planned (user request, 2026-09-18). Parent: [07](07-menu-bar-controls.md).

Recording from a menu-bar icon leaves a person guessing when capture began and hunting
through a menu to stop it. Standard screen recorders count down before they start and
float a small control while they run.

## Contract

- **Countdown before capture.** Choosing Start shows a large 3-2-1 countdown on the display
  that will be recorded, then capture begins. The take therefore never contains the count.
  Escape during the countdown abandons the start, and no recording is allocated. A Settings
  preference turns the countdown off; the default is on.
- **Recording overlay.** While a take is recording or paused, a small floating panel shows the
  take's own elapsed playback time and offers pause/resume, finish and cancel: the same
  operations the menu sends, never a second device state machine. It floats above other
  windows, can be dragged, and remembers where it was left. It appears only while a take is
  live, whichever client started it.
- **Neither appears in the recording.** Display and region capture exclude this app's own
  windows. Window capture already records only the chosen window.
- **No overlay steals focus.** Both are non-activating panels: clicking their controls must not
  pull the person out of what they are recording.

## Owners

Native owns overlay windows and the countdown; the controls state it already holds says
whether a take is live and how long it has run. Overlay actions send the existing capture
operations through the same owner the menu uses. The countdown preference lives with the other
UI preferences.

## Verification

- **Controls tests** pin when each overlay is visible from state alone: hidden while idle,
  visible while recording and paused, gone once a take finalizes or the service is lost.
- **A capture check** records the display with both overlays on screen and inspects decoded
  frames: no overlay pixels appear in the take.
- **An app-level check** proves Escape during the countdown allocates no recording, and that a
  countdown of zero starts immediately.
- **Visual:** captures of the countdown and the overlay in both appearances, reviewed by an
  unprimed critique.
