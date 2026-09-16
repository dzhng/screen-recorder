# Read-only inspection consumer checkpoint

[Audio planning](../../../../packages/core/src/audio.ts) now consumes an explicit
revision, acquisition read capability and role-to-source resolver. Production
AudioInspection calls that same function before admission and native execution;
there is no package-specific edit or missing-audio algorithm. Frame, trail and
selection consumers require only their existing source/scene read methods.

[Generated receipt](audio-plan.json) comes from the actual normalized-evidence store
and AudioInspection queue/executor tests. A generated WAVE is moved, its old media
path disappears, and the explicit plan reads identical bytes at the new path. The
live executor receives the same kept spans/acquisition intervals and missing-role
report. Mutating source resolution or replacing observed acquisition with complete
kept spans reproduces a failure.

This proves a reusable consumer boundary and moved media path resolution. The
catalog still supplies evidence; no complete relocated package, file-backed evidence
reader, ZIP safety, decoded sample parity or transcript readiness is claimed.
[14b1](../../slices/14b1-audio-read-seam.md) records the next source-record paging
proof before broader reader abstractions. The full [14b](../../slices/14b-portable-inspection.md)
relocation and native comparison gates remain open.

Run `bun run --cwd packages/core test src/audio.test.ts`. An optional
`SCREENREC_AUDIO_PLAN_EVIDENCE` path emits a new generated receipt. Existing frame,
trail, selection, audio and catalog tests remain the behavior checks for this refactor.
