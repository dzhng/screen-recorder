# Public complete-package composition

The service now supplies both video and processed-package producers to its shared
export owner. Source, scene and index cleanup consume that owner's retention
predicates. The existing cache-ready admission barrier and recovery route remain
in force. Optional producer plumbing and the obsolete unsupported-package gate
were removed; actual acquired narration still fails with UNSUPPORTED_ARTIFACT
until accepted transcript payloads exist.

## Actual client workflow

The [public test](../../../../apps/macos/tests/package-public-export.mjs) closes the
fixture's original catalog owner, starts the actual service, calls export.create
through CLI and polls export.status through MCP. It creates a newer edit while
exporting an explicitly selected historical revision. Replay retains the same
snapshot/job, retry preserves the committed receipt, and the receipt hash matches
the output ZIP. After service shutdown it removes the original library and moves
the produced ZIP. Public frame and audio clients then inspect that exact ZIP.

The [combined workflow passed](public-media.txt) in 24.47 seconds. It includes
arbitrary clean/trail frames, sparse actual timestamps, cuts, pauses, history,
audio gaps and missing narration, plus shared output pressure, held deliveries,
retry, same-ID library deletion, independent opens and close/restart lifetime.
Generated system-audio bytes agree between CLI and MCP; the ZIP stays unchanged.
This is transport/sample parity, not human audition or actual narrated capture.

The [first fixture attempt](public-initial-fixture-failure.txt) correctly received
STALE_REVISION: its historical export pin was intentionally older than the fixture's
current edit. The concurrent-edit step now resolves the current revision first;
export selection still uses the original historical pin. No product condition or
assertion was weakened.

## Integrated verification and review

Integration of bc15c61 with the public composition passes a fresh full build and
all eleven type tasks. [lab:exports passes 161 native checks](public-native-suite.txt),
including actual production packages, video exports, startup admission and the
pre-intent abandonment regression. [325 core](public-core.txt),
[99 service](public-service.txt), 21 CLI and 14 protocol tests pass.
Changed-file lint/format and diff checks also pass.

Independent Codex review found no actionable regression and passed types. Its
runtime attempts used the old debug helper and failed in shared native decode
fixture setup; the explicitly selected fresh bundled-worker runs above are the
runtime evidence. Shape review keeps one export lifecycle and one publication
owner; both real producer dependencies are mandatory. Decision audit adds no new
product discretion in this composition pass.

The [internal consumer proof](review.md) covers retention, crash gaps, source
substitution and surviving writers. Process termination is tested; power-loss
safety is not established. Public timeline/transcript access, accepted ASR,
native export interaction and installed workflow acceptance remain separate gates.
