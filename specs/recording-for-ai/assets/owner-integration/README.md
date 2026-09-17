# Integrated package and export owners

## Current discovery and source-receipt integration

At `f5d6189`, a fresh bundle passes the actual CLI/MCP export discovery,
restart and relocated produced-package frame/audio journey in 22.8 seconds
([output](discovery-native.txt)). All type tasks and the focused core receipt tests
pass. The [source-path run](source-locator-native.txt) passes the generated service
case for both home spellings and all twelve actual-worker cases.

That same run also attempted the existing own-window capture case. It timed out
waiting for captured time to advance, before source processing. The host was
reported locked by native UI automation; this is not a passing capture gate or a
proven diagnosis of the timeout. The generated alias and worker checks do not
substitute for that physical gate.

The [discovery review](../export-discovery/review.md) and
[receipt review](../source-processing/output-locators.md) retain independent reviews
and negative controls. Integration preserves one export owner, strict source receipt
ownership and the existing queue. Native controls/restart UI, speech fidelity and
installed acceptance remain open.

## Earlier timeline integration

At `63e521a`, the merged library/package timeline route and the complete public
package export workflow pass [two actual native journeys](timeline-native.txt).
The latter regenerates portable event pages through the new shared projection
owner before public frame/audio inspection. [327 core tests](timeline-core.txt),
14 protocol tests, a fresh build and all type tasks pass. The
[timeline evidence](../timeline-inspection/README.md) records independent review,
negative controls and source-agent service/CLI checks. Integration preserves export
retention callbacks and the public raw cursor route.

At that checkpoint native export controls, persisted-export discovery and the
source-receipt alias fix were still in progress.

## Earlier public complete-package integration

The [public composition receipt](../package-assembly/public.md) verifies actual
CLI creation, MCP completion, concurrent editing, relocation and frame/audio
inspection from the produced ZIP after source-library removal. The complete
fresh-bundle gate passes 161 native checks; core/service/CLI/protocol checks pass.
Acquired narration still requires accepted transcript payloads. Public timeline
access, native export controls and installed acceptance remain open.

## Earlier cursor integration

At `2d2b860`, a fresh build and all type tasks pass. The merged
[public cursor/index pair](package-cursor-native.txt) passes actual CLI/MCP relocation
in 8.28 seconds, and all 14 protocol tests pass. The source agent
[verified the shared cursor reader](../portable-inspection/public-package-cursor.md)
with 325 core and 99 service tests plus an independent review. Integration review
confirms there is one source-time range/continuation wrapper and no new queue or
inspection operation. Raw cursor pages preserve observations removed from edited
playback; their continuation is scoped to one package open. Timeline reads and
complete-package production remain in progress.

## Earlier package audio integration

At `f244ede`, the freshly rebuilt bundle passes [143 native package/export checks](package-audio-export-native.txt), including the public audio consumer.
A separate [actual CLI/MCP audio and frame run](package-audio-public-native.txt)
passes after relocation; the generated media covers cuts, gaps, history, retries,
shared output pressure, held delivery and close. [324 core tests](package-audio-core.txt),
13 protocol tests and all build/type tasks also pass on the merged tree.
The [audio evidence](../portable-inspection/public-package-audio.md) records the
independent review and negative controls. Integration review found no new owner,
scheduler, operation or dependency; library and package planning share the same
controller while the retained registry owns package lifetimes.

Complete-package production remains in progress. Generated audio byte parity does
not prove human audition, real microphone acquisition or narrated-package readiness.

## Earlier public package/export checkpoint

At `fb08d73` plus the verification runner, `bun run lab:exports` builds the full
bundle and passes [142 native checks](public-package-export-native.txt). It includes
the streaming ZIP writer, canonical event pages, retained/public index and arbitrary
frame inspection, workspace lifetimes, publication recovery and bundled video
exports. The runner selects the fresh native executable and bundle together; its
first run exposed a missing relocation-bundle environment value, corrected without
changing any test. Test-file concurrency is bounded separately from the product
queues being exercised.

Merged checks also pass [324 core](public-package-core.txt),
[99 service](public-package-service.txt), [21 CLI](public-package-cli.txt), and
[12 protocol](public-package-protocol.txt) tests, plus build/type checks. Source
agent reviews and targeted negative controls are linked from the owning
[frame](../portable-inspection/public-package-frames.md),
[event](../export-publication/events.md), and
[video](../export-publication/public-video.md) evidence.

At that checkpoint, production complete-package assembly and public package audio
were not implemented. This command tests the implemented boundaries; it does not claim
accepted ASR, physical gesture/audio capture or installed end-to-end acceptance.

## Earlier internal-owner checkpoint

At `2fa1b5d`, the root build passed all eight tasks. The fresh bundled native worker
passed 121 combined archive, retained inspection, workspace/recovery, registry and
export/publication checks. All 315 core tests pass. All 97 service tests pass after
the test-only diagnostic synchronization correction below.

- [Native integration](native.txt)
- [Core integration](core.txt)
- [Service integration](service.txt)

This verifies the combined internal owners, including the merged catalog requirement
for both abandonment and confirmed private-byte cleanup fields. Public package
selectors, queued export startup recovery, service/public export composition and the
physical capture/speech/installed-workflow gates remain outside this checkpoint.

## Capture test synchronization

The initial service run had [two failures](service-initial-failure.txt): each exhausted
Vitest's default one-second diagnostic poll. Both passed unchanged in isolation. A
controlled 1.2-second recovery worker reproduced the same [false failure](diagnostic-red.txt),
even though background recovery is allowed to outlast service readiness.

The fixture now waits for the diagnostic stream event within its existing five-second
fixture budget. The delayed worker remains in the regression; every recording,
revision and failure-outcome assertion remains unchanged. [Focused cases pass](diagnostic-green.txt),
then the entire service suite passes. No production recovery behavior or production
deadline changed. This identifies the test's unintended one-second assumption, not
the exact host delay behind the initial intermittent failures.

Independent Codex review found no actionable defect in the test change. Its runtime
attempt hit sandbox Unix-socket EPERM; the host results above supply runtime evidence.
Touched-file lint and service types pass. Shape review replaced polling with the
existing diagnostic stream; it added no production state or retry mechanism.
