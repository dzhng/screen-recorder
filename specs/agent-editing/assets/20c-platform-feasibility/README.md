# Sparse canonical materialization: platform feasibility

Bulk AVMutableComposition passthrough remains the recommended next implementation path. It preserves the existing representation and passed the acquisition owner's 100,000-interval outer limit. The measured memory cost warrants sequential role finalization and cancellation/retention ownership; it does not establish a violated product budget or justify a new input cap. No production materializer, writer rollout, or custom container code is included here.

The archives preserve scratch probes, candidates, failures, complete PCM controls and observations. `manifest.json` covers the earlier scaling and movie-API experiments; `outer-limit-manifest.json` covers the final contract-sized cohort. Hashes identify original retained bytes, including failed candidates. Extracted absolute scratch paths are historical references; the source fixture is the banked `20a-sparse-storage/run/continuous-48000.mov`.

## Applicable bounds

The native retained PCM selection limit is 10,000 available intervals (`AudioTypes.swift`); ordinary excerpt validation defaults to 1,000. Acquisition import permits 100,000 intervals (`acquisitions.ts`). These are different owners and must not become an invented 10,000-run recording limit. The 100,000-run canonical export does not establish that every existing consumer accepts that many availability intervals.

20c explicitly permits retained platform segment metadata. Existing CaptureWriter finalization waits on asynchronous finish callbacks; cancellation cancels writers. No numeric finalization RSS or wall-clock budget was found in these owners. This inspection covered the native owners only. The later integration audit found outer service deadlines: native control defaults to10seconds, recovery workers to30seconds, and the public stop client budget composes those waits plus5seconds. Their owners are [protocol framing](../../../../packages/protocol/src/framing.ts), [operation deadlines](../../../../packages/protocol/src/operations.ts), [capture orchestration](../../../../apps/service/src/capture.ts) and [worker lifetime](../../../../apps/service/src/worker.ts). The export-only measurement below does not prove the complete future publication/recovery path fits those deadlines. Rollout must use truthful finalizing/retry and per-operation work ownership, with actual public deadline/cancellation tests; no global timeout was changed. A 60-second/3 GiB guard protected the final experiment only. No guard fired. Production integration still needs cancellation before/after metadata construction, during export and before verification/publication, preserving the packed payload and journal on interruption.

## Measured outer-limit cohort

The source contains 192,000 original PCM frames: two exact repeats of the frozen 2-second actual-writer payload. It is a synthetic fragmentation stressor, not a real long capture. Each run has at least one frame. Occupied runs alternate with 100 ms gaps, beginning at 100001 µs; every output start and duration was checked against independently authored frame addresses. Complete packed output is byte-identical to the input, 768,000bytes, SHA256 `f4c0d6d6d7058e5e0e85e3f3712a18426153766991b3f8589a82365dfddf6ff5`.

| Occupied runs | Metadata high-water | Final high-water | Export + inspection |
| --- | ---: | ---: | ---: |
|10,000|21.6MB|62.7MB|1.54s|
|100,000|101.8MB|1,559.5MB|26.15s|

Measurements are one-run observations on a 48 GiB host, worker self-RSS only; platform service memory is excluded. They are not latency promises or proof of safety on every host. The 100k candidate also decoded exactly after relocation with the original donor pathname absent.

Cancellation requested 100 ms after starting the 100k export produced `CancellationError`, exporter status 5, and settled at 0.69 s from process work start (0.76s including launch/monitor). Worker high-water was 102.1 MB. The immutable source hash remained unchanged. This proves early export cancellation, not a worst-case late cancellation latency or durable publication recovery.

## Alternatives retained, not adopted

Incremental composition insertion and bulk composition export both preserved samples; bulk reduced construction cost but did not eliminate export memory growth. The earlier 30-minute synthetic continuous control passed complete native PCM hashing with~21 MB materialization RSS. A separate FFmpeg long-file diagnostic was canceled and remains a limitation of that attempted verifier; it does not invalidate the independent native hash proof.

AVMutableMovie whole-prefix copy plus exact gap insertion passed small fragmented and 30-minute donor-removal controls at~14 MB. 16k incremental gaps exceeded the 60-second experimental observation budget. Bulk movie import emitted only 8 occupied mappings for 16k requested. Direct movie-track insertion emitted 8 separate tracks for 8 runs, not seven missing runs. Sample-level append failed somewhere in its append loop before mapping with AVFoundation-11800/OSStatus-17913, including explicit zero-based PCM PTS/DTS. The failing iteration was not identified; later inspection found documented zero-sample drain/empty-media terminal buffers, so a first-data-buffer failure must not be inferred. These are retained observed call-sequence failures, not claims that all platform alternatives are impossible. No custom header serializer is justified solely by relative inefficiency of the proven export.

## Next implementation seam and limits

Use one shared normal/recovery materializer below Wire. Stream the existing journal owner and bounded physical PCM decoder; coalesce one active exact run; retain only required composition metadata. Consume the actual journal `validatedPrefix {bytes,sha256}` prerequisite added on root 65d31fc8, rather than a second parser. Sequential per-role export avoids multiplying the measured high-water. Verify original sample identity/order/count and exact support before returning a candidate.

Candidate results must distinguish accepted, committed and represented native frame counts, clean physical EOF, pinned payload identity and journal prefix, and unmatched/corrupt tails. Cleanup eligibility requires complete physical decode and all pinned physical frames represented; verification of min(accepted,committed) alone is insufficient. 20d owns receipts, publication, admission and cleanup. Reconciliation, interruption/restart, actual accepted-record integration and full reader controls remain open; this leaf closes only the representation feasibility measurement.
