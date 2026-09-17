# 14c3c1 — Public package admission and retained index reads

Status: implemented, verified and reviewed. Depends on the retained registry and shared index readers.
Arbitrary frame/audio inspection is explicitly deferred to [14c3c2](14c3c2-package-frame-audio.md); this pass
neither completes package inspection nor adds a separate package inspection API.

## Public boundary

`package.open({path})` returns the existing asynchronous admission receipt.
`package.status({admissionId})` polls that receipt; only ready admissions expose a
process-local `packageHandle`. `package.close({admissionId})` cancels an opening
admission or closes a ready one, joining drain/cleanup and preserving retryable
cleanup ownership on failure. Status without an admission ID reports registry
readiness/accounting and bounded active admission receipts, so a lost open reply
can be discovered and closed; `package.open` explicitly retries blocked startup recovery
before admitting new work. There is no background recovery poller.

The existing `revision.get`, `revision.history`, `index.get`, `index.coverage`,
`index.frame` and `index.frames` accept exactly one target: `recordingId` or
`packageHandle`. Mixed or missing targets fail validation, including unrecognized
latest shorthand. Library mutations, retry and arbitrary frame/audio requests stay
library-only. The shared CLI/MCP schema registry advertises only these capabilities.

A package defaults to its exported pinned revision, even when admission preserved
newer history. `revision.get` may read any included history entry. The retained
index belongs only to the exported revision; another revision returns an explicit
unavailable-artifact error, never a newly generated index. History pagination is
bounded and tied to the package's immutable history cutoff. Continuations carry
the issued target and pinned revision/generation, so same-content opens cannot
exchange them. Embedded recording IDs remain provenance, not handle authority.

## One read and lifetime owner

Factor index result paging/frame/coverage assembly out of IndexProcessing into
one reader over ScreenshotIndexReader. Library request/publication remains with
IndexProcessing. Package resolution supplies the admitted FileScreenshotIndex and
manifest identity, retaining its parsed history/reader for the context lifetime; no second selection/materialization engine or library rows.
The existing FileAccess checks continue to validate normalized rows lazily.
Index images use the existing typed delivery owner and CLI/MCP byte transport.

The service owns a private package root under its runtime directory, admitted with
no-follow directory access and a retained descriptor. Recovery starts after service
composition and blocks package admission only. Shutdown closes the registry and
queue, then its parent descriptor and startup authority. Close revokes package
deliveries after draining work; library deletion cannot revoke a same-ID package.
Restart never restores old admission IDs, package handles or image tokens.

## Verification

Pin strict selector rejection, exported-old-revision default, bounded history and
index continuation isolation, unavailable historical index and lazy malformed-page
errors. Use a generated real package through the actual service and CLI/MCP SDK:
open/poll, compare selected PNG bytes to its retained inventory, hold image tokens,
open the same ZIP twice, delete a same-ID library recording, close one package,
then restart and reject old handles/tokens. No user media/devices or invented ASR.
Actual byte transport is not a claim of model-level understanding. Existing native
registry recovery/drain and retained context parity remain prerequisite evidence.

[Verification evidence](../assets/portable-inspection/public-package-index.md) pins
the public transport/lifetime claims and their explicit limits.
