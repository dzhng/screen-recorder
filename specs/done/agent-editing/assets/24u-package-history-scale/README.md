# Combined document and history transfer

The public gate preserves 1,000 actual ProjectStore revisions: one empty creation
and 999 complete 250-clip documents sharing one admitted source. The source and
resource inventory are independently checked, every exported revision is checked
against its donor bytes, and every adopted revision is compared after normalizing
only newly assigned project/revision IDs. All 999 mapped undo entries are checked
through receiver export; one actual latest undo is then exercised. This is not
999 public undo calls or a proof of arbitrary composition/history cross-products.

`report.json` is the final live result. `identity.json` records the command,
toolchain and native executable identity. `artifact-files.json` hashes every
complete member in `evidence.tar.xz`, including both full package outputs,
catalogs, selected audio, original failure, profiling controls and source.
Final harness cleanup refinements followed the live green: failed shutdown marks
the report failed, always persists it, and terminates captured owned descendants
only when PID/start identity still matches. A separate bounded process control
proves owned parent/child termination, unrelated-process preservation and failed
report persistence. Acceptance assertions and production source did not change.

[Root verification](root-verification.json) checks the integrated build and
project/service contracts and independently rehashes every archived member.

## Failure and attribution

The original public run timed out while adoption nevertheless committed all
1,000 revisions and 999 undo entries. Inspecting that receiver and replaying the
same request preserved its project identity. Replay prepared in 1.959 seconds and
published the existing result in 70.9 milliseconds; it did not measure first
publication.

The first fresh-receiver diagnostic was interrupted by the harness's unchanged
shutdown guard during publication. Its partial trace is retained; SQLite journal
recovery found no committed project. The next diagnostic reused that receiver
and request after rollback, observing publication independently of request
completion. Publication took 31.968 seconds: 1,000 project-head updates accounted
for 30.296 seconds, while revision insertion took 93 milliseconds and undo
insertion took 6.4 milliseconds. Its initial public receipt arrived in 1.552
seconds. That initial receipt does not establish responsiveness during the long
transaction. Instrumentation overhead and host conditions apply to these timings.

History insertion now retains/inserts revisions without changing the project
head. Create and adoption already insert the selected head; ordinary edits and
undo/restore publish their head within the same transaction. Replay compares the
same complete canonical snapshot and atomic publication is unchanged.

## Verified scope

The unchanged live gate passes: complete transfer, historical reads, donor-path
unavailability, exact selected WAV equality, latest undo, explicit 1,001-history
refusal, and a pinned prior export identical to the pre-refusal export. Serialized
history plus resource JSON is 101,522,148 bytes; the manifest is 338,587 bytes.
All existing metadata, history and operation deadline limits remain unchanged.

Sampled service RSS peaks were 2,847,801,344 bytes for donor export and
2,913,714,176 bytes for receiver work; controller peak was 933,937,152 bytes.
The 4 GiB stop guard is an operational precaution, not a package memory SLA.
The final report does not retain individual adoption timing, so no after/before
speedup ratio is claimed. Broader load responsiveness remains outside this gate.

Independent review found three harness gaps before the final run: independent
resource hashes, complete undo mapping, and memory enforcement during pending
work. All were corrected. Final full review and cleanup follow-up found no actionable defect;
12 focused ProjectStore tests passed. Retained setup errors include a scratch
symlink-path refusal and an incomplete early replay observation; neither is a
product success or a substitute for the final gate.
