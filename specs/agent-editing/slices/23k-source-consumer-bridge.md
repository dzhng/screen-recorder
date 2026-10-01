# 23k — Source metadata and composed native consumers

Status: prospective, 2026-10-01; documentation only. No proof has executed.
Prerequisite: [23h scoped consumer proof](23h-native-library-consumption.md).
Target: close actual source-service metadata pagination and selected-owner
dispatch, plus historical preview receipt consumption through the composed
Foundation controllers. It does not close live default-preview readiness,
rendering, concrete presentation, playback or installed release acceptance.

## Contract and ownership

Use the production [LibraryController](../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift)
and [PreviewController](../../../apps/macos/Sources/ScreenRecorder/PreviewController.swift),
connected by the preview callback used in RecordingControls. The existing
[ServiceHost](../../../apps/macos/Sources/ScreenRecorder/ServiceHost.swift) owns
the actual child control channel; the service owns project order and cursors.
LibraryController owns navigation and selected MediaTarget; PreviewController
owns the returned revision, readiness and delivery lease. Supply an inert
PreviewPresenting explicitly. Its play callback records arguments and reads no
file. Do not instantiate RecordingControls or PreviewWindow.

Production changes are not expected. Add library-preview-bridge.test.mjs beside the
[existing native tests](../../../apps/macos/tests/library-controls.test.mjs),
reusing their separate Foundation test compilation helper. Existing checks remove
their binaries; the 23h archives contain source, exchanges and compiler pins, not
a reusable executable. This test compilation is distinct from a media worker
build. Keep the frozen worker unchanged. No new endpoint, chooser, polling owner,
catalog format, migration, compatibility adapter or editorial policy belongs here.

## Actual metadata gate

Use an owned current-format service home and source runtime, with no donor writes
or installed switch. Prefer an existing owned fixture with enough projects for
LibraryController's actual page size and pinned independent expected metadata.
Otherwise create six empty projects through public project.create in a fresh
owned home, each with a distinct requestId/title
and explicit canvas: 160 by 120, 10/1 fps, opaque black background. These are
caller-authored metadata fixtures, not generated media or capture-derived projects.
Bank complete create requests/replies as the independent expected project values.
Never manufacture catalog rows or alter user_version.

Run the actual source service through ServiceHost, with LibraryController's call
closure forwarding only metadata operations. Record request/response bytes and
native child lifetime. Allow project.create only for fixture preparation, then
project.list, project.get and recording.list; the last is LibraryController's
existing refresh companion, not recording work. Before startup, declare and pin
the required startup worker operations against current source: the retained
startup authority uses media.audioCapabilities and packageWorkspace.recover.
Forward only independently confirmed necessary startup operations, scoped to the
owned home; reject every other native operation before execution. Refuse native
capture callbacks. No media admission, decoder, render, inference or model work.

Exercise first page, continuation and previous navigation through the real
controller. Compare every returned project's ID, title, creation time and current
revision with the complete preparation replies, preserving service order. Record
the exact limit and afterSequence requests; returning to the first page must
restore its complete values. Query project.get for the explicitly selected owner
and compare its complete metadata with the matching page row. Do not sort by
title/date, scan all projects for recency or synthesize a continuation cursor.

Connect library preview dispatch to PreviewController and perform the selected
project action. Record the resulting preview.get request with that exact typed
owner. At this boundary, return a named fixture refusal before forwarding: this
metadata gate must not submit a preview job. Verify the inert presenter receives
no movie. This proves composed action dispatch, not actual preview readiness.

## Historical readiness gate

Use complete unchanged replies from [25b's banked source producer](../assets/25b-fresh-caller/producer.json)
and evidence.tar.gz: project.get-initial.reply.json and
primitive-fixture-preview-poll-0.reply.json / primitive-fixture-preview-poll-3.reply.json.
Verify the [banked archive member pins](../assets/25b-fresh-caller/evidence.tar.gz.members.json)
before consumption. Their source project is
1463f786-68d9-4303-9f7b-f86bc0cb98c2; the preview revision is
191943db-0f9a-4904-9463-8abbde18dc42. The recorded preview producer requested
explicit revision/settings. A native default request consuming those retained
replies is a historical decoder fixture, not a newly observed service exchange.

Give the historical library fixture a visibly labelled scripted page container
whose single project row is the unchanged saved project.get data. This container
is not an actual project.list reply. Also feed the actual saved empty recipient
page as an empty-page decoding check. Never rebind historical replies to the six
metadata fixture IDs, change the returned revision or mint a token. Unwrap only
the public ok/data envelope as ServiceHost does; preserve raw originals alongside
the exact payload delivered to Foundation.

Connect the same production owners. The first preview request must contain only
the selected project ID; processing establishes its returned revision; the next
tick must request that exact revision. Use the injected clock already supported
by PreviewController, frozen before the saved delivery expiry. Ready consumption
must pass the exact retained movie path/media type to the inert presenter, with
the returned revision in its title. Feed unchanged actual project.get metadata
when the controller checks owner existence; a different head must not replace the
preview's pin. Close must dispatch artifact.close with exactly the retained token.
Record that dispatch locally, not as closure of a current live service lease.

Check historical project/recording namespace separation and one late ready
answer after close using the existing continuation pattern. Closing before a
ready reply must prevent presentation and dispatch release of its returned token.
Do not duplicate the complete 23h cancellation/renewal/refusal matrix. Preserve
the existing default suite, including its actual retained 10b readiness receipts.

## Evidence and acceptance

Bank separate live metadata and historical consumption records with complete
requests, payloads, ordered state values, presenter observations and terminal
events. Record producer source/runtime, consumer/compiler inputs and executable
identities, historical archive/member hashes, native operations actually run and
the intentional historical clock. No counts-only oracle or inferred child exit.
Await actual service/native/consumer child close events before terminal claims.
Clean only owned scratch after bank/rehash; preserve frozen media authorities.

The focused test passes only when complete pages/cursors/get values and composed
dispatch agree, historical revision/path/token ownership agrees, and unexpected
work never reaches a service/native operation. Add a bounded negative control
that changes the selected owner or removes revision pinning and fails the named
outcome; keep it outside production. No timeout or product limit changes.

Run syntax, meaningful focused types/lint/format and the affected library/preview
consumer checks. Review shape, diff, docs and [planning choices](../assets/23k-source-consumer-bridge/choices.md).
Do not run broad media cohorts, CLI/Claude review, media-worker builds or repeated
accepted audio/images. Existing menu, deletion, export and service lifetime
preservation retain their owning evidence; new failures require a bounded reslice.

The future focused entry point is
`node --test apps/macos/tests/library-preview-bridge.test.mjs` with an explicitly
owned SCREENREC_HOME and pinned source-service/Node/worker paths from the existing
[process fixture](../../../packages/test-harness/editing/service-process.mjs).
Bank the exact resolved paths and compiler command; do
not use the installed bundle or defaults that select the person's library.

The human review surface is the complete live exchanges and inert-presenter
observations. No editorial question or new recording is required. Feedback that
requests actual playback or presentation belongs to the parent's release gates,
not silent expansion of this slice. No screenshots are produced by this gate;
future visual acceptance retains its comparison and independent critique steps.

## Next agent pickup

Read AGENTS and repo-local implement-spec/write-tests/review before implementing.
Resolve the owned service/runtime fixture and exact startup allowlist first, then
build the focused composed consumer check. Delegate internal test organization
and naming; retain the two distinct evidence scopes and production owners above.
If no six-project fixture exists, use the specified public empty-project setup.
If genuine production failure appears, report it and reslice before an API fix.
Update this leaf and its owned evidence/choices after proof. Root owns shared
README/matrix integration. Do not mark live preview-ready, UI, installed,
physical/listening, historical adapter-exit or full release gates passed.
