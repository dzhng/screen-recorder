# Public raw cursor pages — 14c3c3

The existing cursor.raw operation now resolves either a library recording or a
process-local package handle. One core wrapper owns range validation, continuation
identity and integrity metadata; both paths use the unchanged normalized source
reader. No edited revision is accepted: raw observations remain source-time r0.

## Verification

[The public fixture](https://github.com/dzhng/screen-recorder/blob/cc5d7a9fee578758eeadffe662eff0778556d7df/apps/macos/tests/package-public-cursor.mjs) opens
an actual generated ZIP after relocation and removal of its original library. CLI
and MCP return identical pages, then changing page size traverses all 80 expected
observations without loss or duplication. A sample inside a cut remains present;
source integrity fields match the normalized fixture.

Changing source generation, source ID, range or package open rejects a continuation.
Deleting a real library recording with the same embedded ID leaves package pages
readable. Closing one open invalidates its cursors while a sibling remains usable;
service restart invalidates the sibling too. Archive bytes remain unchanged and
owned service/native process groups are reaped.

Focused source-page tests additionally cover equal timestamps, source-time order
that differs from sequence order, bounded limits and continuation anchors outside
the range. Removing the package-handle identity comparison made the cross-open
regression fail; restoring it returned the focused tests to green.

The first public fixture compared its entire MCP transport envelope to CLI data
and rejected the additional request correlation ID. Comparing the exact data body
corrected that harness assertion; product behavior did not change.

## Review scope

Shape review retains one normalized reader and one cursor contract wrapper. Code
review found no remaining issue. Independent Codex review found no actionable
regression; types and 30 focused core/protocol tests passed in its run. This pass
adds no timeline, transcript, native operation or background work.

Decision audit found no new product discretion: source-time/r0, bounded paging and
package-lifetime continuation identity are existing contracts. The shared resolver
function is an internal factoring choice, so no duplicate ledger entry was added.

## Final receipts

Fresh release build: eight targets; type checks: eleven tasks. Core: 325 tests;
service: 99 tests; CLI: 21; protocol: 14. The actual fresh native public cursor
and retained-index regression pair passed in 14.05 seconds (cursor 7.09 seconds).
Changed-file lint and diff whitespace checks passed.

[Compact result](public-package-cursor.json), [native log](public-package-cursor-native.log),
[core log](public-package-cursor-core.log), [service log](public-package-cursor-service.log).
