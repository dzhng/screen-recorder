# Portable source screenshot indexes

The existing screenshot-index owner stages PNG bytes and retained candidate and
coverage rows. Source-index validation runs against staged source/scene owners
before publication; catalog adoption remains synchronous and atomic. A revision's
non-document dependencies are serialized and restored to its adopted identity.
No additional index store or readiness authority was introduced.

The retained public journey imports into an existing donor library, then relocates
into a fresh library. After deleting donor paths, archive and model files and
restarting the receiver, the first index read is ready: exact generation, rows,
coverage and PNG hashes agree. Real transcript and scene evidence, current and
historical media, undo/replay and failed-import controls also pass. The complete
receipt is in report.json.gz.

Independent reviews identified publication key ordering, missing revision roots,
blocking staged validation, source geometry checks and coverage equality gaps.
Those were addressed through the existing domain owners. The final journey first
failed because its expected asset inventory omitted the newly authored revision-only
asset. The corrected assertion includes and hashes that exact asset; no dependency
or media check was removed. Both logs are retained. Focused owner tests pass;
the unchanged project deletion timing gate passes after host load eased, without
raising its deadline. Earlier timing failures are not represented as a green broad
suite.

This checkpoint does not cover project screenshot indexes, prepared audio, fonts,
noncurrent export or a fresh autonomous skill journey. Combined-root integration
and its affected checks remain required before calling this checkpoint integrated.
