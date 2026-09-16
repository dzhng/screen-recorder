# Recording controls integration

## Ownership and invariants

Native capture owns the active selection and playback clock. Status carries both
through the service so a take started by another client also determines what the
menu displays and restarts. Window titles are labels; source identity survives a
navigation or rename. Sealing capture fixes elapsed playback time before encoding
finishes, including a take stopped during a pause.

The menu observes status while the service is ready, even while idle or paused.
Reads never overlap; an explicit refresh arriving during a read is coalesced and
delivered afterward. Source enumeration remains permission-gated and separate from
status polling. No permission request occurs as part of reading status or sources.

## Verification boundary

Pure Swift controls tests cover source/audio reconstruction, window identity,
region conversion, and menu state. Capture tests cover paused and sealed clock
endpoints plus existing synthetic-media recovery and geometry cases. The app builds
without launching. Service tests exercise status through the local transport.

Repair checks passed: `ScreenRecorderControlsTests`, `ScreenRecorderCaptureTests`,
the app product build, protocol build, service typecheck, and capture-service tests
(existing suite plus the added active-selection status test). Independent Codex
review found fixture-startup and restart-identity races; both waits now observe the
required state before proceeding. The fixture tests remain unrun.

Root removed the inherited schematic renderer and file-driven menu actions. The
remaining fixture observer only reads existing menu rows; capture is controlled
through the public service API. It cannot open menus, invoke their actions or supply
visual proof. Actual native UI interaction and screenshots remain separate gates.
The repair agent did not launch the app or record; root integration evidence follows
when the rebuilt own-window observer test runs.

## Remaining acceptance and pickup

- Implement the agreed recent-recording delete action and storage total.
- Run authorized fixture controls tests, including a closed-menu observation of
  external start/pause/resume/stop and its clock/source/audio display. Actual menu
  actions, including restart, require native UI verification.
- Verify permission-denied idle launch, actual shortcut collisions/overrides,
  display/window/region recording, multi-display geometry, and source loss.
- Inspect actual native idle/selecting/recording/paused/interrupted controls through
  the visual gates; schematic images do not satisfy that gate.
- Add the owning lab entrypoint and complete slice 07 only after its acceptance
  evidence is retained. Preview and exports remain unavailable until their owning
  slices implement them.

## Root integration checkpoint

The rebuilt packaged app passed the own-window observation test (2026-09-16):
external start/pause/resume/stop updated the closed menu; the selected source and
microphone-off state agreed with native status; elapsed time advanced, held while
paused, and resumed. Both audio inputs were explicitly disabled. The test reads
existing menu rows and does not invoke UI actions or open the menu.

Integrated controls and capture Swift suites also pass. Independent review found
that the fixture must observe its source catalog before starting; the read-only
snapshot readiness barrier now does so. Schematic images and their producer were
removed rather than retained as a substitute for native visual evidence.
