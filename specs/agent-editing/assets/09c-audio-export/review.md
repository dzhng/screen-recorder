# Audio export closeout review

Shape: clean. One public export endpoint and durable publication lifecycle remain
in charge. WAV reuses the existing project PCM recipe/cache. AAC is a rendition
inside that audio owner, dependent on the same PCM job. There is no parallel PCM
engine, export queue, cache, table, model recipe, hardware workflow or codec
package. The native sink shares timestamped PCM lowering with the existing movie
sink; whole-file conversion shares the bounded conversion owner. The retained
private `preview` column stores the common cache/byte descriptor for both media
kinds; it does not select the video renderer. Catalog format changes follow the
existing fresh-library refusal policy.

Diff: clean after resolving two real findings. The native presented-track guard
must distinguish content from AAC packet capacity; both exact candidates and the
failed public reply are retained. The service receipt parser must retain those
native frame fields, rather than discard them and make the job result ambiguous.
The final public journey proves the corrected fields and held-completion fence.
Readonly borrowed descriptors, source-version checks, abort checks around cache
publication, frozen PCM/encoding identities and existing export publication guards
preserve ownership. Protocol requests stay strict; native receipt responses remain
tolerant of additive fields. Existing video/package defaults and movie mux remain
covered separately. The suite's stale camera refusal expectation was updated to
the actual supported schema; no device or capture is exercised.

Docs: clean. The leaf, durable contract, service rationale and consumer skill
identify audio as an explicit caller choice. They preserve zero editorial decisions
and distinguish export from inspection audio. The external-caller skill was read
blind by a weak reader: it selected audio capability discovery, a pinned project
export, the WAV default, truthful unsupported-codec refusal and exact replay,
without proposing a personal edit or removing video. Root README/spec-handoff
integration belongs to the parent lane. The local link chain was checked.

Verification is bounded to real behavior. Exact WAV samples have an independent
fixture oracle; AAC uses actual native encode and external decode. Lifecycle checks
consume complete public CLI/MCP replies. The catalog-kind mutant fails at admission
and the corrected source passes. Existing owner tests preserve full/ranged audio,
prepared-audio, service and export behavior. One prepared-audio conditional test
remains skipped; this report does not count it as passing. The macOS consumer is
compiled/linked headlessly against actual audio receipts, without opening a panel.
No configured CLI-review retry, Claude call, UI, playback, recording, installed
switch or performance measurement is included in this isolated review.
