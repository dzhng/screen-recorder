Marker: `yap-picture-followup-20261005`

Confirmed actionable defects:

- **Stale repeated derivation accepts changed recipes** — [video-corpus.mjs:120-130](/Users/server/dev/yap-video-editing/packages/test-harness/editing/video-corpus.mjs:120). Re-running `derive --case graham-picture` after changing its FFmpeg arguments, output filename, clock, or encoder hash only compares source hash/stream/range, then validates and returns the old manifest entry. The changed case is neither rejected nor regenerated.

- **Per-frame pixel aspect ratio is not verified** — [video-corpus.mjs:60-67](/Users/server/dev/yap-video-editing/packages/test-harness/editing/video-corpus.mjs:60). Only the stream’s `sample_aspect_ratio` is checked. A decoded frame reporting `2:1` while the stream remains `1:1` passes certification despite changed display geometry.

- **The “pinned recipe” path permits an unpinned encoder** — [video-corpus.mjs:143-145](/Users/server/dev/yap-video-editing/packages/test-harness/editing/video-corpus.mjs:143), with the sibling test recipe at [video-corpus.test.mjs:374-387](/Users/server/dev/yap-video-editing/packages/test-harness/editing/video-corpus.test.mjs:374). Missing `recipe.tool.sha256` disables the mismatch check, so any FFmpeg binary is accepted; the test named for a pinned recipe supplies no pin. A clean replay can therefore produce different encoded pixels under the same recipe.

Verdict: **not clean**.