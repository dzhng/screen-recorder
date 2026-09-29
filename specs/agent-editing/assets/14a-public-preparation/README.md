# Public retained audio preparation

`audio.prepare` admits a full processed output for an explicit project revision
through the existing PreparedAudioStore and JobQueue. The result is an immutable
lossless audio asset, so existing asset, audio and acoustic inspection consume it
without a new delivery path. Preparation does not alter a document or current head.

The shared public schema requires a revision. Repeated calls reuse the same
compiled recipe; failed/canceled work needs explicit job retry. Missing execution
support refuses before admission. This checkpoint exposes verified unit-rate/gain
preparation, not accepted noise reduction, stretch or speech quality.

The public native journey exercises CLI/MCP equivalence, published asset inspection,
waveforms, exact PCM, cancellation after a real native reply, explicit retry,
unchanged revisions, historical/restart reads and unresolved retiming refusal.
The [owner and portable proofs](../14a-prepared-portable/README.md) retain their
fencing, bounded-read and relocation scope. The [fresh public skill trial](skill-review.md) independently prepares a chosen
half-gain mix, verifies every delivered sample and all1022 waveform buckets,
and confirms receipt/revision reuse without implementation discovery. It uses
CLI; the separate native journey covers MCP too. Its help-size friction is
nonblocking and retained; no listening is inferred.

The service regression fails before registration and passes afterward. All37
focused protocol, preparation-owner and service tests pass. Independent read-only
review found no actionable defect. Early harness errors (incorrect new-step ID,
retime request shape and counting cleanup calls as renderer attempts) are retained
as harness failures; they are not product regressions or accepted negative controls.

The final native report compares all48000 frames of both original and gained
output and a12000-frame historical excerpt after restart. All comparisons are
exact. Tests, build, types and lint pass; full worker identity is in the report.
The fresh trial's externally owned scratch service was stopped after completion.
Actual model-dependent DSP and full scale acceptance remain open in14a.
