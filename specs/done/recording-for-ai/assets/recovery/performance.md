# Recovery performance audit

## P2 — Repeated copying while accumulating audio gaps

**Owner:** `CaptureJournal.inspect`. **Trigger:** a long journal with many separated
accepted audio intervals, such as repeated delivery gaps. Each record reads the
interval array out of a dictionary, modifies the local copy, then assigns it back.
Swift copy-on-write can therefore copy the entire accumulated array per new gap,
making work grow quadratically with the number of gaps.

A generated metadata-only release-build probe round-tripped the actual journal
writer/reader. At 10k/20k/40k gapped records, reads took 0.070/0.176/0.478 seconds.
At 80k/160k, reads took 2.204/6.417 seconds. The same 160k records without gaps took
0.888 seconds. Raw measurements are adjacent. The 160k fixture models about 53
minutes at one event per 20 ms with a gap after every sample: intentionally
pathological, not a claim about ordinary short recordings.

**Acceptance seam:** mutate the dictionary-held interval array in place while
preserving every exact interval and the contiguous-range merge rule. Compare the
same release-build fixture before/after; no new cap, dropped evidence or alternate
journal format. An isolated candidate using an in-place dictionary subscript update read 80k/160k
gapped records in 0.499/1.084 seconds; every interval start/end was verified. The
contiguous case stayed around 0.519/1.033 seconds. Candidate verification is retained
in `journal-perf-candidate.jsonl` and `/tmp/screenrec-journal-perf`.
Production now uses the in-place update. The same release-build probe verified
every interval and read 80k/160k gapped records in 0.479/0.972 seconds; raw results
are in `journal-perf-production.jsonl`. The native worker build and all three
recovery tests pass. Independent read-only review confirmed interval preservation
and the copy-on-write reasoning. Preserve this update when merging the separate
recovery correction worktree.

## Not established — per-buffer append causes recording drops

The measured writer serialized 160k records in roughly 1.1 seconds total. This does
not measure individual fsync latency or concurrent screen/audio delivery, so it
neither proves nor dismisses real-time frame loss. Keep that actual capture gate
open. Do not replace acquisition evidence with an asynchronous checkpoint scheme
based only on a speculative performance concern.
