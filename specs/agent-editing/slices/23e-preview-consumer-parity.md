# 23e — Native preview receipt and lease parity

Status: isolated receipt/lease/controller parity verified. [Evidence](../assets/23e-preview-consumer-parity/README.md). Depends on existing public project
preview receipts and the preservation contract in [23](23-cutover.md).

## Contract and ownership

An explicitly selected recording or project is previewed through the same native
request/lease controller. The first accepted revision pins subsequent reads and
explicit retries; caller-supplied revisions remain exact. Outer answer and movie
ownership/revision must agree with that request. Ready media requires a matching
unexpired delivery lease, byte count, absolute path and supported media type.
No project selection interface, implicit identity project or service API is added.

`PreviewController` remains the sole request, receipt, lease and generation owner.
Its concrete window/player presenter owns only AppKit/AV display and interaction.
The production presenter preserves ordinary user-requested recording playback;
a scripted presentation sink exercises the same controller without opening a
window, constructing a player or playing media. This is a platform boundary,
not a test-only playback flag or second state machine.

Recording/project identity and exactly-one-owner decoding have one shared native
controls owner. Export receipt semantics from 23d remain intact. Recording menu
callers continue to supply recording targets directly; no compatibility forwarding
entry point or automatic project construction is retained.

## Preservation

A changed current revision never replaces a pinned preview. Liveness reads use
the selected owner namespace. Renewal preserves token and bytes, never revives an
expired or closed generation, and close/replacement releases the old delivery.
Late ready responses release their delivery without presenting it. Malformed or
mismatched metadata fails visibly and releases any independently decoded lease.
Queued/processing, failed dependency and explicit retry behavior remain truthful.
The presenter forwards close/retry/playback-failure callbacks; it does not decide
service readiness, retry ownership or lease lifetime.

## Verification boundary

Direct isolated Swift checks compile the real controller and concrete presenter,
but run only a scripted Call, presentation sink and clock. The default clock stays
real time. Retained historical project processing/ready payloads remain unchanged;
a frozen clock before their saved expiry verifies their interpretation only.
No historical token is sent to a real service and no retained cache path is opened.
Clock advancement and controlled replies exercise renewal, expiry, revocation,
late responses and owner/revision mismatch without wall-clock waits or media work.

The two focused export-controller checks and complete pure-controls groups protect
the shared target change. Existing actual AVPlayer/service tests remain their own
preservation owners; this pass compiles their production presentation boundary but
does not rerun playback, rendering or installed acceptance. No visual aesthetics,
listening, device, model, capture or installed-switch claim is made.
