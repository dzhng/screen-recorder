# Pause preservation and interrupted terminal persistence

The prerecorded input fixture feeds decoded source buffers through the actual
writer for narration and system audio. A pause recorded before delayed delivery lies inside that input’s host-time range.
The oracle excludes overlapping buffers and independently derives the accepted
PCM and placement digests from the offered samples and observed pause duration.
It compares both normal canonical publications and their recovery verification.
This proves sample/support preservation, not physical synchronization or listening.

Terminal-boundary fixtures copy a completed take whose canonical receipts are
already durable, retaining its exact accepted journal prefix. Removing the final
record or leaving its partial bytes models interruption during diagnostic
persistence. Repeated native recovery preserves all source files, reports no
finished completion and retains verified media. The public journey checks that
CLI/MCP expose interruption, usable r0 and no invented diagnostic after restart.
These reconstructed filesystem states are not actual process-kill or power-loss
experiments.

The native probe is selected by `SCREENREC_NATIVE_PUBLICATION_OUTPUT` in the
existing capture test executable; it uses the prerecorded `00-corpus`. Its output
is the input to the [public journey](../../../../../packages/test-harness/editing/capture-terminal-boundaries.mjs).
The journey requires built service/CLI and `SCREENREC_NATIVE` pointing at the local
native worker. It substitutes only an idle desktop-control peer and never starts
physical capture, enumerates devices, plays audio or changes installed state.

Focused and default native tests and the public journey pass. Source-processing
receipts also preserve absent completion and distinguish torn tails. Both new
native assertions fail under scoped production mutations and pass after restoration.
Independent review found no actionable defect; its Swift runtime was unavailable
because of an SDK/compiler mismatch, separately from the passing local runs.
[verification.json](verification.json) records exact scope and runtime provenance.
No production policy or API changed.
