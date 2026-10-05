# Consolidated implementation choices

All entries below describe the final implementation. User-selected feature scope
is recorded separately in [decisions.md](decisions.md).

## Sound — medium confidence

### Show raw saved-media identities as supporting details

**When:** Library presentation. **Choice:** A recording row shows its time and
status, with its recording/source IDs below when available. A project row keeps
its revision identity. These are the service's existing facts; the alternative
was inventing richer titles or descriptions the service does not provide.
**Gap:** The mock used illustrative content. **Reach:** Library currently favors
traceable facts over polished source summaries. **Verdict:** sound within the
existing contracts, but this is the least certain presentation choice.

### Keep ordinary native scrolling

**When:** capture/Library shells and Settings camera permissions. **Choice:** On
a short display, lower controls scroll into view at their normal size rather
than shrinking or adding a new custom continuation system. **Gap:** The concept
showed a roomy screen. **Reach:** Smaller screens rely on native scrolling to
reach the footer and longer item details. **Verdict:** sound; discoverability is
a limitation rather than another presentation subsystem.

### Preserve the primary writer's existing endpoint policy

**When:** Camera Only acquisition. **Choice:** A camera frame without a usable
duration follows the ordinary primary writer's duration fallback; finishing a
take uses its existing final-picture tail. A camera-specific rule could change
endpoints independently of the supplied pictures. **Gap:** Primary camera
acquisition did not prescribe a new endpoint policy. **Reach:** Camera and
screen primary media share publication timing policy. **Verdict:** sound for
one timing owner; live-device timing remains unverified.

## Sound — high confidence

### Keep one selected camera identity

**When:** capture admission and UI binding. **Choice:** Switching from a screen
take to Camera Only retains the explicitly chosen camera ID. Starting sends it
inside the primary source; a screen take sends it as a companion. Two parallel
camera selections could disagree after a mode change. **Gap:** Internal UI
selection was unspecified. **Reach:** One shared selection serves UI and active
take restoration. **Verdict:** sound; unavailable identities are not substituted.

### Preserve the last successful device catalog on a failed read

**When:** capture admission. **Choice:** If discovery fails, the last observed
camera/display choices stay visible with the error. Missing screen authorization
instead returns empty screen choices while camera/microphone discovery remains
available. **Gap:** Independent camera discovery exposed the old screen-first
failure handling. **Reach:** A failed read does not pretend devices disappeared.
**Verdict:** sound; fresh Start still validates the selected camera.

### Supply device indexes from stable identities

**When:** capture presentation. **Choice:** Two cameras with the same display
name still select the exact chosen ID. The owner supplies choices and the chosen
index; the native popup emits the matching intent. **Gap:** View input geometry
needed a selection representation. **Reach:** Views cannot infer device identity
from labels. **Verdict:** sound; one owner selects devices.

### Keep AppKit chooser interaction with custom title drawing

**When:** capture presentation. **Choice:** The source/device popups retain
AppKit selection and keyboard interaction while drawing their selected title at
the approved emphasis. The platform's default popup title dominated neighboring
labels. **Gap:** Native text emphasis differed from the concept. **Reach:** Visual
styling does not introduce another chooser interaction model. **Verdict:** sound.

### Fence page work by the current observation

**When:** Library paging. **Choice:** Changing pages or replacing the service
invalidates delayed replies from the old request. A restart resets navigation
history while retaining last-good rows until replacement arrives. A preparation
read controls its busy flag only for the page that requested it. **Gap:** Paging
introduced asynchronous answers that can arrive out of order. **Reach:** An old
response cannot overwrite newer browsing state. **Verdict:** sound.

### Carry explicit action identities through Library refreshes

**When:** shell closeout. **Choice:** If export status changes while a row menu
is open, its selected command still names the original media/action. The menu
item carries that identity; the existing controller decides whether it remains
applicable. Looking up a detached row by object identity could silently drop the
click. **Gap:** Independent Library can refresh while native menus track.
**Reach:** Refresh does not erase explicit user intent. **Verdict:** sound.

### Use the actual publication for the cross-owner fixture

**When:** primary camera authority. **Choice:** The core reopen probe reads the
native fixture's emitted publication and originals instead of a second invented
publication. Otherwise each component could accept its own fixture and disagree
at their boundary. **Gap:** The format crosses native and service/core owners.
**Reach:** The fixture checks one shared publication contract. **Verdict:** sound;
it does not establish physical camera availability.
