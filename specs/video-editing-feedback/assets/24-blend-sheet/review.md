# Scoped review

Refactor-clean: the compositor remains the only production blend owner. The
independent scalar arithmetic and rational support assertions are test-only.
Public admission reuses JourneyService, source acquisition, existing CLI/MCP and
delivered-PNG/movie observers; there is no additional renderer or installer.

Code-review: the completed [initial independent review](review-before-hardening.md)
found five verification gaps: prefix-only raster acceptance, unchecked independent
reference identity, unverified terminal movie support, unchecked export
identity/destination and late native operand hashing. All five are fixed.
Full raster dimensions/byte lengths and reference hashes are now checked;
independent rational segment/sample clocks prove two spans over [0,200ms);
export must match its project/export/revision, canonical requested destination and
exact already verified preview bytes; native hashes start before frame execution
and are rechecked after movie delivery.

Six portable tests pass. Disabling the timing guard produces the retained red
regression; oversized image and disabled public blend failures remain retained.
All seven hardened native cases and one hardened public multiply case pass.
All fourteen retained native/public movie clocks were read independently without
rerendering. The other six public runs predate hardening and are identified as
such. Scoped lint and formatting checks pass. No production blend formula changed.

Write-docs: executable runners own invocation; evidence keeps original and
hardened receipts separate. Slice, handoff and traceability now record public
admission and the conflicting visual reviews. The full-raster movie hard-edge
fidelity gate remains open. No full repository run was performed while the spec
implementation remains active.

The earlier broad review was terminated after unrelated speaker-inventory drift;
it was incomplete, never clean. The completed initial scoped review and the
follow-up verdict retained below are the applicable reviews.

Independent follow-up: started a read-only review of the hardened four-file
harness diff. It traced the relevant transport, export and native observers but
was stopped to finish this focused pass before producing a verdict (exit 143).
That review is incomplete, not clean. The completed initial review's five
findings were resolved using direct assertions and the narrow checks above; a
completed independent rereview of those fixes remains open. No additional final
finding was received. Review thread: `01a1110f-c5c3-7911-8e9f-debd23e78e24`.
