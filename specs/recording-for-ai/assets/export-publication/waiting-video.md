# Pinned waiting video verification

Host verification passed 37 actual native/service cases and 321 core/deletion tests.
Core/service builds and type checks, touched-file lint and formatting also passed.
The native fixtures create generated two-second gray silent media in private
folders; no user capture or output destination was accessed.

The added cases request video before source readiness, edit the current revision
while it waits, and observe the original revision/history at commit. A canceled
request retains its selected evidence while a newer source generation runs actual
cleanup. Explicit retry rebuilds a preview from that old evidence, commits, releases
its protection, and allows cleanup to remove the old files and indexed rows while
keeping the current generation.

Another case evicts the preview after the exporter has started but before descriptor
acquisition. The exporter closes, returns to admission under a fresh attempt, and
finishes after the real preview owner regenerates the pinned two-second movie. Its
bytes match the regenerated cached file. Failed source processing does not retry
through repeated export requests/status reads; source retry and export retry are
explicit. Filling the uncommitted allowance with canceled intents proves those
requests continue counting, commit frees capacity, and recording deletion removes
remaining private metadata while retaining completed external videos.

Two negative controls fail for the consequential behavior: removing the retention
predicate produces ENOENT for the selected old evidence during cleanup; removing
lost-dependency settlement leaves the cache-race export failed instead of committed.
Both changes were restored and their focused tests passed before final verification.
Independent Codex review reported no actionable regressions and passed 314 core
tests. Its sandbox could not compile Swift or decode the native preview fixture;
the host run supplies the native evidence rather than treating those failures as
successful reviewer verification.

- [Native/service results](waiting-video-native.txt)
- [Core/deletion results](waiting-video-core.txt)
- [Retention negative control](waiting-video-retention-red.txt)
- [Retention restored](waiting-video-retention-green.txt)
- [Lost-dependency negative control](waiting-video-cache-red.txt)
- [Lost-dependency restored](waiting-video-cache-green.txt)

This is empty-pointer, no-narration lifetime evidence. Public export wiring,
per-export abandonment, queued startup recovery, staging storage totals, long-video
budgets and processed-package/narrated acceptance remain separate gates.
