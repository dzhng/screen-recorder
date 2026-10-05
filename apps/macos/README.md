# Menu-bar app

The native app owns recording controls and one [local service child](../service/README.md).
Ordinary launch prepares that service without starting capture or requesting
permission. Readiness and failure are visible; process identities and interpreter
paths remain diagnostics rather than product controls.

## Shared controls and explicit access

The menu, settings and recording panels consume one controls state and dispatch
the same actions. A running take retains its selected inputs; changing a preference
cannot rewrite that selection. Countdown precedes the service start request, so
canceling it creates no take. Recorder-owned controls stay outside recorded media
and do not activate the app over the source being recorded.

Authorization is read from native capture and requested only through an explicit
action. Permission denial remains actionable without choosing another device.
Camera and microphone discovery do not depend on screen authorization. Missing
screen access produces empty screen choices, while an actual discovery failure
retains the last-good catalog and reports the error. A camera choice preserves
its device identity and never silently substitutes a disconnected device.
Login registration is the system's answer, not a second locally cached preference.
A client-triggered service launch suppresses the ordinary launch window; a headless
check must not take focus or play audio.

## Lifetime and delayed answers

Quit closes the service control pipe, finalizes an owned take and joins shutdown.
Escalation targets that child alone under a bounded deadline. Pending calls settle
on terminal failure instead of waiting for a channel nobody serves. Control writes
are asynchronous and bounded so a non-reading peer cannot block every deadline.

Release updates use a separate lifetime contract. The [update coordinator](Sources/ScreenRecorder/UpdateCoordinator.swift)
joins existing native intent with the service's atomic permit; waiting leaves
normal operations and preview renewals usable. The [Sparkle boundary](Sources/ScreenRecorder/SparkleDriver.swift)
owns scheduling and preferences through the pinned SDK. Its acknowledged launch
exclusion permits clean service EOF, and observed clean exit permits replacement.
An authenticated check that finds no newer version completes normally; a fresh
check clears prior check errors and candidate facts, while a required manual
restart remains visible.
Updater shutdown never finalizes capture, closes preview or sends a signal to
manufacture idle. An unconfirmed permit release or stalled shutdown requires an
explicit quit and reopen; there is no competing successor or automatic restart loop.
Updater relaunch preserves the selected home/defaults and suppresses launch Settings.

The [library controller](Sources/ScreenRecorder/LibraryController.swift) presents
source facts and caller-created projects separately. Last-good observations survive
read errors; generations fence delayed replies after deletion, page changes or
service replacement. A recording becoming ready cannot silently create a composition.

A [preview controller](Sources/ScreenRecorder/PreviewController.swift) pins identity
and holds the renewable service lease; its presentation window owns platform
player events. Export choices pin revision and destination before sending, retaining
the exact request after a lost answer. Forgotten owners cannot be revived by late
chooser, status or publication replies.
The export observer also accepts caller-created caption deliveries and preserves
their existing status/actions. Caption creation requires an explicit placement
selection, so the app's destination chooser does not offer that request.

## Runtime resolution

The [build and release owner](../../scripts/README.md) distinguishes bundled and
host interpreters. The [resolver](Sources/ScreenRecorder/NodeRuntime.swift) consumes
the bundle manifest and explicit overrides. An invalid override is reported rather
than silently selecting another interpreter. A movable bundle resolves its runtime
relative to itself.

The same bundle manifest names its FFmpeg distribution and pins the signed
receipt. The app passes that selected authority to its service; neither the
service nor an external agent searches Homebrew for a replacement tool.

Probes run off the main thread with bounded output and termination. One startup
deadline covers interpreter discovery and service readiness, preventing each
candidate from borrowing a fresh service-sized budget.

## Verification and native boundaries

The [package manifest](package.json) owns app compilation and controls checks.
Controller checks link SwiftPM-owned outputs within this checkout, exercising
protocol and generation fences without capture or save panels. Optional
[audio receipt inspection](tests/audio-export-controls.mjs) reuses the pure suite.
The [verification guide](../../packages/test-harness/README.md) separates these
claims from installed, physical and perceptual acceptance.

Capture, geometry and media behavior belong to the [native owner](../../helpers/mac/README.md).
Probe entry points use those same owners; they do not define a second recorder.
The checked-in icon is an input to the build, with its [drawing tool](../../scripts/render-app-icon.swift)
kept separately so building is not a drawing step.

## Update preference

Settings observes the release updater's effective availability, enabled preference
and status. Its toggle sends an explicit change to the native coordinator; Sparkle
owns persistence and staged-update cancellation. Settings never writes another
update preference or infers installation permission from its checkbox. Manual
source/personal builds show a manual-update explanation instead of an inert toggle.

The [offscreen settings renderer](tests/settings-view-shots.mjs) draws the production
view with synthetic owner facts and checks that the form still scrolls to General.
It proves presentation without a service or permission inspection. Actual updater
persistence, staged disarming and quiet relaunch belong to native coordination
and the installed-update gate.

## Capture presentation fixture

The [capture view](Sources/ScreenRecorder/CaptureView.swift) consumes immutable
rendering facts and emits supplied intents. It holds no capture selection, service
state or recording clock. The controls owner admits those intents when the native
shell binds the view; the fixture can describe future camera presentation without
claiming device readiness.

Run `node apps/macos/tests/capture-view-shots.mjs` from the repository root for
focused native interaction, applicability and scroll checks plus offscreen images.
`SHOTS` selects the output directory. The [fixture](tests/fixtures/capture-view.swift)
owns synthetic scenarios; its images and metadata record native size, appearance
and backing scale. This renderer never enumerates devices, inspects permissions,
starts capture or activates the app.
