# Source processing integration

Status: integrated and verified for source cursor evidence.
See [integration review](../assets/source-processing/review.md).

Source evidence belongs to the immutable recording, not an edit revision. The
processor pins the original revision so a cut never causes another native export.
The durable queue alone publishes a successful attempt; raw readers resolve that
published identity and bind continuation tokens to source, generation and range.
Raw observations explicitly use source time. Edited trail projection belongs to
slice 10.

Finalization and job admission are separate transactions. A startup/capacity scan
fills that gap for finalized takes with no job, in capture order. Existing failures
require explicit retry, so a restart cannot repeatedly invoke a broken processor.
Capture remains successful if background admission is temporarily full.

The native worker owns journal parsing. Core streams the normalized derivative
into the same catalog as revisions and jobs, preserving integrity markers rather
than presenting incomplete evidence as complete. Service shutdown waits for both
capture reconciliation and artifact workers before releasing the catalog.

## Evidence and remaining work

The [real packaged-app test](../../../apps/macos/tests/source-processing.test.mjs)
records only its own fixture window with both audio sources disabled. It proves
finalization-to-publication, paging, unchanged source evidence after a cut and
reopening the same evidence after app relaunch. It does not prove transcription,
screenshot selection, edited cursor trails, display capture or physical audio.

[Core processing tests](../../../packages/core/src/processing.test.ts) cover
finalization, explicit retry and a backlog exceeding queue admission capacity.
The [capture lifetime test](../../../apps/service/src/capture-lifetime.test.ts)
proves shutdown aborts recovery, waits for the worker to settle and refuses new
mutations; removing the abort makes that test fail.

Cleanup after startup and before retry reclaims unpublished, inactive derivatives.
Core checks cover file-only, partial-index, complete-unpublished and index-only
leftovers, preserved source/published bytes, canceled-but-live workers, queued
replacements, unsafe parents, failure isolation and abort between row batches.
The packaged-app relaunch check also reclaims an abandoned derivative directory
while returning the same published cursor page. Public CLI/MCP advertisement comes from the shared operation
registry; no separate adapter implementation is needed.
