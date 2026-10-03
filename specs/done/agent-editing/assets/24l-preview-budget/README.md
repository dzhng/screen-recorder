# Optimized long-project preview budget

The native movie receipt samples the existing process RSS high-water mark only
after video rendering, audio generation, mux validation and publication finish.
It measures resident worker memory, not GPU allocations or instantaneous memory.
The worker still lives for one request; no new telemetry service or endpoint exists.

The full public scale journey retains the routed placement, inspection and queue
gates, then renders adjacent ten-second windows near the end of that same long
project. The first window primes video work; the different second window creates
a new job and native movie. A third request returns the second publication from
cache. Timing ends at public readiness, with file delivery measured separately.
“Cold” means the first movie in this journey, not a cold boot or emptied OS cache.

Actual encoded frames are independently decoded and checked against the corpus’s
presentation timestamps and counter glyphs. Reference frames are fitted through
the same 1080p-sized rectangle before downsampling for comparison; directly
rounding the tiny reference to the comparison size introduced a false glyph
ambiguity in the first harness run. The corrected reference recovers exact counter
membership without loosening the existing mismatch threshold.

Final acceptance uses a local release build. The preliminary debug/short-project
runs only established fixture correctness and are not the budget result. The
[verification](verification.json) pins configuration, worker identity and retained
reports. Original media are small prerecorded corpus assets; no devices, playback,
installation, model preparation or full two-hour rendering occurred.

[Combined-root verification](root-verification.json) repeats the complete scale
journey on the integrated service using the matching-source release worker.
