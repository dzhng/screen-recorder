# Screenshot index performance

## Completed generated workload

The [full report](native-scale-complete.json) records a completed thirty-minute
320×180/30fps animation through the bundled service and native worker. All 6,459
selected images published, and 33 public metadata pages enumerated them without
loading all image bytes. The source hash remained unchanged and every owned process
was reaped. This establishes full workload completion, not real-capture usefulness
or an end-to-end personal release.

On the recorded Apple M5 Pro host:

- Preparation plus indexing took 1,997.893 seconds (33 minutes 18 seconds).
  Index generation itself took 1,831.031 seconds after dependency preparation.
- A concurrent clean frame at source second 900 returned in 192.95 ms while the
  index was active. This measures that request, not every possible foreground call.
- Sampled service RSS peaked at 230,384 KiB (about 225 MiB); sampled worker RSS
  peaked at 32,096 KiB (about 31 MiB). The report retains the trace against elapsed
  time and source progress. Sampling does not establish guaranteed instantaneous peaks.
- Retained PNGs occupied 235,577,443 bytes, derived cache files 442,990,985 bytes,
  and serialized retained rows 38,997,669 bytes. These categories are separate;
  retained selected images survive derivative cache eviction.

The report pins the source hash, runtime revision, executable/bundle hashes and host.
Subsequent storage/UI changes are not part of that measured bundle. Its input is
synthetic and low resolution; do not extrapolate these numbers to full-resolution
screen capture or claim an isolated optimization speedup from the earlier runs.
The [same-frame cache-hit/eviction companion](frame-cache-scale.md) also passes on
this long input: CLI reuse retains file identity and bytes, LRU eviction removes it,
and explicit retry after restart regenerates identical pixels with a new cache identity.

## Reproduce

`bun run lab:index-scale` runs this optional workload. Set
`SCREENREC_INDEX_SCALE_VIDEO` to a preserved absolute input path for a same-input
comparison and `SCREENREC_INDEX_SCALE_EVIDENCE` to an empty absolute report directory.
The harness copies input into its own home, checks source identity again at the end,
and records full completion, public paging and process cleanup. Reports are replaced
atomically so an interrupted run retains its last complete checkpoint.

The 45-minute safety deadline is a measurement guard, not a speed acceptance claim.
The spec requires a thirty-minute input; only the separate speech gate requires
real-time processing. Running and failed reports never satisfy completion.

## Why requested-time reuse exists

The [partial baseline](native-baseline-partial.json) exposed repeated overlapping
observation requests: whole-batch cache keys could not share identical timestamps
when a local endpoint changed the rest of the batch. Native requests were individually
bounded, but index size multiplied that repeated work.

[Requested-time reuse](../scene-analysis/requested-time-reuse.md) now shares exact
requested times within identical source, kept bounds and policy through the existing
cache owner. Deduplicating merely by actual video timestamp would be incorrect:
a different kept interval can select a different frame. The core regression reduces
eleven requested slots to six, and the existing public trail PNGs remain byte-identical.
Native cursors already seek adjacent to the retained time; decoding from source zero
was not the cause. More queue capacity or polling would not fix repeated observations.

## Earlier incomplete evidence

The [monitor-failure report](native-scale-monitor-failure.json),
[provenance](native-scale-monitor-provenance.json) and
[RSS observations](native-scale-monitor-rss.json) remain diagnostic evidence. That
run stopped when its separate metrics connection hit `SQLITE_BUSY`, not because an
index job was observed failing. Bounded busy retries now permit an explicitly missing
intermediate observation; the final snapshot must succeed. The completed report above
supersedes this run as completion evidence. The earlier partial baseline also predates
a before-event correctness fix, so comparing their rates cannot isolate cache speedup.

## Still open

Generated density fixtures and real captured pointing must establish selection
usefulness. Dense animation can produce many mandatory boundaries; silently dropping
those images would hide the behavior. Preserve independent event/coverage ledgers,
readable contact sheets and the physical capture gates before closing parent 11.
