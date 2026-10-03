# Indexed immutable asset inspection

`asset.get` now returns stream headers and segmentCount. `asset.segments` returns
exact ordered physical rows, including empties and media mappings, with a cursor
pinned to the immutable asset and stream. All assets use the same response shape;
fonts retain non-timed faces and image metadata retains its meaning.

AssetStore owns the rows in one indexed table. The stored metadata header keeps
only an empty-array presence marker where the original optional array existed;
complete internal reads reconstruct it. Fresh imports, generated/prepared assets
and portable adoption insert header and rows in their existing transaction. Dedup
and portable equality compare reconstructed metadata. Path, provenance and resource
reference checks read headers without reconstructing unrelated rows. Shared strict
admission rejects duplicate stream identities before publication. Catalog format 15
identifies this indexed layout; subsequent capture continuation uses its own next
version. Format 14 is explicitly refused,
with no migration or parallel legacy store.

The earlier JSON-per-page implementation was rejected despite passing reply and
latency checks. Its 800-page traversal of 200,000 rows took 56.935s and reached
1,081,792KiB RSS; the 1,000-row control reached 72,544KiB. Indexed traversal takes
0.318s, p95 0.681ms and max 5.941ms, with 91,760KiB RSS; the small indexed control
reaches 71,728KiB. The composite primary-key range is retained in the query plan.
These are observed process measurements, not a universal platform memory bound.

A fresh actual 100,000-run public acquisition reaches ready on the new catalog.
Its 74.672s duration overlapped other native verification and is a concurrent-load
readiness observation, not an isolated performance benchmark. All200,000 physical
rows reconstruct exactly through alternating CLI/MCP pages; the complete traversal
takes 15.346s, including CLI process startup, serialization and oracle comparisons.
Ordinary media and font journeys preserve admission/replay/metadata behavior.

The focused gates cover atomic rollback and retry, optional-vs-empty arrays,
portable dedup conflicts, cursor boundaries and duplicate-ID refusal. Removing the
shared identity refinement turns the duplicate portable-ID test red. Independent
read-only review found no actionable issues; parent review found that identity
refinement gap, which was corrected and verified. Complete artifacts and hashes
are in `verification.json` and `evidence.tar.gz`.

This closes public metadata paging, not package metadata delivery. The existing
package manifest still embeds complete portable assets; [20d3](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/20d3-package-asset-metadata.md)
owns inventory-bound metadata hydration before readiness. Large source audio
selection and the remaining capture rollout gates also remain separate. The new
help/skill contract is exercised by the journey; the final fresh-consumer skill
review remains part of the overall product acceptance pass.

[Combined-root verification](root-verification.json) confirms native standalone media admission and all-row CLI/MCP reconstruction. Root rows match the already retained `public/pages.jsonl` bytes exactly; the root archive retains its independent request/results and focused test logs.
