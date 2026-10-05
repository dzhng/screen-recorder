# Implementation choices

This is the per-pass ledger. Final closeout must reconcile it against shipped
behavior and remove provisional or superseded entries.

## Sound

### Keep native Settings scrolling after adding Camera — medium confidence

**When:** admission/permissions pass 04.

**Choice:** The extra Camera permission row pushes General settings below the
initial Settings viewport. The existing native form scrolls to those settings;
we keep that platform behavior. The capture panel likewise retains an overlay
scrollbar and a partial row when constrained to a short screen. A custom
continuation treatment could advertise
more content, but would add a separate visual change beyond the permission row.

**Gap:** The plan required camera permissions and intact lower settings, without
choosing an extra scroll hint. **Reach:** Settings still relies on familiar native
scrolling. **Verdict:** sound for this pass because the actual lower settings are
reachable and preserved. The independent visual review flags the weaker initial
cue; discoverability remains a limitation for composed acceptance.

### Preserve one chosen camera identity inside controls — high confidence

**When:** capture admission pass 04.

**Choice:** If a person switches from Display to Camera Only, controls retains one
chosen camera device ID in its existing selection. Camera Only is an incomplete
mode until that ID is available. On Start, the ID goes inside the primary source;
for screen recording it remains an optional companion. The alternative is two
parallel selected-camera IDs that could disagree after a mode change.

**Gap:** The public shape was fixed, but the internal incomplete UI state was not.
**Reach:** Capture UI and external active-take restoration use the same selection.
**Verdict:** sound; one identity avoids substitution and duplicate authority.

### Preserve last-good catalog on every failed discovery — high confidence

**When:** capture admission pass 04.

**Choice:** If a screen listing fails after a person selected a camera, the app
keeps its last observed devices and selection while displaying the error. Missing
screen authorization instead returns a successful catalog with empty screen
arrays. The alternative erased every device for a screen-permission error,
including cameras that do not need screen access.

**Gap:** Independent discovery required revising the old failure handling.
**Reach:** Discovery errors no longer imply that devices have disappeared.
**Verdict:** sound; actual device disappearance still comes from a successful new
catalog, and camera Start checks the selected device against that catalog.

### Preserve inherited primary-frame duration fallback — medium confidence

**When:** primary camera authority pass 02.

**Choice:** A prerecorded camera picture with no positive duration uses the
primary writer's existing 33,333 microsecond fallback, and a healthy stop keeps
its existing final-picture tail. A new camera-specific timing rule could produce
a different endpoint even though the pictures are identical.

**Gap:** The authority proof needed a general primary-video input without changing
existing timing policy. **Reach:** Live camera cadence still needs qualification
in pass 08; this is a publication proof, not a live-clock claim. **Verdict:** sound
for authority preservation, provisional until actual device-clock evidence.

### Keep selected indexes as immutable view facts — high confidence

**When:** capture geometry pass 01.

**Choice:** When two devices have the same name, the panel still selects the
owner's exact choice. Its immutable input includes choices and selected indexes;
its native popup emits the selected choice's intent. The alternative lets the
view guess from a title or pick the first item, losing device identity.

**Gap:** The view input shape was unspecified. **Reach:** Production projection
must compute indexes from stable IDs each time; the view owns no device selection.
**Verdict:** sound, verified by duplicate-name and selected-choice regressions.

### Draw the native source popup title at reference emphasis — high confidence

**When:** capture geometry pass 01.

**Choice:** The source popup retains the native menu and keyboard behavior, while
its title drawing uses regular weight to match the chosen concept. Otherwise
AppKit's default title ignores the requested font and dominates adjacent labels.

**Gap:** The platform ignored the supplied regular font. **Reach:** Appearance
work can refine the same control without replacing its native interaction.
**Verdict:** sound; one native control retains selection and accessibility.

### Route supplied presentation intents into existing actions — high confidence

**When:** capture geometry pass 01.

**Choice:** Clicking an existing action carries the same ControlsAction used by
shortcuts and Settings. Source-mode, camera and countdown intents remain explicit
until production binding. The alternative would make the fixture call services
or create another mutable recording model.

**Gap:** Geometry preceded shared camera/action admission. **Reach:** Binding in
pass 06 must use RecordingControls' dispatcher; these intents are presentation,
not a second capture protocol. **Verdict:** sound with binding explicitly open.

### Prove core reopen using the actual native publication — high confidence

**When:** primary camera authority pass 02.

**Choice:** A dedicated core probe reads the native fixture's publication and
original media, then opens and reopens the real catalog. Ordinary portable tests
continue using their own authored data. Otherwise each layer could pass while
rejecting the other layer's real output.

**Gap:** Cross-language publication needed an executable consumer. **Reach:** The
probe verifies current owners without introducing a second publication format.
**Verdict:** sound; native output is the operand rather than a duplicated fixture.
