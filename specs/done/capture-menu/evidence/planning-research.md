> Historical planning research. The closed README and current code own final scope and behavior.

# Evidence and unresolved platform questions

This is planning evidence from source inspection and primary documentation on
October 5, 2026. No native build, test, recording or physical reproduction ran
during spec writing. The source revision and frozen reference hashes live in
[the manifest](../assets/reference-manifest.json).

## Camera is a device kind; primary is an allocation role

The [protocol](../../../../packages/protocol/src/capture.ts) admits screen sources and
an optional companion camera. The [service capture owner](../../../../apps/service/src/capture.ts)
allocates one primary source and an optional camera sibling. Its canonical replay
arguments currently distinguish window/display/region, so adding a primary camera
must also include its exact device identity in replay comparison.

The [core publication validator](../../../../packages/core/src/capture-publication.ts)
requires a primary layout-2 journal, without companion binding or camera-proof
members. The [native authority validator](../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureSourcePublication.swift)
currently equates camera device kind with companion role. The chosen plan separates
these concepts: a primary camera uses existing primary publication; the companion
camera keeps its existing bound layout-1 contract. This is a must-pass fixture
gate before live acquisition, not an assertion that the feature already works.

The [independent camera clock tests](../../../../helpers/mac/Tests/ScreenRecorderCaptureTests/IndependentCameraClockTests.swift)
show a companion camera can establish its own origin before a later primary
frame. The exploration map's screen-zero warning concerns the primary writer;
it does not authorize rebasing companion media. Existing source origins and host
correspondence remain intact.

## Reproduce acquisition before integrating it

Apple's [capture-session guide](https://developer.apple.com/documentation/avfoundation/setting-up-a-capture-session)
describes camera/audio input and output composition. Its
[synchronizationClock](https://developer.apple.com/documentation/avfoundation/avcapturesession/synchronizationclock)
documentation places output timestamps on the session clock. The existing
[clock ingress](../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureClockIngress.swift)
already converts external timestamps into the host domain. Reuse it; do not
derive another clock from callback arrival or UI wall time.

The [primary writer](../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureWriter.swift)
currently expects ScreenCaptureKit frame attachments. Camera frames need a
general primary-video seam; fabricated screen attachments are not evidence.
An asymmetric prerecorded picture and authored timestamps will prove the new
seam before opening a physical device.

Apple's [ScreenCaptureKit sample](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos)
shows separately registered output types and content filters. The existing
[input owner](../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureInputSession.swift)
already uses a separate whole-system stream with only audio output registered.
This is the first candidate for Camera Only system sound. Documentation and
inspection do not prove it can operate, synchronize and drain without a screen
video producer. The bounded reproduction slice records that verdict before
production wiring. No new Core Audio backend is pre-authorized.

## Native presentation must prove focus and exclusion

Apple's [NSPopover documentation](https://developer.apple.com/documentation/appkit/nspopover)
provides anchoring, positioning and transient dismissal. Start with that platform
owner instead of building global event-monitor machinery. Prove keyboard access,
source focus restoration and capture exclusion in the shell slice. If the platform
container cannot meet these together, reslice that presentation boundary before
substituting a single nonactivating anchored panel. Do not ship two containers.

Apple describes [NSWindow.SharingType.none](https://developer.apple.com/documentation/appkit/nswindow/sharingtype-swift.enum/none)
as a legacy constant. The [screen input owner](../../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureInputSession.swift)
also excludes this app by bundle identity for display capture. Preserve that
filter; do not claim exclusion merely because the new window sets sharingType.
The existing [physical exclusion test](../../../../apps/macos/tests/capture-exclusion.test.mjs)
can be inconclusive on a changing desktop. A skipped/inconclusive result is not
a pass; use a controlled fixture and decoded pictures for the final claim.

Apple's [authorization guide](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media)
describes permission inspection, explicit camera access and bundle usage
descriptions. The app's [usage descriptions](../../../../apps/macos/Info.plist) already
include camera, but its wording refers to a synchronization probe. The permission
slice makes the description truthful for requested recording, verifies the actual
signing/sandbox requirements, and never prompts on discovery or menu opening.

## Library breadth follows existing contracts

The [operation catalog](../../../../packages/protocol/src/operations.ts) already provides
bounded recording cursor pages. The [native Library controller](../../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift)
currently reads a recent page. Add page navigation there, preserving its delayed
reply fences and last-good data. The chosen filter applies only to the visible
page; complete-library text search is outside this feature.

The [export observer](../../../../apps/macos/Sources/ScreenRecorder/ExportController.swift)
discovers unfinished exports and retains tracked deliveries. Moving it to Library
does not supply a complete historical export archive. Label the view honestly and
retain the [recovery distinctions](https://github.com/dzhng/screen-recorder/blob/ec8a59df761c6bfbb0c78a8cba93717f25fee066/apps/macos/Sources/ScreenRecorderControls/ExportMenu.swift).

## Draft synthesis

Three independent whole-plan drafts were requested with the same product brief:
fewest slices, risk first, and seam quality. The seam-quality draft uses Claude
Opus/high through a read-only CLI invocation; the other two use separate Codex
agents. They inspected real owners without builds, edits or recordings.

All three drafts have been read. Claude's read-only session could inspect the
repo but could not read the external approved artifacts; the parent verified the
geometry against the actual frozen HTML/sharp shots. No draft is implementation
or acceptance authority.

- All agree on camera as one primary picture source, unchanged persisted layouts,
  typed usable-video ingress, exact device identity, existing Library fences and
  independent publication. These became the preservation contracts.
- The minimal draft proposed seven slices; the risk-first draft isolated the
  physical gates; Claude separated many presentation/model operations into nineteen
  slices plus spikes. The canonical thirteen split capture/Library geometry,
  role proof, video, narration, system-audio reproduction and production parity.
  Closely coupled action/discovery/permission work stays on the shared capture seam.
- Two drafts proposed a camera-only discriminant to avoid companion-only readers.
  The plan uses camera device kind and fixes the role/layout conflation instead.
  The primary authority gate includes SourceEvidenceExport, whose source-kind
  shortcut would otherwise route a primary camera into CameraMedia verification.
  This is one semantic rule rather than an enduring naming exception.
- Claude proposed an extra screenListing field and a SurfaceActivation policy
  model. Existing permission/status facts and native presentation owners suffice;
  no duplicate truth/policy layer is planned. Genuine screen enumeration failures
  still fail honestly. Shared window key equivalents from Settings are retained.
- Claude proposed disabling system audio after a failed probe and reducing live
  keyboard access if the popover cannot support it. Both weaken selected contracts;
  failed gates instead require reslicing/disclosure. No automatic format change
  or resampling is permitted to manufacture passing narration evidence.
- All discovered current Library recents do not equal full browsing. Existing cursor
  pages solve recording reachability; a page-local filter and tracked/unfinished
  export scope avoid inventing new search/archive behavior.
- Source inspection also found SettingsModel directly persists its countdown property, while capture reads Preferences at start. Adding a second visible toggle requires one action/snapshot so both open surfaces stay in agreement; this is assigned to 06 without a new preferences owner.
- The actual focus gate runs outside activation-suppressed probe mode. Offscreen
  geometry fixtures remain cheap, quiet and deliberately narrower evidence.

The earlier exploration artifacts are superseded by the canonical README's handoff.
Rejected capture-setup-modal, hidden-screen, empty-primary-plus-companion and
optional-primary-source alternatives remain excluded for the reasons above and
in decisions.md. Existing unrelated docs/skills edits were not adopted into this
feature.
