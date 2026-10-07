# Wait and evidence delivery proof

This checkpoint exercises the public spawned CLI and MCP stdio adapters. The
wait adversaries use a real local socket listener with controlled remote replies;
measurement and waveform journeys use the real service composition, cache,
job/publication, lease, loudness parser and native command lifetime owners.
Native PCM decoding and the FFmpeg scanner's external response are controlled.
The one-sample fixture proves delivery and unavailable integrated duration, not
meter accuracy, visual readability, inference or speech quality.

`delivery-receipt.json` retains actual requests and complete replies;
`measurement.json` and `waveform.json` are the delivered JSON bytes. Transient
paths and expired tokens in receipts identify that isolated run, not durable
consumer file authority. `focused-tests.log`, `build.log`, `typechecks.log` and
`lint.log` retain the scoped checks. The feature's end owns the full suite.

## Red/green evidence

Tests were introduced or strengthened one tracer at a time. Observed failures:
unknown `--wait`; older ready publication falsely accepted while its current job
was running; changed job target accepted until timeout; model prepare forwarded
source parameters into strict model.status; batches accepted an old ready item;
measurement --output rejected as unsupported; invalid JSON published a final
file; SIGINT failed to close an acknowledged lease; no-ack admission deadline
exited 1 instead of 2; unrelated selected source job accepted until timeout;
changed revision leaked its foreign lease; cancellation during file sync still
published the destination; a completed index page accepted another attempt and
lost job identity; source transcript pages accepted another attempt; pending
export.status/retry/recover returned a generic job instead of the export receipt;
export recovery inspected the failed publication job instead of its queued
reconciliation job;
package waiting attempted to inspect a private context job, lost its admission
acknowledgement after restart, and settled while closing; a failed batch disk write left a partial final file. Each
received a focused green rerun after correction. The cached-failure lease
regression was falsified by removing cleanup: the next two fresh leases leaked.
`review-regressions-red.log` also retains deliberate falsification of the phrase,
export and recording getters and batch deadline classification; sources were
restored before the complete scoped green run.

Other adversaries pin revision, inspect current generation/attempt, wait through
dependency stages, retain failed/canceled generations and batch failures, refuse
incomplete delivery, and preserve ordinary acknowledgements. Existing chunk,
expiry/renewal, MCP framing, atomic no-overwrite and service-free help checks run
in the focused set rather than being duplicated here.

## Review

Shape, diff and documentation review are complete locally. Independent scoped
review found five public edge cases; the follow-up confirmed their resolution and
identified the completed-index attempt gap. All were addressed through public
regressions. Its next pass identified the source-transcript and initial-export
getter variants, resolved by general evidence-page and getter-observation rules.
The admission follow-up confirmed those and package lifetime semantics, then
found the nested export-recovery job. The added producer-shaped public regression
keeps a failed original publication plus queued recovery in the same response;
the observer now selects the current recovery work and fetches the export domain
reply after it settles.
The terminal-path follow-up found that failed recovery still replaced that domain
reply with a job summary. Failed/canceled recovery now refreshes the export getter
when needed and retains its history; the CLI outcome checks current recovery
separately from a historical committed file. Public failure/cancellation checks
were red on lost history, then red on false exit 0, before going green. A
post-getter concurrent retry was falsified by removing identity reinspection:
it incorrectly settled instead of reporting the changed pinned attempt.
The retained verdicts describe source inspection and direct probes;
the read-only reviewer could not rerun Vitest because its temporary directory was
denied. The scoped green log is the implementing worktree's executed proof. The
[final scoped verdict](review-final.md) is clean;
[review receipt](review-receipt.json) retains completion and artifact hashes. No new endpoint, database, migration, external dependency,
background worker or compatibility path was added. The adapter owns one wait
observer and two CLI flags; the protocol owns optional wait outcome metadata.

Package tests retain the existing wire shape: data.id is passed as admissionId;
the opaque context-job ID is not sent to public job.get. Ready handles remain
process-local, timeout retains pending identity, a changed admission is refused,
and admission-not-found after a restart interrupts observation without claiming
rollback. This is public adapter proof against controlled service replies; it
does not certify native ZIP decoding or handle persistence.
