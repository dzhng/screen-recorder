# Proposed bounded repair for discontinuous captured PCM

Proposal only; no timing behavior changes are implemented. Causal reproduction is
committed as `cf37d8e8`. The actual CaptureWriter accepts all supplied buffers,
retains the right sample values, but its PCM MOV recipe packs discontinuous input.
A journal support mask cannot undo that physical shift.

## Recommended representation

Keep one source clock and the existing immutable source/asset ownership. Represent
audio as exact contiguous PCM runs with explicit source placement, then materialize
those runs into a source-time MOV containing occupied segments separated by empty
edits. Reuse the existing SourceSegment and MediaRecovery interpretation. Do not
write zeros for the hole, infer silence, or shift later content to close it.

Reuse the already banked slice08 physical-segment mechanism in
`helpers/mac/Tests/SourceAudio/main.swift` (`movie`, AVMutableComposition insertTimeRange
plus AVAssetExportPresetPassthrough). Do not re-research whether ordinary empty edits
can exist. The new question is whether the frozen actual-writer packed payload,
with probe-provided EXACT accepted frame-run addresses, can be materialized and
published correctly. Build two runs around the omitted buffer, then verify occupied
segments, exact decoded samples, seeks wholly after the hole and interrupted
publication. A reported endpoint alone does not establish placement. The probe's
exact mapping must not be misrepresented as information present in legacy journals.

## Exact append record and phase choice

Extend the existing capture journal with a versioned audio-layout capability and
an audio append/run record. Do not infer PCM frame count from rounded startUs/endUs.
For every successfully accepted append, record:

- role and physical payload file identity/generation;
- cumulative physical first PCM frame (Int64) and exact numSamples (Int64), per channel;
- sample-rate representation and channel/format identity;
- original raw PTS value/timescale/epoch and the existing mapped sourceStartUs;
- the existing clock's removed-time offset/epoch, so a pause boundary cannot be
  mistaken for continuity, plus an explicit sequence linking the record to its take.

These are physical media-frame coordinates, like SourceSegment.media, not another
project/source clock. Contiguous runs are coalesced only when physical frames are
adjacent, format is identical, raw PTS advances by exactly the preceding frames /
rate, and the existing pause mapping has not changed. No epsilon joins, fitted drift
or rounded-frame reconstruction. Any unproven discontinuity opens a new run.

Keep each run's first source anchor at the current CaptureClock's declared integer
microsecond value. Its duration is exact frameCount / sampleRate; preserve that
rational endpoint through container construction. This matches the existing PCM
writer's within-run sample phase rather than repeatedly quantizing every buffer.
Retain raw timing alongside it so the sub-microsecond difference from subsequent
rounded callbacks is inspectable. Only project a rational bound to microseconds
at the existing report boundary; never use that projection to choose/count payload
frames or merge runs. This phase rule is an explicit behavior choice for approval.

Initially require a format rate that the container can represent exactly as a
supported CMTime scale (the measured 48 kHz and ordinary integral device rates do).
Do not silently round an unsupported fractional rate. Either demonstrate its exact
rational representation in the experiment or return a typed format refusal.

For new-layout packed files only, stamp writer input on the exact cumulative PCM
frame/rate media coordinate starting at zero. Its filename/header explicitly says
packed media; it is never exposed as source time. Source anchors stay in the run
mapping. This removes ambiguity about a packed file's leading edit without changing
the host/source clock or altering any legacy file.

Append to AVAssetWriter first; record its exact accepted mapping immediately after
append succeeds. A journal write failure stops the take and prevents canonical
publication. Crash recovery may discard an unmapped payload suffix, but must never
invent a mapping for it. The journal record proves acceptance, not disk commitment.

## Normal finish

1. Stop callbacks using the existing generation/queue owner and finalize the packed
   PCM payload. Keep its bytes immutable thereafter. Give this physical file an
   explicit packed role filename; it must not be adopted as a source-time asset.
2. Stream the journal and independently decode/count the actual PCM file. Reconcile
   exact frames and format before choosing any run bounds. Intersect accepted
   mappings with proven physical payload frames, not a declared file duration.
3. Materialize the validated runs into a temporary canonical source-time MOV using
   existing container segment semantics. Keep gaps as empty edits. Validate segment
   starts/ends, exact sample identities and channel/rate metadata independently.
4. Publish the canonical role file atomically through the existing take-finalization
   owner. Record a durable layout receipt naming the payload identity, journal
   through-sequence, represented frame count and canonical hash. Only this canonical
   file may enter the existing asset/adoption path.

Raw packed bytes and the original journal remain retained source evidence until
existing source retention/deletion owns their disposal. They are not overwritten
or treated as a second blob store. Inventory/package/deletion consumers must account
for both files; a new filename cannot silently escape existing accounting.

## Crash before, during or after materialization

Recovery first discovers the layout capability in the take's header. For the new
layout, it must not fall back to treating packed PCM timestamps as source time.
Use the same run reconciler/materializer as normal finish before claiming canonical
source support. Other independently valid sources can remain recoverable while
this audio is explicitly pending/unavailable.

Determine the physical committed prefix by decoding real PCM samples and checking
sample/frame positions. Do not use AVAssetWriter's accepted count, nominal duration
or a final packet's claimed endpoint as proof that its payload reached disk. Clip
the last mapped run by exact recovered frames; ignore/unavailable any unmapped or
undecodable suffix. If recovery has a hole inside the physical payload, stop at the
last proven contiguous prefix unless a trustworthy later physical position exists;
do not concatenate decoder output across a lost packet and then call its index true.

If a crash leaves a temporary canonical file, discard/retry that attempt from
retained immutable payload + valid journal prefix. If rename succeeded before its
layout receipt became durable, revalidate the canonical file against the same run
map and identity before recording completion. Do not mutate the old raw evidence
to make a partially published result look complete. Existing late-callback/finalizer
generation checks and interrupted-result semantics remain in force.

## Bounded work and format changes

Writer memory stays one active run, exact counters and the current sample buffer.
Journal records stream to disk. Recovery streams records and samples; it never
loads a per-packet array. Completed run descriptors can be spooled/indexed under
the existing attempt, with bounded pages and resumable work. Reuse the existing
100000-interval acquisition upper boundary as a hard outer ceiling, not proof that
AVMutableComposition can safely hold that many edits; its lower working budget
must be measured and explicit.

AVMutableComposition may itself retain all segment metadata. Before production,
measure/preflight that cost against an explicit existing attempt/work budget. The
first production scope must refuse materialization beyond the supported budget,
retaining payload and journal, rather than silently drop runs or allocate without
bound. Do not add a second generic job system to get around this limitation. The
small API experiment establishes correctness; the bounded-run policy is a separate
required check before enabling unlimited recording lengths.

A rate/channel-layout/output-format change terminates the current audio writer
truthfully with a typed format-change result in the initial fix. Do not append a
new format to the same physical-frame counter or silently convert clocks. Preserve
its valid prefix and source files. Supporting multiple format epochs/files later
requires an explicit existing acquisition/asset mapping contract; it is not assumed
by this repair. Input formats that convert to the exact same established PCM output
still need a tested, explicit policy, not an equality guess.

## Existing journals and sources

Preserve old v1 journals and their source bytes exactly. New readers recognize the
new capability/record; old takes retain their recorded legacy layout.
Do not synthesize precise frame maps from old rounded audioSamples ranges. Old
continuous takes retain their existing behavior. For an old discontinuous take,
first determine whether physical container segments already preserve placement.
If they do, retain the existing path. If PCM is packed and exact addresses cannot
be established, do not mark later acquisition verified merely because a journal
header exists: expose only independently established support or refuse that role,
while retaining its original bytes. A legacy discontinuity cannot be claimed
repaired without independent exact payload-to-source evidence; never remap later
audio speculatively. Versioning belongs to the
one existing journal reader, not a parallel compatibility store.

Source-time consumers should continue to receive ordinary canonical assets with
existing occupied/empty segments. No editor clock, composition schema, transcript
clock or user-visible hidden offset is added. Old frozen evidence stays unchanged.

## Acceptance before a production behavior patch

- Continuous input is byte/sample identical and retains its initial offset.
- Known omitted middle buffer retains later marker values at their original source
  positions; an empty interval remains unavailable, not acquired silence.
- Real CaptureWriter pause-overlap omission, multiple gaps, fractional run endpoints,
  positive offset and supported channel/rate formats obey the same rule.
- Exact accepted counts distinguish append rejection, journal loss and writer-tail
  loss; crash points on both sides of publication never claim uncommitted payload.
- Recovery of a committed prefix agrees with normal finish on that prefix.
- Source/asset adoption, retention/package/deletion account for canonical plus raw
  dependencies without changing old sources or bypassing their existing owner.
- Existing capture/recovery tests and decoded public source consumers pass.

No live capture or permission change is needed for these experiments. The physical
camera/screen/microphone gate remains separate. Approval is requested for the exact
run-anchor/phase rule, explicit new journal layout, and bounded canonicalization
strategy before any production timing behavior changes.


## Reconciliation with the independent audit

Read `/tmp/screenrec-capture-gap-independent.md` only after this initial proposal
was written. It converges on canonical sparse MOV plus one shared materializer,
and rejects permanent per-reader mapping. Its additional constraints are adopted
above: reuse the already proven08 container mechanism; separate probe-known frame
addresses from inadequate legacy journal data; make old discontinuous support
honestly unverified; use the existing interval ceiling plus measured working bounds.
No production fix has started. The next proposed change is a storage/publication
proof over frozen bytes, not the full journal/capture repair.
