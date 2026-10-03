# Retimed preparation cancellation and retry

This packet verifies the existing public preparation lifecycle with a non-unit
preserve-pitch selection. It does not judge stretch quality or cancellation while
the DSP is still running. The barrier holds an already successful native reply,
so cancellation tests whether abandoned work can publish durable prepared audio.

The [summary](report.json) records 60 CLI/MCP exchanges. Cancellation leaves the
job result and prepared publication absent; polling does not retry it. After a
newer project edit, explicit retry keeps the same job, target revision and recipe
hash, with a new attempt and generation. Both historical prepared receipts remain
identical across service restart. The worker capability, the public baseline
receipt, and the native mix requests bind the same retime implementation identity.

The PCM oracle concerns storage and processing order: public unprepared audio is
captured first, then compared with the prepared result at the same endpoints and
sample count. Gain preparation equals that baseline multiplied by the declared
gain. The late historical read equals the final quarter-second of the baseline.
This comparison adds no independent quality claim; accepted audio parity lives in
the parent14e evidence. The black-canvas movie is only a duration/assembly smoke
check, not visual or event-synchronization evidence.

[The archive](evidence.zip) retains full transport exchanges, WAVs, native
requests/replies and a member-hash manifest. [Source identities](sources.json)
pin the tested harness and owners; the native binary is separately hash-pinned.
Run the [existing public preparation harness](../../../../../packages/test-harness/editing/prepared-audio-public.mjs)
with `--retime`, a fresh `--out`, and SCREENREC_NATIVE set to the isolated compatible
worker. Omitting `--retime` keeps the original unit-rate mode and its unsupported
retime check for the frozen worker used by that earlier proof.

The green run used the existing post-reply barrier without a new production hook.
No new production mutation is claimed here; the queue's cancellation/publication
regressions remain the owner of that guard. This packet does not establish package
recovery, capability-unavailable reuse, pitch-follow quality, or in-flight native
DSP cancellation.

[Root integration](root-verification.json) independently reran the retime lifecycle
on merged sources and verified every retained archive member.
