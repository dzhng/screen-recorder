# 23j choices

## Sound — medium confidence

**Compare authored source mapping, without pretending separate tracks are spans.**
When the old command removes a playback interval, its new span list names retained
parts of one recording clock. The new command removes that same interval from
explicit video/audio tracks and collapses their named timeline together. The test
checks every retained video interval plus narration rows shifted by the saved
48,675µs origin. It does not pretend the old span object contains track metadata
or infer acquired silence from a container endpoint. The plan required exact
retained mapping but did not prescribe this oracle representation. This keeps the
state proof independent of the composition implementation and limits what later
release work can claim from it.

**Use operation-specific invalid/no-op requests to compare the shared guarantees.**
The old API cannot accept an arbitrary multi-operation project batch. Its cut with
one valid and one invalid range must leave state unchanged; the new batch first
performs a valid removal and then references a foreign processing-step identity.
Both complete public states must remain unchanged. Likewise, full old trim and
unchanged new canvas width are successful no-ops whose receipts replay without
history growth. The plan left the equivalent requests unspecified. This tests the
promised transaction/replay behavior without inventing an API alias or requiring
identical validation codes. It does not claim old support for new batch operations.

## Sound — high confidence

**Reuse the genuine current catalog instead of upgrading the older fixture.**
The old project catalog cannot describe the current persisted format. Changing its
version would manufacture missing facts. An existing format22 recipient contains
the exact original hash-named media and stream metadata, so the test copies that
catalog and all canonical assets, then creates its own project publicly. Models
and derived outputs are omitted because this case executes no media or inference.
Root authorized this preference; the remaining discretion was copying all canonical
files so unrelated asset metadata did not become a partial-file fixture. This costs
bounded fixture I/O but introduces no production migration or model requirement.

**Withhold a real acknowledgement at the socket boundary.**
A small owned socket proxy receives the real service's committed response, records
it, and closes the client connection without forwarding it. The CLI therefore
reports connection loss. After both services restart, ordinary public replay must
return the original full receipt. The plan required lost-response/restart proof
but did not specify fault placement. This tests actual persistence through actual
consumer paths while leaving the edit dispatcher and transaction owner untouched.

**Fence native work before forwarding, and mutate only a separate scratch producer.**
Copied services need startup capability metadata and workspace recovery. The gate
logs each request before forwarding only those operations to the frozen worker;
rendering/inference/capture operations cannot execute. For falsification, a separate
bundle skips the saved-request replay branch and fails with STALE_REVISION after
restart. The accepted bundle and repository production sources are unchanged.
The plan required bounded work and meaningful negative proof but left their
mechanisms unspecified. Future readers can reproduce the control without replacing
the accepted worker, altering product policy or widening test permissions.
