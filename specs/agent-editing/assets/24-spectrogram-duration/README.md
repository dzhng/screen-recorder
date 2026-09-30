# Spectrogram duration and ordered moves

This matched public check retains 10,000 real occurrences at two and four hours.
Each fresh service delivers one cold and 20 cached spectrograms for the same
250 ms source/gap window, including the complete centered FFT context. The
32,500 density values, 12,040-frame context PCM and 1,166,400 plotted RGB bytes
match exactly. Absolute time labels differ. No full-duration PCM or model work
was performed.

| Duration | Sampled service peak bytes | Growth above startup | Cold delivery ms | Cached p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Four hours | 457,801,728 | 332,644,352 | 1,705.271 | 275.266 |
| Two hours | 390,791,168 | 264,323,072 | 1,786.056 | 223.977 |

The four/two-hour ratios are 1.171474 peak and 1.258476 growth, both below the
existing 2× limit. These are sampled service RSS measurements for one matched
pair, not instantaneous process-tree peaks or universal load immunity. Latency
includes public delivery/validation and is diagnostic: the waveform 250 ms gate
is not a new spectrogram PNG SLA.

## Failure and repair

The original two-hour setup first tried `reanchor`, correctly refused because it
would change the project interval. The corrected actual `move` request then
exceeded the unchanged 15-second public deadline and committed later. Its exact
500 operations, original revision, durable receipt and resulting revision remain
in `original/`; the timeout is not relabeled as a successful run or rollback.

The ordinary path resolved and compared the complete 10,000-clip document for
every move. This repeats full validation and roughly ten million clip
serializations across 500 moves; this is source-backed amplification, not a
measured attribution of component time. Existing append batching did not cover
moves. The repair shares resolution only for structurally proven ordered moves;
[24c](../../slices/24c-edit-batch-work.md) defines eligibility and scalar fallback.
No timeout, batch limit, overlap rule or numeric tolerance changed.

A fresh clone at the original revision executed the unchanged public request in
281.314 ms. The full document and all 500 edit receipts match the retained late
commit; new revision IDs/timestamps legitimately differ. This is actual execution,
not replay. The remaining public setup batches preserved all 10,000 occurrences
and nonplacement fields. Expanded FFT support was independently checked before
query measurements. The original donor catalog remained unchanged.

253 composition tests and type checking pass. Regressions compare the ordinary
move path, including later-overlap repair, freed-space order, precision/error
index, fractional spans, dependencies, global processing, no-ops and frozen
receipts. Removing the neighbor guard makes the later-repair test fail; that
mutation log is retained. Initial invalid test fixtures and their corrections
remain in the logs. Six isolated JavaScript build tasks passed; native workers,
models and root runtime artifacts were not rebuilt or changed.

## Identity and limits

Both cases use frozen native worker SHA256
`8a0c7732f3c1f99e074048f2ac3b8b29beb613462fb5ce769a134b1cbfdea186`.
The four-hour measurement used root JavaScript; two-hour setup and measurement
used the isolated rebuilt JavaScript. Per-case paths and hashes are retained.
Of 182 compared JS paths, 179 shared files match exactly, including query,
audio, acoustic, service and transport owners. Only shared `composition/dist/edits.js`
differs; two root-only stale files have no executable import references. This is
not a claim of identical complete runtimes. The four-hour measurement was reused,
not repeated to improve its result. Final harness metadata/retained-request checks
were reviewed after the successful invocation, without another media run.

The original failed 24w donor was copied only after checking no nonterminal or
deferred jobs could resume. Catalogs in the archive are actual owner state,
never fabricated database rows. Audio/source and saved image artifacts are
retained alongside receipts. `readFrames` in the spectral receipt describes FFT
reads, not decoded source bytes or physical I/O.

`manifest.json` authenticates every member of `evidence.tar.xz`; `identity.json`
authenticates the archive. The archive includes failed and successful requests,
real catalogs, native receipts, complete PCM/spectral output, PNGs, source
snapshots, tests, mutation and review logs. Root independently rechecked request
identity, complete edit outcome, ratios and decoded pixels without rerunning
service/media work. No physical capture or listening acceptance is implied.

Independent CLI review was attempted but its configured default model was
unavailable before review began; that failure is retained without changing model
configuration. A fresh read-only collaboration review supplies the final second
opinion (verdict retained in `checks/independent-review.md`). Shape review kept one
editor and existing exact algebra; no cache, generic move framework or alternate
validation owner was introduced. Broader parent24 and post-cutover acceptance
remain open.
