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

## Reproducible full-run measurement

`bun run lab:index-scale` runs the bundled native worker against the same generated
thirty-minute animation. `SCREENREC_INDEX_SCALE_VIDEO` optionally selects a preserved
absolute input path; the harness copies it into its isolated home and records its
hash. `SCREENREC_INDEX_SCALE_EVIDENCE` selects an empty absolute report directory.
A fresh temporary directory is the default. The lab never joins the default test glob.

The report is atomically checkpointed during source analysis, index generation and
foreground requests, so interruption retains completed measurements. RSS is sampled,
not a guaranteed peak. Full completion, bounded public paging and owned-process
cleanup remain required; a running or failed report does not pass the gate.
The measurement has a 45-minute safety deadline, recorded in its report. The spec
requires a thirty-minute input, not completion in thirty minutes; only the separate
speech gate requires real-time processing. The deadline is not a speed acceptance
claim. The partial integration rate motivated this allowance; a full measurement
still has to establish actual elapsed time.

## Interrupted integration run

The [integration report](native-scale-monitor-failure.json),
[bundle/input provenance](native-scale-monitor-provenance.json) and
[RSS trace](native-scale-monitor-rss.json) preserve a second incomplete run.
The same video hash was used. Source analysis finished before index admission at
180.4 seconds; a concurrent clean frame completed in 192.3 ms. The last checkpoint
at 767.8 seconds retained 2,088 PNGs through source second 584, occupying
75,889,189 bytes. Sampled service RSS stayed near 264–266 MiB during the separately
observed portion; sampling cannot establish a guaranteed peak.

At 783 seconds, the benchmark's separate read-only catalog connection raised
`SQLITE_BUSY` while collecting metrics. The harness terminated the test and reaped
all owned processes. This is a monitoring failure, not an observed index job failure
or a passed full workload. The monitor now uses bounded SQLite-busy retries and records a missing intermediate
measurement explicitly; completion still requires a successful snapshot. Three real
SQLite regressions include a competing writer and permanent schema failure. Rerun;
do not count this partial report as completion. Comparisons with the earlier partial
baseline also differ in before-event rendering correctness, so they do not isolate
a speedup from caching alone.

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
