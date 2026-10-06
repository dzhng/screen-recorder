# Published-work checkpoint

The [slice](../../slices/03-published-work-contract.md) freezes one public
publication envelope. The queue still owns execution; adapters expose domain
payloads without serialized worker results or execution recipes. Domain read
pages and committed exports retain their own contracts.

[Import replies](publication-import.json) retain the actual socket acknowledgement,
running replay and ready output. A sparse 64 MiB source was acknowledged in the
recorded time while its external probe was held; the measurement is scoped to
this local run, not a universal latency guarantee. The fixture controls native
probing and does not establish decoding of those authored source bytes.
[Malformed-worker replies](publication-malformed.json) preserve failed work in an
ok transport envelope without a partial publication.
[CLI/MCP replies](publication-cli-mcp.json) retain pending, failed and canceled
production service work across both actual adapters. Their [consumer check](../../../../apps/cli/src/published-work.test.ts)
uses an external probe boundary rather than a fake operation server.

The existing public contract checks retain source-job replay/cancellation/restart,
transcript pages, refused admission and lost-response mutation recovery alongside
these replies. Their case definitions remain in the [owning tests](../../../../apps/service/src/project-contracts.test.ts).
The [queue inspection checks](../../../../packages/core/src/jobs.test.ts) separately
prove an earlier retained generation survives a newer running/canceled attempt,
and disappears when its owner becomes unavailable.

## Proof and limits

Focused checks passed for the publication/public-contract/media-delivery boundary,
current core job and capture-acquisition behavior, affected app/service/CLI caller
fixtures, distributed consumer helpers and the pure native preview controller.
The larger affected-adapter run found one stale selected-audio fixture expectation;
its isolated check passed after correction. Type checks passed for protocol, core,
service and CLI. All changed JavaScript consumers parsed. Formatting and diff
checks passed; lint reported existing warnings in touched files, with no errors.

The public-envelope regression was observed red before changing job inspection:
the import acknowledgement lacked `published`. It passed after the producer
cutover. Complete large-response lease checks reused their retained production
receipt; no media rendering, model inference, physical capture or native playback
was repeated for this JSON contract change.

The speaker package-export check could not run through its native owner because
this worktree has no `helpers/mac/.build/debug/yap-native`; its worker reported
`MEDIA_WORKER_UNAVAILABLE`/`ENOENT`. This is a pending native package check for the
feature's final run, not a passing package-export claim. Real-media acceptance
remains slice 34.

## Review and choices

[Initial independent review](initial-review.md) found remaining current job/player
fixtures and incorrectly changed local/historical operand readers. All findings
were confirmed and corrected. The [second scoped review](corrections-review.md)
completed clean after those corrections. Fixed archives remain byte-exact. Current scripted
controller inputs use one authored envelope; the two historical controller fixtures
project their one known archived payload at fixture construction, without an
old/new production reader. Historical comparators read only their known original
operand. Internal native/queue result receipts retain their original contracts.

The frozen shape and synchronous-read scope were approved before adapter changes.
No schema migration, version negotiation, second supervisor or new storage owner
was introduced. Internal helper composition and fixture naming were delegated
implementation choices. The parent spec owns the accumulated choices ledger.
