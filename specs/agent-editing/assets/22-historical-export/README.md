# Historical package snapshots

An explicit revision selects a project as it stood at that moment. The package
keeps every revision through that point and its active undo stack; later donor
edits and their project indexes stay outside. Export does not move the donor head.
ProjectStore owns this boundary, so archive assembly consumes the same selected
history rather than synthesizing a restore edit or creating branching history.

The [native receipt](report.json.gz) passes the default and historical checks.
The native journey extends the existing default package run with a second export.
After the donor has undone, restored, edited and built a later screenshot index,
it exports the earlier moment, removes donor/import/model data, adopts in another
library, removes the archive and restarts. Exact native picture/audio output,
history, undo and an edit followed by undo must match that selected moment.

The [harness](../../../../packages/test-harness/editing/package.mjs) retains all
existing default acquisition, transcript, screenshot-index, replay, cancellation,
corrupt/missing member and bounded-history checks. Core checks separately cover
selection before and after undo/restore and a later incomplete index excluded
before readiness checks and inventory limits. Removing the selection filter makes
that regression fail.

This checkpoint does not close model-dependent prepared output, fonts/captions or
the final public skill gate. The first native attempt used an older worker that
rejected newer output-control fields before reaching package export; that setup
failure remains recorded. The existing deletion-history test also timed out on
both this branch and main baseline at its unchanged five-second deadline.

Independent review found and resolved later-index inventory leakage; the second
review found no further actionable issues. Its longer-timeout diagnostic pass is
not counted as verification at the normal deadline. Service tests, core types and
the CLI/service build pass. [Worker identity](worker.json) pins the native binary.

Final focused core runs pass 38 of 39 checks with four workers and one worker;
both retain the same deletion-history timeout. The new snapshot/index checks
pass at the original deadline. This is a disclosed baseline timing limitation,
not a claim that the whole focused suite is green. All 11 service tests and all
27 native journey checks pass.

Combined root confirmation passes all27 public relocation checks with the
text/output-settings native build; the root report and logs are retained here.
Owner/service tests pass48/49 with the same disclosed deletion-fixture deadline
failure. Exact current/history font closure passes separately in the
[literal-caption package journey](../17c-literal-text/README.md). The retained root
package report's remaining-font note predates that cross-journey reconciliation;
it describes no font coverage inside this general package harness. Actual15a
outputs and final autonomous skill consumption remain open.
