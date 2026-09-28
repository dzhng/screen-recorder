# 14a — Durable prepared audio shared by retiming and processors

Status: planned; first lifecycle checkpoint implementing. Dependencies: 02a, 04,
05, 08 and 22a. This storage/publication prerequisite does not depend on accepting
RNNoise or stretch quality; actual DSP adoption remains gated by 12c/13a.

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
unresolved requirements keep failing before job admission. RNNoise and stretch
remain unavailable. Preview subranges do not redefine preparation origin.

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

Each publication is linked to its exact revision outside composition JSON. It
retains the output asset and complete upstream resource closure through the shared
reference graph. Old revisions keep their own publication. A changed recipe
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

## Next checkpoint: portable closure and production consumers

Extend the existing project package resource union with the prepared publication
and its output/upstream dependencies. Staged import adopts asset bytes and the
queue's retained publication receipt atomically, preserving recipe/model identity
while changing local locators. Current and retained revisions must replay with
original paths and donor model cache removed. Package export must explicitly
refuse unsupported prepared resources until this checkpoint lands; it must never
silently omit their bytes. Coordinate the package adapter with slice 22.

Then 14 and 15a bind accepted typed recipes and native executors to this owner,
with production-entry parity against the frozen reproductions. Clip-level state
domains, denoise transitions, stereo behavior, post-retime/combined speech,
protected phonemes and listening remain their acceptance gates. A lifecycle pass
cannot advertise those processors as ready.

## Review surface and pickup

Focused core tests and a bounded native harness expose the receipt, recipe,
retained history links and exact excerpt bytes. Preserve evidence under the slice's
assets directory; update this status after each checkpoint. Full portability,
scale/deletion and public processor integration remain required before closure.
