# Canonical source scene analysis

SceneProcessing scans the immutable original interval through the same cached
VisualSampler and comparison policy used by local trails. It processes one bounded
chunk at a time in the existing heavy lane, yielding between chunks. Edits do not
restart source analysis. Local frame requests do not depend on its completion.

The store retains coverage and actual-frame comparisons; the queue publishes only
a completed generation. Failed or canceled work removes its partial rows. Startup
cleanup protects active and published generations while reclaiming abandoned work.
Both source and scene cleanup tasks finish before the catalog closes, including
when one fails. Explicit processing retry owns retries; background admission never
retries a failure and admits at most one source-scene job at a time.

## Evidence

Five orchestration tests use the real queue/catalog/store. They verify a sparse
future change discovered before its actual timestamp, edit independence, failure
without publication, explicit retry, cancellation, cleanup preservation and paged
thirty-minute coverage. Suppressing canceled-attempt cleanup made its test fail;
restoration returned green. The thirty-minute fixture processes 180 chunks with
at most 52 observations per native call and reads three chunks per page. Its
isolated test run reported 123,912,192 bytes peak RSS including the test runner;
that synthetic sampler measurement is not a native thirty-minute decode benchmark.

The [bundled test](../../../../../apps/macos/tests/scene-processing.test.mjs) encodes
three real frames at source seconds 0, 40 and 80. The service scans a two-minute
source, retains transitions at 40 and 80 rather than their earlier sampling-grid
selection times, and exposes the same readiness/generation through CLI and MCP.
Restart retains that generation and the source video hash stays unchanged.

Merged build/type checks, 155 core tests, 56 service tests, 13 CLI tests and nine
protocol tests pass. Existing public trails and audio tests pass. The sparse
frame eviction fixture initially assumed no other cache producer existed; it now
explicitly touches all non-target entries before shrinking the budget. The exact
historical target is evicted and regenerated under its original revision, preserving
the original assertion rather than weakening it to any cache miss.

Independent Codex review found no actionable regression; it ran type checks/core
tests, while the actual host supplied native integration checks. Shape review keeps
one queue and one detector; source-scene storage is retained evidence and native
observation batches remain disposable. Two retained catalog tables and one new
artifact kind are the durable surfaces; no new dependency or process is added.

This closes storage and scan integration, not real UI threshold acceptance or the
selection policy for a useful screenshot index. That next consumer must use actual
boundary timestamps and preserve sampled coverage rather than infer scene times
from chunk positions.

## Native thirty-minute scale measurement

The [measurement](native-scale.json) uses generated H.264 testsrc2 animation at
320×180, 30 fps, 1,800 seconds, GOP30, no audio. The actual bundled service/native
worker completed 180 chunks in 157,656 ms. It retained 9,359 coverage observations
(maximum52 per call), 9,000 comparisons and3,206 detected boundaries. Paging three
chunks at a time required60 pages; originals retained their SHA-256 hash.

Observed service RSS peaked at220,432 KiB. A separate one-second sampler observed
native workers up to30,112 KiB, starting after scan began and seeing112 of180 workers;
these are sampled observations, not guaranteed allocation peaks. Disposable cache
used87,344,775 bytes (including one foreground image), while retained chunk JSON
used2,922,344 bytes. A foreground clean image at source900 seconds completed in
159.85 ms while the scene job was processing.

The source was generated with ffmpeg's testsrc2 filter, libx264 ultrafast, CRF30,
GOP30 and no B frames. This tests long-source native work, not full-resolution
physical capture. The high boundary density is evidence for the upcoming index
contact-sheet gate: preserving every measured change does not automatically yield
an uncluttered screenshot index. Do not hide that tension by truncating results.
