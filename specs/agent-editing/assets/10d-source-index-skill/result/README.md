# Source storyboard inspection

Selection: asset `42f5673bebaa1faedf0f22da32445f4f9626222190b47d1db54a0714d4b490fc`, stream `track:1`, physical source support (no acquisition selected). The prompt's `asset42…` was not accepted as an ID; the public `asset.list` returned the matching ID without the `asset` prefix. The stream is 64×48, spans 0–1,000,000 µs, and has known empty support at 400,000–600,000 µs. The asset reports originUs 1,250,000.

## Retained storyboard

The index is generation `d421b8c3-91c0-4655-93e9-66ab92d485e0`. It contains four entries, all delivered successfully as 64×48 PNGs. The images look alike at this resolution: a red field with a narrow blue strip at the left edge. Each is a selected observation, not a description of every intervening frame.

| Ordinal | Requested source time | Actual decoded source time | Reasons | Image |
|---:|---:|---:|---|---|
| 0 | 0 µs | 0 µs | first, availability | [01.png](images/01.png) |
| 1 | 399,999 µs | 300,000 µs | last | [02.png](images/02.png) |
| 2 | 600,000 µs | 600,000 µs | first, availability | [03.png](images/03.png) |
| 3 | 999,999 µs | 900,000 µs | last | [04.png](images/04.png) |

There are no more index entries (`nextCursor: null`). The first/last and availability reasons describe the index's selection events. In particular, the last candidate in each support span can resolve to an earlier decoded sample; requested time is not necessarily the sample time.

## Coverage

The complete coverage page has five intervals and no continuation (`nextCursor: null`):

| Source interval | Index state | Equality label / basis | Meaning for this inspection |
|---|---|---|---|
| [0, 399,999) µs | available, ordinal 0 | sampled | Retained image coverage in this range. |
| [399,999, 400,000) µs | available, ordinal 1 | unproven | A one-microsecond boundary is explicitly not proven by the index. |
| [400,000, 600,000) µs | unavailable | support | Known source-support gap; there is no picture evidence there. |
| [600,000, 999,999) µs | available, ordinal 2 | sampled | Retained image coverage in this range. |
| [999,999, 1,000,000) µs | available, ordinal 3 | sampled | Retained image coverage at the final boundary interval. |

The public stream metadata independently reports empty support over [400,000, 600,000) µs, consistent with index coverage. The gap means missing source evidence, not a black frame. The index and images establish the four retained observations and the reported coverage labels; they do not establish the contents of every frame between observations, nor prove what happened within the unavailable gap or the unproven boundary microsecond. They describe the raw source stream and say nothing about project edits or processing.

## Recovery and receipts

The first index read returned `state: not_requested`, `reason: canceled` for its source-scenes dependency. `job.get` confirmed that dependency's job was canceled and retryable. I used the advertised `index.retry` on the same asset/stream, then polled the same selection until both scene preparation and the screenshot index were ready. No project, recording, source media, or database was edited.

Raw public CLI receipts and schemas are saved alongside this report: [asset-list.json](asset-list.json), [asset-get.json](asset-get.json), [index-get.json](index-get.json), [scene-job-before-retry.json](scene-job-before-retry.json), [index-retry.json](index-retry.json), [index-job.json](index-job.json), [index-get-ready.json](index-get-ready.json), [index-coverage.json](index-coverage.json), and [index-frames.json](index-frames.json). The full CLI help is [cli-help.json](cli-help.json), with relevant operation schemas in [operation-schemas.txt](operation-schemas.txt).
