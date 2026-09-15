# Recovery timing and journal correction

Integrated the Opus correction and preserved the measured in-place journal update.
A generated variable-duration fixture with an edit list demonstrates the bug:
the wrong time domain reports 700000us; the corrected recovery reports the full
1000000us. Native frame selection and recovery now share the media/asset mapping
in `ScreenRecorderMediaTime`.

Malformed terminated journal records report `invalidAtSequence`; an unterminated
last line separately reports `incompleteTail`. Valid prior evidence remains intact.
Absent audio known to be unrequested reports `NOT_REQUESTED`; unexplained absence
continues to report `MISSING_MEDIA`. The journal owns typed event writes and their
durability policy, preventing callers from choosing conflicting payload names.

## Validation

The merged Mac package test command passed: capture timing/backpressure, actual
journal roundtrips, variable-duration recovery, an unfinalized fragmented file,
unrequested audio, native frame decoding and seven Node worker checks. The retained
log is `timing-integration-tests.log`. Root also reran all five retained own-window
recovery cases; decoded durations match their previous reports (`timing-integration.json`).
Independent Codex review found no confirmed regression. Its runtime checks failed
in the restricted codec environment; root's actual native execution supplies the
runtime evidence. Root corrected comments that overclaimed event validation,
ScreenCaptureKit frame delivery policy and per-buffer durability.

## Remaining limits

The unknown-tail response conservatively retains the interval up to the last
confirmed decoded timestamp and reports `UNKNOWN_TAIL`. The missing-cursor helper
branch is tested, but no real file was found that decodes while refusing its cursor;
that whole-response case is not an end-to-end verified gate. Rate-scaled edit-list
mapping is implemented but not exercised by a persisted rate-scaled fixture.
Video availability still requires scrutiny for files containing empty middle edits;
original capture fixtures have not established that case. Full service relaunch,
kill-during-stop, physical audio capture/audition and the complete recovery command
remain open in slice 02.
