> **Superseded planning artifact.** Follow [the canonical spec handoff](../../README.md), not the kickoff prompt or OPEN list below. Those questions now belong to named slices. Clock clarification from later source inspection: the screen-zero constraint concerns the primary writer; existing companion-camera media already has an independent origin and must retain it. This annotation and relocated links are the only archival edits.

# Screen Recorder menu redesign — completed exploration map

Status: exploration complete, October 5, 2026. No production implementation started. This map uses explore-unknowns and design-with-images; the user requested mockups first.

## Selected mockup and provenance

[Open the clickable Design A mockup](../../visualizations/design-a-camera.html). [Approved light layout](../references/camera-idle-sharp.png). Other reviewed states: [Camera Only](../references/camera-only-sharp.png), [camera permission](../references/camera-permission-sharp.png), [service unavailable](../references/service-unavailable-sharp.png), [finalization issue](../references/finalization-issue-sharp.png), [dark appearance](../references/camera-dark-sharp.png).

The target is capture setup in the menu-bar popover and saved recordings in an independent Library window. The supplied reference is [the user's Cap-like menu image](../references/user-menu-reference.png).

These are screenshots of a self-contained HTML concept. Image generation was unavailable. They are neither generated bitmap designs nor screenshots of the native app. Device names, timestamps, thumbnails, storage values and media states are illustrative. Prototype actions perform no real capture, permissions, deletion or export. The prototype's bottom reply chip belongs to the earlier interview and is superseded by the build prompt at the end of this map.

## 1. Known knowns — settled ground

- Native macOS is the target. Capture setup, live controls, Settings and keyboard shortcuts already share one state/action path. Preserve that ownership. Evidence: [native app README](../../../../../apps/macos/README.md), [RecordingControls](../../../../../apps/macos/Sources/ScreenRecorder/RecordingControls.swift).
- The current menu mixes capture with saved recordings, projects, exports and storage. The new popover keeps capture and navigation; saved-media content moves into Library. Evidence: [ControlsMenu](https://github.com/dzhng/screen-recorder/blob/ec8a59df761c6bfbb0c78a8cba93717f25fee066/apps/macos/Sources/ScreenRecorderControls/ControlsMenu.swift), [StatusMenu](https://github.com/dzhng/screen-recorder/blob/ec8a59df761c6bfbb0c78a8cba93717f25fee066/apps/macos/Sources/ScreenRecorder/StatusMenu.swift).
- Display, Window and Region are current primary capture sources. Optional camera recording exists beside them. Camera Only is a new shared behavior contract. Evidence: [capture schema](../../../../../packages/protocol/src/capture.ts), [controls selection](../../../../../apps/macos/Sources/ScreenRecorderControls/ControlsState.swift).
- Discovery does not select or activate cameras. Explicit stable device selection is required. Evidence: [discovery contract](../../../../../packages/protocol/src/capture.ts), [native device discovery](../../../../../helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift).
- Original screen, camera, microphone and system sound remain independent source media. Capture makes no automatic picture-in-picture composition or editing project. Evidence: [capture principles](../../../../../helpers/mac/Sources/ScreenRecorderCapture/README.md).
- The existing Library and export controllers own reading, identity, deletion and delivery. New views must reuse these actions rather than create a second service boundary. Evidence: [LibraryController](../../../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift), [ExportMenu](https://github.com/dzhng/screen-recorder/blob/ec8a59df761c6bfbb0c78a8cba93717f25fee066/apps/macos/Sources/ScreenRecorderControls/ExportMenu.swift).
- Authorization covers this exploration and mockup handoff. Production code, builds and native recordings were not changed or run. Existing unrelated workspace changes remain intact.

## 2. Known unknowns — decisions and attribution

### Answered by the user

| Question | Decision | Reason / evidence |
| --- | --- | --- |
| What leaves the menu? | Design A: saved recordings move into Library; capture setup stays in the popover. | User: “design A” and “I meant saved recordings.” |
| Match the reference's camera capability? | Include camera selection/toggle and Camera Only alongside Display, Window and Area. | User selected B, the option explicitly including camera behavior. |
| Does Library dismiss with the menu? | Library is an independent window, open until explicitly closed. | User selected A for window lifetime. |
| How should errors appear? | Inline explanations with explicit Allow/Retry actions. | User selected A for demonstrated recovery. |
| Is the expanded layout too dense? | Keep its density, spacing and control sizes as shown. | User selected A for the expanded mockup. |
| Who resolves remaining routine UX details? | Agent may answer from the confirmed preferences during this walk. | Most recent A explicitly opted into the preference checkpoint's delegation. |

Confirmed preferences: immediate capture access; persistent saved-media browsing; camera capability matching the reference; inline recovery; the expanded concept's compact density. Delegation covers remaining routine UX details following those preferences. It does not authorize implementation, scope expansion, or guessing missing technical facts.

### Answered by the agent on the user's behalf

Each entry was disclosed to the user during the handoff. Corrections may reopen it.

| Question | Answer | Confirmed preference and reason |
| --- | --- | --- |
| How does the popover dismiss? | Outside click or Escape closes it; opening Library closes it too. | Immediate capture access and separate persistent browsing; normal transient menu behavior. |
| What happens when Library opens again? | Focus the existing window, retain its selected tab, restore it if minimized. | Persistent Library; duplicate windows would fragment the browsing state. |
| How does Library close? | Explicit close or ⌘W closes the window without quitting the recorder. | Independent window lifetime and existing native window conventions. |
| Can inputs change mid-take? | Lock source and audio controls for the current take; retain pause, finish, restart and cancel. | Immediate transport access while preserving the take's original inputs. |
| What if Camera Only lacks a camera? | Require an explicitly selected available camera; show the missing selection/device inline. Never silently switch source. | Requested camera capability and inline recovery; a different source would violate the user's request. |
| How does appearance follow macOS? | Use system light/dark mode, with the reviewed treatments. | Native menu reference; retain hierarchy and contrast in both appearances. |
| What happens on a short screen? | Retain approved control sizes; scroll when needed, keeping every action reachable. | Approved density; do not shrink controls to fit. |
| What about keyboard access? | Make controls, device selectors and recovery actions keyboard-accessible; Escape dismisses the popover. | Native menu conventions and accessible immediate capture. |
| Where do failures go? | Capture failures in popover; saved-item failures with Library items; shortcut failures reveal the inline reason. | Selected inline recovery; attach the reason to the affected operation. |

### Answered by the territory

- Preserve one controls-state/action owner, source identity and stale-reply protections. A view change does not change operation meaning.
- Preserve existing permission semantics: discovery/status never prompt; person-initiated permission actions may prompt or direct the person to System Settings.
- Preserve project preview/export, explicit delete and export recovery distinctions; there is no permission to create projects automatically.
- Preserve existing microphone and system-audio defaults from the protocol/preferences. The screenshot's illustrative switch positions do not redefine defaults.

### OPEN — facts to establish during the build, before the dependent change

| Fact | What unblocks it | Required outcome |
| --- | --- | --- |
| Camera Only's wire shape, source allocation and publication role | Trace protocol/service allocation, recording facts and all callers; propose one canonical contract and behavior tests before implementation. | UI, CLI and MCP agree; no fabricated screen source or duplicate owner. |
| Camera Only's microphone and system-audio acquisition | Verify the platform APIs and existing clock/writer boundaries with focused capture evidence. | Camera establishes video time zero; optional audio stays synchronized. System audio may require its own authorization, but no screen video is secretly recorded. |
| Full saved-library browsing/search | Inspect service list/query capabilities and pagination before wiring the mockup search field. | Do not label a five-item recent page as the whole library. If broader search needs new behavior, disclose that scope decision first. |
| Native visual fit and accessibility | Render native surfaces at actual scale in the relevant states; inspect small-screen placement, long device names, keyboard navigation and VoiceOver. | Match approved geometry or show a concrete constraint; HTML rendering alone does not close this item. |

These are engineering verification gates, not pending user preference questions. No platform capability or implementation design is implied by the mockup.

## 3. Unknown knowns — preferences and tacit conventions extracted

- “Recording section” meant saved recordings. This removed the ambiguity between a capture-setup modal and a saved-media window; Design B is historical, not the build target.
- The user values recognizable capture cards and device rows over a plain command list. The reference supplies warm neutral surfaces, rounded cards, subtle borders, a blue selected state and clear icon/label hierarchy.
- Compactness is intentional: the expanded four-tile mockup is the visual target, including its added height. The selected target has a 352 CSS-pixel popover, 2×2 source tiles, camera/microphone/system-audio/countdown rows and a prominent Start action. Native points and raster pixels still require scale verification.
- The user prefers persistent browsing over a transient modal sheet. Library includes Recordings, Projects and Exports; capture remains one click away in the menu.
- Inline recovery is part of the intended flow. Camera Only uses a Required badge rather than an ambiguous disabled off switch.
- The territory supplies native macOS focus and keyboard conventions. No separate audience, usage frequency or agent-only workflow was inferred from silence.

### Visual reference checks

| Feature | Target | Exploration evidence |
| --- | --- | --- |
| Silhouette and hierarchy | Rounded 352 CSS-pixel menu panel, status-bar anchor, separate Library | Sharp idle screenshot; native fit remains OPEN |
| Source arrangement | Four tiles in two columns; blue selected outline and background | Idle and Camera Only screenshots |
| Device controls | Compact consistent rows; optional camera for screen takes, Required for Camera Only | Idle and Camera Only screenshots |
| Recovery | Inline Allow/Retry and disabled Start when unavailable | Permission and unavailable screenshots |
| Finalization | Same failure meaning in menu and affected Library item | Finalization screenshot |
| Appearance | Clear primary/secondary text and blue controls in light and dark | Sharp light/dark screenshots |

Unprimed screenshot critique accepted the six sharp states without blocking clipping, overlap, alignment, blur or status inconsistency. Earlier blurred captures were rejected. Shots were shown in Preview. Prototype checks covered source switching, audio toggle, Library tabs/search and pause/resume. This verifies the mockup only. The reconstructed “Current structure” view is not an actual native before screenshot.

## 4. Unknown unknowns — landmine cards and dispositions

Coverage: a bounded sweep of 19 source/contract files around menu rendering, shared controls, Library/export ownership, permissions/preferences, windows/overlays, region selection/shortcuts, native dispatch and capture clock/publication; plus the root, macOS, capture and protocol readmes. This establishes the exploration boundaries. Camera Only's eventual implementation will require tracing additional service/caller files before editing.

### 1. Camera Only currently depends on a screen source — OPEN

**Evidence:** [primary source schema](../../../../../packages/protocol/src/capture.ts), [start selection](../../../../../apps/macos/Sources/ScreenRecorderControls/ControlsState.swift), [screen-derived source zero](../../../../../helpers/mac/Sources/ScreenRecorderCapture/README.md), [camera ingress uses the main writer's state](../../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureClockIngress.swift).

**Why it bites:** A new tile cannot produce a valid camera-only take through the current primary-source contract. A hidden screen stream would add unwanted media/permissions and leave the clock tied to the wrong source.

**Disposition:** Include Camera Only as the user chose, but map canonical selection, allocation, clock, audio and publication before coding. Tests must prove camera-only start/pause/resume/finish/recovery with no screen video requested.

### 2. Discovery and permission actions are screen-centric — decided requirement, OPEN mechanics

**Evidence:** [discovery screen gate](../../../../../apps/macos/Sources/ScreenRecorder/CaptureController.swift), [screen input authorization](../../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureInputSession.swift), [permission actions lack camera](../../../../../apps/macos/Sources/ScreenRecorderControls/Permissions.swift), [native permission request supports screen/microphone only](../../../../../helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift).

**Why it bites:** Without changing these boundaries, denying screen access hides cameras and the mockup's camera Allow action has no native path.

**Disposition:** Camera discovery and camera-only recording must work without screen permission when screen/system audio is not requested. Add camera to the shared explicit-permission path; denied access directs the person to System Settings. Do not auto-prompt on menu opening or discovery.

### 3. Recorder chrome can change focus or enter the captured frame — sharp edge

**Evidence:** [nonactivating, unshared overlay](../../../../../apps/macos/Sources/ScreenRecorder/OverlayPanel.swift), [user-open window activation](../../../../../apps/macos/Sources/ScreenRecorder/SettingsWindow.swift), [shortcut failure reveals menu](../../../../../apps/macos/Sources/ScreenRecorder/RecordingControls.swift).

**Why it bites:** A generic activating window used for live controls can redirect recorded keystrokes. Capture controls opening during a take can contaminate its video.

**Disposition:** Preserve nonactivating, capture-excluded live controls. Deliberately opened Library may activate like Settings. Verify source focus restoration after starting and capture exclusion for recorder chrome; do not infer this from an HTML screenshot.

### 4. Successful media closure is not complete publication — sharp edge

**Evidence:** [independent source publication](../../../../../helpers/mac/Sources/ScreenRecorderCapture/README.md), [joined native publication](../../../../../helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift), [retry cleanup differs from retry export](https://github.com/dzhng/screen-recorder/blob/ec8a59df761c6bfbb0c78a8cba93717f25fee066/apps/macos/Sources/ScreenRecorderControls/ExportMenu.swift).

**Why it bites:** A generic Ready pill or Retry button could hide an incomplete sibling source, republish a committed export, or erase recoverable authority.

**Disposition:** Reuse existing lifecycle/publication facts. Preserve source-specific availability, inline finalization recovery and existing resend/retry/abandon/reveal/dismiss distinctions. Label cleanup retries accurately.

### 5. Library reads are bounded and generation-fenced — sharp edge; search breadth OPEN

**Evidence:** [five-item recent query and stale-reply fence](../../../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift), [project page navigation](../../../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift), [explicit deletion invalidates read generations](../../../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift).

**Why it bites:** A new window that fetches independently can resurrect deleted items or replace newer state with stale replies. Filtering one recent page cannot honestly search the full library.

**Disposition:** Render the existing controller's state and preserve read generations, pagination, last-good data and explicit deletion/retry semantics. Resolve query breadth before presenting search as a complete-library feature; the concept filters samples only.

## Acceptance contracts for the future build

1. Capture controls remain in the selected Design A popover. No saved-media lists remain there; Open Library is navigation.
2. Library is one independent persistent window with Recordings/Projects/Exports and existing saved-media actions.
3. Display/Window/Area/Camera Only and camera/device/audio controls match the approved sharp concept. Area uses existing region picking.
4. Current take inputs remain fixed. Shared state drives popover, live overlay, Settings, shortcuts and Library statuses.
5. Camera Only records the selected camera without secretly recording the screen; source media remains separate, synchronized and non-destructive.
6. Missing access/device/service and finalization failures show honest inline recovery; permissions are explicitly person-initiated.
7. Native screenshots, focus/capture-exclusion checks and meaningful behavioral tests establish implementation correctness. Compare actual native before/after and actual output against the selected concept; get an unprimed critique and show review shots.
8. Follow repository tests-first requirements and narrow checks during iteration. Run the full required suite once at the end of the implementation spec, with expensive capture checks scoped to contracts changed.

## Historical kickoff — superseded by the spec README

> Implement Design A from /Users/server/.t3/userdata/artifacts/screen-recorder-menu-2026-10-05/decisions.md. Keep capture setup in the menu popover and move saved recordings, projects and exports into the independent Library window. Include the selected camera controls and Camera Only behavior. Use the sharp mockup screenshots as the visual target. Resolve the map's OPEN technical facts before dependent changes; disclose any new scope tradeoff. Preserve shared controls/actions, explicit permissions, fixed take inputs, independent original media and existing recovery/deletion/export semantics. Follow the repo's tests-first workflow, verify native output against the approved concept, and finish the review and required checks.
