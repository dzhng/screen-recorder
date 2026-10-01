# 24z12 — Admit complete MCP media messages before consumption

Status: integrated; the [merged evidence](../assets/24z12-mcp-media-admission/merged.json)
passes all 140 affected consumer checks, including prior discovery coverage.
The scoped [producer packet](../assets/24z12-mcp-media-admission/README.md) remains unchanged.
Verification uses owned socket responses and the default SDK.
Final scale and full release acceptance remain open.

## Contract

Before any automatic artifact read, renewal or close, the MCP adapter determines
whether the complete reply can carry its intended media within the existing
transport bounds. Count the complete JSON-RPC wrapper, actual request identity,
both metadata representations, string escaping, added content indices and every
attachment. An eight-mebibyte PNG produces 11,184,812 base64 payload bytes before
framing; eight one-mebibyte PNGs produce 11,184,832. Both meet current raw image caps.
Default SDK clients must not lose such replies after their leases are consumed.

If the complete intended reply does not fit, return the original complete operation
response as JSON text and structured content, preserving all fields, item errors,
tokens, byte counts and expiries. Do not add content indices or consume any item.
Deferral applies to the entire batch before its first consumption. Callers use the
existing artifact operations; there is no new endpoint or adapter token store.
Result descriptors from 24z11 still return before media admission or consumption.

For an admitted reply, preserve current item order, duplicates, independent failure
handling, content-index meaning, valid UTF-8 JSON checks, renewal and cleanup.
Indices name actual MCP content blocks, including the initial metadata text, rather
than input item positions. Existing raw-cap refusals and large-audio metadata-only
behavior remain owned by the current artifact consumer; budget their actual
outcomes instead of inventing new raw limits or bypassing their policies.

## Ownership and accounting

One adapter framing owner constructs and budgets its reply. Reuse the existing
artifact and batch validators through a read-only description seam; do not copy
their schemas or introduce another media interpretation. The bound derives from
the existing protocol response/control frame owners and actual SDK serialization.
No SDK/service limit increases, truncation, post-consumption fallback, persistent
cache or automatic mutation replay are allowed.

Base64 contributes `4 * ceil(bytes / 3)`. Valid JSON evidence contributes at most
twice its UTF-8 bytes when quoted. Measure metadata and wrapper syntax exactly;
predicted per-item content-index additions and owned late failures must also fit.
The installed SDK exposes `extra.requestId` and serializes its actual response as
JSON plus a newline. Keep actual request identity in this calculation. This pass
targets default SDK clients and owned producer replies, not a new arbitrary-input
security or foreign-error admission subsystem.

Resolve the service once after validating a called operation, then retain that
explicit socket selection and cancellation signal for dispatch and automatic
artifact consumption. This removes repeated discovery, readiness probes and app
launch attempts between items. It does not identify a service instance: a restart
at the same socket still refuses expired tokens normally. Later explicit artifact
operations remain separate calls. CLI file delivery retains its existing semantics.

Trace actual owned media read/renew failures and client connection diagnostics.
Budget their real fixed messages and input-derived socket costs; pin any platform
formatting relied on. Do not mirror an error registry, use an unexplained reserve
or justify a bound with arbitrary scripted multi-megabyte foreign failures.

The [MCP framing owner](../../../apps/cli/src/mcp-result.ts) constructs both the
predicted envelope and admitted content. The artifact consumer owns readiness,
buffer policies and fresh read-time validation. Metadata is measured in both of
its serialized forms; byte estimates saturate at the protocol bound rather than
allocating a placeholder payload. Conservative JSON quoting can defer an otherwise
legal raw buffer: callers retain complete evidence and ordinary live leases.

Owned late failures include the listener's capacity refusal and pipe connection
diagnostics. The packet pins the Node formatter, finite system-error names,
selected-path cost and current read/renew/transport closure. This is a scoped
owned-producer/default-client bound; arbitrary foreign errors and huge request
identities are outside its contract.

## Verification and discretion

Use deterministic byte fixtures and the actual adapter with an unconfigured SDK.
Reproduce the single and aggregate base64 overflow, then prove original complete
metadata equality and zero reads/renewals/closes on deferral. Tokens must remain
usable for normal artifact reads. Test an admitted small reply and batch with
duplicate references, a middle item failure and later successful items; compare
every media byte and all metadata/index values. Include JSON escaping, exact wire
size, existing raw-cap behavior, renewal/cleanup and nested result/media lifetimes.
An actual owned connection failure after admission must remain serializable and
preserve current item isolation. Prove automatic consumption no longer rediscovers
the service; do not claim service-instance pinning.

Preserve current deadlines and all affected artifact/media tests. No new capture,
native build, inference, listening, large project or accepted media cohort is needed.
Run local review and choices audit, pin complete source/emitted/runtime identities
and retain the original overflow/failure evidence. Root owns shared handoff updates.
Internal names, module placement, the validator-description seam and conservative
numeric accounting are delegated, provided they meet the ownership and complete
wire contract above. Any broader behavior change needs a separate reslice.
