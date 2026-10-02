# CLI service selection through delivery

One CLI invocation keeps the socket it selected before dispatch while consuming
its artifact leases. Discovery supplies startup readiness; delivery consumes the
returned lease through that selection. A service restart still invalidates tokens.
The [owning slice](../../slices/24z13-cli-delivery-selection.md) defines the boundary.

[Verification](verification.json) binds complete red/green command outputs,
phase-specific source snapshots and final runtime authority in the
[archive](evidence.tar.gz). The original single and batch routes sent extra health
probes. After a service disappeared, a later batch item entered app discovery and
reported APP_NOT_FOUND; the corrected route reports its socket connection failure.
The original interrupted read retains its truncated-frame diagnostic.

Initial disappearance assertions guessed a close-event diagnostic; the actual
transport receives an unterminated frame first. Those failed assertions and the
corrected baseline failure are retained. An intermediate fixture type introduced
circular inference; its failed type check and correction are retained separately.
Scratch resolution probes also used an unavailable package-root export and the
wrong SDK lookup directory; final authority resolves from the CLI package.

The affected consumer suite passes without changing bounds. These are synthetic
socket/byte fixtures with real CLI children, not new native/media or performance
cohorts. Existing preparation/model/runtime homes and historical archives remain
untouched. [Choices](choices.md) and [review](review.md) disclose the narrow pass.
