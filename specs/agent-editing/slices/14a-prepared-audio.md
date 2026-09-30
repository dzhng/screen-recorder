# 14a — Durable prepared audio shared by retiming and processors

Status: verified for the shared durable preparation/publication and consumer contract. [Core lifecycle](../assets/14a-prepared-audio/README.md), [public CLI/MCP preparation](../assets/14a-public-preparation/README.md), [unit-rate portability](../assets/14a-prepared-portable/README.md), [learned portability](../assets/14a-learned-portable/README.md), [typed learned consumers](15a2-denoise-prepared-consumers.md) and [successful long output](24f-successful-learned-scale.md) supply its named gates. Accepted stretch binding belongs to14; processor quality belongs to15a. Neither is inferred from this storage checkpoint. Dependencies: 02a, 04, 05, 08 and 22a.
This storage/publication prerequisite does not depend on accepting RNNoise or
stretch quality; actual DSP adoption remains gated by12c/13a.

## Contract and owners

An explicitly prepared audio target belongs to an immutable project revision.
Its exact lossless PCM, ordered input recipe and provenance survive cancellation,
restart and retained history. A late reader reads the requested samples from that
result without decoding or replaying a prefix. Preparing audio never modifies the
composition document or advances its current revision.

AssetStore owns immutable file bytes; JobQueue owns admission, attempts, generation
and ready publication; ResourceReferences owns revision and upstream retention.
Core's prepared-audio owner composes these existing authorities. No extra ready
registry, blob store, queue, polling loop or mutable processed copy.

## First checkpoint: fenced publication and bounded reads

Prepare the full explicit output domain through the current compiled audio/native
renderer, using only already-ready unit-rate/gain behavior. The request pins the
revision and the compiler's entire execution manifest: exact selected support,
sample range/rendition, routing/ordered processing, windows/curves and implementation
identities. No caller-provided filter string or inferred model/channel policy.
The renderer uses decode/select, resample/map, accepted retime, then ordered stacks;
unresolved requirements keep failing before job admission. At this historical
unit-rate/gain checkpoint RNNoise and stretch were unavailable; current learned
readiness is owned by 15a2, not inferred from these storage tests. Preview subranges do not redefine preparation origin.

Retain current float32 WAV bytes in AssetStore and verify the exact receipt with
the shared WAV validator. File limits derive from the existing RIFF writer and
asset budgets, with explicit refusal before oversized preparation. Recipe and file
identities are separate: the recipe describes work; the asset SHA-256 names exact
bytes. Local filesystem identities authorize reads; paths are replaceable locators.

Extend queue completion narrowly to carry staged database publication plus
cleanup. Queue settlement checks the current running attempt and owner first,
then runs a synchronous database-only publication callback inside the same catalog
transaction as the artifact result. That callback publishes staged asset metadata
and immutable revision/resource references. No file I/O, asynchronous work or DSP
runs inside it. A thrown callback rolls back all metadata and fails the attempt.
Canceled/stale completions run cleanup but never publish. Cleanup settles before
attempt ownership ends; existing startup asset recovery removes staging/orphan
files and interrupted work requires explicit retry.

Each publication is linked to its exact revision outside composition JSON. Its
queue receipt names the output asset and upstream dependencies, all retained by
that revision through the shared reference graph. Identical PCM can share one
asset without merging different projects’ recipe dependencies onto that asset. Old revisions keep their own publication. A changed recipe
requires a different job identity; no latest-result lookup or cross-revision reuse
is assumed. Pure splits may reprepare identical PCM until reuse is separately
proven. Source evidence stays raw.

Verification uses real native unit-rate PCM and existing compiler edits. Assert
exact delivered samples, bounded late reads, unchanged revision JSON, historical
retention after newer edits, and refusal of unresolved retiming. Deterministic
lifecycle tests cover cancellation before publication, an old completion after
retry, owner deletion, database publication rollback, restart with staged bytes,
missing/replaced files and concurrent revision identities. Deliberately fail the
publication oracle before accepting it. No listening or DSP quality claim follows.

## Next checkpoint: production consumers

The existing package union now carries prepared publications and their output and
upstream dependencies. Staged import validates copied PCM and the original recipe,
then publishes its new local file identity, adopted revision/resource references
and queue receipt atomically. Public relocation preserves current and historical
unit-rate/gain results after donor removal; retained reads need no renderer or
model. The [portable evidence](../assets/14a-prepared-portable/README.md) separates
these owner-level checks from the separately verified public preparation and
the subsequent linked learned integration.

The public preparation entry point is `audio.prepare` with required `projectId`
and `revisionId`. It prepares the full processed output domain at the existing
48kHz stereo float-WAV rendition. Explicit revision selection makes repeat calls
address the same recipe without changing the composition or silently following a
new head. No additional request-intent registry is needed: the queue already keys
work by pinned revision and complete compiled recipe.

Return the pinned selection, ordinary readiness/job ID and published prepared
receipt. Use existing `job.get/retry/cancel` for attempts; repeated preparation must
not restart failed or canceled work. The prepared result is an ordinary retained
asset: `asset.get` discovers its stream, and existing `audio.get`, waveform and
spectrogram selectors inspect it without a new delivery owner. Historical assets
remain readable after newer edits and relocation. An unresolved processor/retime
requirement refuses before admission; this storage contract does not itself establish processor readiness or introduce
caller-provided recipes.

Verify actual CLI/MCP preparation, exact native unit-rate/gain PCM, repeat identity,
unchanged revision/head, inspection through the prepared asset, historical/restart
reads, and explicit failure/retry/cancel with no automatic restart. Existing owner
and package gates remain authoritative for fencing, bounded late reads and
portable receipt publication. Agent-visible schemas/help/skill must describe the
supported output domain and limits, rather than implying arbitrary target/DSP
support from the command name.

Slices 14 and 15a own binding accepted typed recipes and native executors to this owner,
with production-entry parity against the frozen reproductions. Clip-level state
domains, denoise transitions, stereo behavior, post-retime/combined speech,
protected phonemes and listening remain their acceptance gates. A lifecycle pass
cannot advertise those processors as ready.

## Review surface and pickup

The [retained evidence](../assets/14a-prepared-audio/README.md) records actual native
unit-rate, split and constant-gain output, bounded reads after restart, lifecycle
tests and the broad-suite verification limits. The public command and ordinary retained-asset inspection now exercise the
production native renderer through the existing owner. Package export now retains supported prepared receipts through the existing owner.
The linked learned runtime and portable retained results are verified in their
scoped leaves. Successful long-output scaling is verified in [24f](24f-successful-learned-scale.md).
Accepted stretch binding and the remaining processor/listening combinations stay
with14/15a. They do not keep this verified storage/publication owner open.
