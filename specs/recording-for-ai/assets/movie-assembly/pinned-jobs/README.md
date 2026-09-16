# Pinned edited movies through the real queue

The [existing timing lab](../../../../../packages/test-harness/render-timing.mjs)
now passes resolved audio tracks from the shared acquisition planner into the
production movie worker. A generated capture journal is normalized by native and
ingested into the actual source-evidence store. The real revision store and job
queue pin the edited revision before undo commits; the first result remains the
four-second edit, and the next request produces the six-second restored source.
The sixty-second pause marker remains metadata and adds no movie duration.

[Edited movie](edited.mp4), [restored movie](undo.mp4) and the
[receipt](report.json) retain the actual outputs, core plans and measurements.
Both tracks are generated tones, including a changing narration frequency and an
acquisition gap. Native reports preserve that missing interval and the agreed
half-gain mix. Independent FFmpeg decoding is compared with lossless output from
the shared PCM owner: RMS error is below 0.0003 in both results. Decoder tail
padding is recorded separately from the exact four/six-second presentation.
Video frame identities and timestamps retain the original lab's assertions.

All original cancellation checks remain: queue cancellation, direct abort,
deadline and rejection of a late native answer leave no consumed result or attempt
files. Canceling a movie observes its actual native staging directory. Source video
and both audio inputs remain byte-identical. Removing the planned tracks makes the
lab fail because the pinned movie lacks required audio; the normal run passes.

Independent code review found no actionable regression. Its sandbox could not
complete either this native test or the unchanged baseline; the recorded host run
against the explicitly selected app worker supplies execution evidence.

This closes the generated queue/edit/audio integration question, not durable
preview publication or recovery after service death. Pointer composition, real
speech audition, app playback and complete public preview remain open.
