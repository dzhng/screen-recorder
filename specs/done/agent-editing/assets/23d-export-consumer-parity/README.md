# Native export receipt consumption

The existing macOS export consumer now preserves the recording/project target
actually returned by the service. A received record requires exactly one owner;
the menu names that owner and recording deletion stays in its own namespace.
Outbound recording create/save-panel/replay behavior remains unchanged. This is
an isolated consumer port, not installed cutover or a project-authoring interface.

[Verification](verification.json) and [the pinned packet](evidence.tar.gz) retain
four demonstrated reds and their passing checks: the original decoder rejected
an unchanged project receipt, malformed discovery was erased by a later successful
page, and an accepted retry with an unreadable reply left a previously stopped
record outside status observation. A malformed-only recovery fix also failed
the same accepted-retry case with a timeout; the final shared classification
covers unreadable data, timeout and service loss. The final consumer preserves last good state,
shows the problem, and resolves unanswered retry uncertainty through ordinary
status without resending the mutation. Definite refusals remain distinct and do
not cause stopped exports to poll forever.

The actual controller and menu run against the existing scripted external Call
seam and direct Swift compiler harness. Positive decoding/discovery/retry cases
reuse unmodified payload values from the retained 23b recording/project report.
That original report is copied byte for byte into the packet. Deliberately
malformed ownership, same-ID collision, stopped retry and cleanup-pending cases
are labeled scripted variations; they are not represented as new service or
media measurements. All received fields, exact continuation, visible errors,
retry/cleanup actions, output reveal and owner-specific forgetting are checked.
The complete pure-controls test executable also passes.

[The manifest](manifest.json) pins changed source, retained reference and every
regular packet member. Logs disclose the precise test filter that excludes the
bundled-service media test. Builds use unique scratch controls libraries and
executables, removed after each run. No media render, capture, model preparation,
ASR, native media-worker build/replacement, application launch or installed switch
ran. Menu-model checks establish labels and action semantics; no screenshot,
physical, listening or final installed acceptance is claimed.

Remaining consumer ports and eventual installed switching stay with parent 23.

[The merged verification](merged-verification.json) independently checks the packet,
reviewed source and unchanged public reference, then passes both focused controller
tests on the integrated code. Remaining consumer ports and installed acceptance
retain their own gates.
