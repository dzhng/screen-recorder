# Shared observation reuse

VisualObservationCache wraps the existing native sampler. Its exact batch key
includes finalized source path, retained interval, ordered request times and shared
policy identity. The path names immutable recording media; relocating a library
causes a safe miss. A past-only reference at the same requested time cannot reuse
a future image selected under wider bounds.

Raw native observation batches use the existing DerivedCache and its global byte
budget. One lookup table references its cache row with ON DELETE CASCADE; eviction,
missing-file reconciliation and explicit removal reclaim lookup metadata as well.
Durable scene comparisons and index evidence do not belong in this cache.

Seven focused checks cover exact-bound selection, restart reuse through a new
catalog connection, eviction/regeneration, canceled or invalid native responses,
concurrent misses, source isolation and LRU lookup bounds. Removing selection bounds
from the key made the selection test fail; restoration returned green. The LRU test
uses a budget fitting one fixture batch and verifies both pixels and bounded rows.

The real bundled app passes default trails, sparse batches and audio regressions.
All eight delivered trail-mode PNGs are byte-identical to the retained public-trail
evidence, so this pass changes reuse, not rendering. The existing independent visual
review applies to those unchanged bytes. Build/types, core tests, lint and formatting
pass. Independent Codex review found no actionable regression.

The shape review keeps disposable observation reuse distinct from retained scene
evidence, with one sampler and comparator shared by local and global consumers.
Concurrent misses may decode twice within existing lane limits; the first reusable
publication wins and the losing file is removed. No second queue, background timer,
per-frame RGB index or extra cache budget is introduced.
