# 24w — Waveform query memory across doubled duration

Status: verified; [complete evidence and original red](../assets/24w-waveform-duration-memory/README.md). Dependencies: [24m](24m-query-duration-memory.md),
public waveform correctness in [11](11-audio-inspection.md).

Extend the existing duration-memory journey with an explicit waveform mode;
its default timeline mode remains unchanged. Preserve 10,000 real 100ms clips,
source bytes, routing and alternating three-process cohorts at two/four hours.
Restart after authoring before measuring cold and 20 cached waveform reads.

The final 250ms selection contains 150ms of authored gap followed by the last
100ms source occurrence at both durations. Deliver 250 stereo buckets on the same
48-frame grid through MCP. Independently verify every min/max/RMS value, absolute
sample bounds and provenance with the established exact comparison policy.

Compare median sampled service peak and growth above startup against the existing
less-than-2x requirement. Keep cached 250-row p95 at or below 250ms. Record complete
trials and failures before profiling. This does not measure instantaneous memory,
native decoder scaling, images/spectrograms, full-duration PCM or learned models.
Root owns parent status and choices integration.

The original latency red exposed two full-document loads used only for ownership.
A shared throwing check composes existing project/revision availability and keeps
missing/foreign/deleted refusals unchanged; composition validation remains intact.
The corrected six-cohort run passes the original limits. Query latency includes
public delivery and validation; RSS is sampled service memory, not native/tree RSS.
