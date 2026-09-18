# 07b — Countdown and recording overlay

Status: implemented (2026-09-18), except dragging and the second display, which need a person
and a second screen. Parent: [07](07-menu-bar-controls.md).

The count, the floating controls, the preference and the capture exclusion are in place and
checked. [Captures of both panels](../assets/recording-overlay/README.md) cover both appearances
and were reviewed by three unprimed critiques, which moved five things: finishing a take and
throwing one away no longer read as two grey squares beside each other, recording and paused
differ in shape before they differ in colour and carry the same mark the menu bar does, the clock
goes quiet when the take does, both lines of the count are at a contrast a light screen does not
swallow, and each panel is the size of what it has to say.

Two things this slice found are worth keeping in mind. A whole-display filter can only exclude
applications the system currently lists as sharing something, and a menu-bar app showing nothing
is not listed — so excluding this application by identity covers its Settings and preview windows
but could never have covered panels that appear after a take has already started. Those panels
are marked unshared instead, which the window server honours from the moment they open, for every
capture including other recorders'. The frame-level check reads decoded frames of two display
takes with the controls left in a different place each time, and neither place differs from the
rest of the picture; with the panels shared, the same check sees them plainly.

Still open: nobody has dragged the controls with a pointer, so the saved position is only
exercised through the preference a check writes; and the count has only been seen on a
single-display Mac, so which display it lands on is unverified for a second screen.

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

- **Controls tests** (`ScreenRecorderControlsTests`) pin when the floating controls are visible
  from state alone — hidden while idle, visible while recording and paused, gone once a take
  finalizes or the service is lost — what they read, the three, two, one the count spends, and
  the preference read back through the preference owner on a fresh state.
- **A capture check** (`apps/macos/tests/capture-exclusion.test.mjs`) records the display twice
  with the floating controls left somewhere different each time, and reads decoded frames: where
  the controls were, the two takes differ no more than the picture as a whole does.
  `runCaptureExclusionTests` pins which applications a display filter leaves out.
- **An app-level check** (`apps/macos/tests/recording-overlays.test.mjs`) proves Escape during
  the countdown allocates no recording and leaves nothing on screen, that the count holds Escape
  while it runs, that a start with the count off records immediately, and that the controls
  appear while recording and paused and are gone once the take ends. It never activates the app.
- **Visual:** [eight captures](../assets/recording-overlay/README.md) of the count and the
  controls in both appearances, reviewed by three unprimed critiques.
