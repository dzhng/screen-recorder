# Retained screenshot storage

The retained-store subpass of slice 11c is verified in isolation. This does not
close index processing, public delivery, contact-sheet selection quality, or native
image acceptance. Those remain the integrating pass's gates.

## Ownership

`packages/core/src/screenshot-index.ts` owns selected PNG files and catalog rows.
It consumes the selection and shared materialization types directly. Durable
completion means all selected files and contiguous revision coverage were checked;
the existing job queue remains the publication authority. A finishing generation
rejects new appends, so yielding during verification cannot admit unchecked images.

Coverage is an independently paged chronological stream. Adjacent intervals merge
only when their representative, equality evidence, source boundary and playback
boundary agree. Candidate pages contain maintained coverage counts rather than
scanning or embedding every interval associated with an image. This keeps static
collapse useful without making one page's work depend on recording length.

Reads open the owned file without following links or blocking on special files,
check the admitted file identity, and expose bounded positioned reads. An acquired
file descriptor survives unlink on this Mac; deletion prevents new reads while an
in-flight delivery can finish. Cache eviction has no authority over these files.
The PNG header and receipt are checked here; actual decode/render validation stays
with the native worker and shared materializer.

Cleanup marks a generation unreadable before yielding, removes bounded batches,
and honors the owner's active/published keep decision. A damaged generation is
reported after other generations are visited. Error reporting retains a count and
first cause, avoiding an unbounded failure collection.

## Verification evidence

Run on 2026-09-16, macOS arm64, Node 24.14.0, Vitest 5.0.0, based on the shared
materializer and selector commits (`220c12e` and `482ed0c`). Tests use real SQLite,
filesystem operations, and a small generated PNG fixture. They make no visual claim.

- Core build and type check pass.
- All 15 existing/current core test files passed (179 tests at the initial broader
  checkpoint). After review fixes and additional regressions, the focused retained
  store and existing frame files pass together (31 tests).
- Formatting and lint pass for changed production/test files.
- The retained-store tests cover restart, coverage merging and noncontiguous paging,
  default/max page bounds, incomplete and missing files, cancellation during finish,
  invalid identity/cursor, direct reuse of finish metadata, mismatched provenance,
  actual derived-cache eviction, cleanup of unappended output, owner-kept generations,
  delivery surviving deletion, inode replacement, symbolic links and hard links.

The independent `codex review --uncommitted` found two confirmed defects. A FIFO
substitution blocked synchronous opening before file-type validation; the child
process regression timed out before adding nonblocking open. A damaged first
generation prevented a later partial generation from being reclaimed; its output
remained before failure isolation was added. Both regressions now pass. Integration
also caught structural metadata being rejected as an identity: an explicit identity
projection now strips counts and dependency receipt extras while retaining every
policy, source, revision and generation binding. Its regression failed before the
fix and passes now. No review findings remain unaddressed.

The fresh worktree's first broad test run lacked generated `dist` files and the
existing child-process revision test failed. Building core resolved that setup
failure; the subsequent broader run passed without changing that test.

The FIFO subprocess regression also passes when tests start in `packages/core`.
Its imports are derived from the test module URL, and Node transforms the current
TypeScript sources with a narrowly scoped relative-import hook. It cannot silently
exercise stale build output. Removing nonblocking open from the source alone made
the child time out; restoring it returned green without rebuilding. The test checks
stderr and the exact expected rejection, so an import failure cannot count as a
successful file rejection. All twelve retained-store tests pass from both working
directories.
