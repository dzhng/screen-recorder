# Shared operation contract

This package owns public request admission, response envelopes, errors and bounded
framing. App, socket, CLI and MCP consumers agree on one operation meaning. The
[operation declarations](src/operations.ts) are the canonical schema catalog;
adapters derive validation and help instead of maintaining another list.

Composition schemas come from their [pure owner](../composition/README.md).
Serializable admission is not execution readiness: supported native capabilities,
prepared dependencies and actual media availability are separate evidence.

## Identity and framing

A transport request ID correlates one exchange. A durable mutation request ID
identifies an explicitly replayable domain write; changing correlation cannot
turn an uncertain mutation into a new safe request. Structured failures preserve
that distinction rather than implying a disconnected request was rolled back.

[Framing](src/framing.ts) owns byte and time bounds. Measure encoded UTF-8, not
character count, and keep diagnostics outside the response channel. Complete
large results and media use owned leases; delivery metadata must retain the
selection and generation that produced the bytes.

[Cross-language fixtures](fixtures/) pin shared admission and envelopes through
real native consumers. Their assertions complement type checking: they protect
what actually crosses a process boundary, including malformed and foreign-owner
inputs.
