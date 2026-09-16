# Screenshot index performance audit

## Implemented reuse; full-run measurement remains open

**Priority:** High — delays an external agent waiting for a long recording's index.
**Owner:** VisualObservationCache, used by shared frame materialization through
requested-time trail planning. **Acceptance seam:** overlapping-request real-cache
regression, unchanged native image bytes, then the complete thirty-minute index gate.

The [partial native baseline](native-baseline-partial.json) uses an actual bundled
worker on a generated thirty-minute 320×180/30fps animation. Source analysis completed
all 180 chunks in about 146 seconds. At the controlled stop around 505 seconds,
index rendering had produced 756 PNGs through source second 218.8. Those PNGs occupy
26,906,216 bytes. A foreground clean frame completed while the index remained active;
this partial run did not retain its latency measurement.

The cache then contained 1,311 observation batches with 18,777 requested sample slots,
but only 9,751 distinct source/kept-interval/policy/requested-time keys. These counts
measure requested observations, not an exact decoder-call count: native sampling
can reuse adjacent requests that select the same actual frame within one batch.

The measured baseline keyed a whole batch by its complete timestamp list. A two-second
trail window that overlaps a previous window therefore misses unless every request
matches. The canonical scene scan already sampled the same source grid, but a local
endpoint or future-frame reference changes the list and prevents reuse. Each request
is bounded (at most 52 observations), yet repeated overlapping requests multiply
native work as the selected-image count grows.

**Disposition:** [Requested-time reuse](../scene-analysis/requested-time-reuse.md) is
implemented and core/native parity verified. Reuse exact requested times within identical source, kept bounds
and policy, through the existing cache owner. Do not deduplicate merely by actual
video timestamp: a different kept interval can legitimately select another frame.
Preserve cache eviction/recovery and native selection semantics. The regression reduced eleven requested slots to six. All eight existing public
trail PNGs are byte-identical after integration; the full scale rerun remains open.

The baseline was stopped deliberately after identifying this work amplification;
its source video and journal were preserved outside the repository for a same-input
rerun. It is incomplete and does not pass the thirty-minute gate. The controlled
app stop made the test terminate with a socket error; its cleanup reaped owned
processes. No timeout or successful completion is claimed.

## Separate open gate: animation selection density

The shared detector marks many boundaries in dense animation, and selection retains
both valid sides as specified. Silently dropping mandatory candidates would hide
this issue rather than measure it. The contact-sheet harness must distinguish smooth
local movement from repeated whole-page changes, report selected/unique images and
compare them with independent fixture events before any policy tuning.

## Dismissed as the cause of this amplification

Native sample cursors seek adjacent to the requested retained time; the decoder
sets AVAssetReader's range at the selected sample. This is not a scan from source
zero for every PNG. The frame lane remains bounded, and canceled executors continue
to hold their slot until they exit. More polling or a larger queue would not reduce
the repeated observation work.
