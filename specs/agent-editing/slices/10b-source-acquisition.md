# 10b — Source acquisition and selected-stream transcripts

Status: verified. Public acquisition, selected-stream transcription, source paging/search/retry and differing-mask media gates pass; the final historical check advances the project head before restart. Dependencies: [02](./02-assets.md), [04](./04-projects.md), [05](./05-compiler.md), [09](./09-first-preview.md), [10a](./10a-source-range-projection.md).

## Contract

An agent can import an audio stream, request its source transcript through CLI/MCP
and read/search the pinned result without inventing a recording or narration role.
Explicitly adopted capture evidence survives deletion of its donor. The existing
ASR recipe and known word-timing limitations remain unchanged.

## Seam and ownership

Generalize the existing source-evidence and transcript owners, their ingestion and
native planners. The shared catalog, AssetStore, JobQueue, SpeechModels, source
decoder, PCM conversion and raw transcript ingestion remain sole owners. Recording
bindings are the actual temporary development domain, removed at slice 23; asset
processing never fabricates recording rows or role labels.

An immutable acquisition context is separate from byte identity. It binds admitted
asset/stream IDs to normalized support and retains raw capture journal provenance,
clock offsets, pauses, acquisition/integrity and geometry facts. Validate and copy
its source evidence before publication; it cannot depend on a donor directory or
project remaining present. Reuse existing reference/lifetime machinery, generalized
where needed, rather than a parallel dependency ledger. Earlier unshipped catalog
shapes are refused, never migrated or reset.

A media occurrence may explicitly reference `acquisitionId`. Omission always means
physical file support, even if capture origins exist. A selected context must bind
the same asset/stream. Resolve context dependencies when retaining the revision;
compiler/preview/inspection resolve the same immutable metadata. The pure model
intersects physical support with selected acquisition support before its existing
source-to-project mapping and ancestor intersection. Do not attach one context mask
to the shared native asset decoder: two occurrences may select different contexts.
Pure input metadata is a collection of `{id, bindings: [{assetId, streamId,
available}]}` contexts, supplied alongside assets. Each binding's availability is
already normalized into the asset clock. Carry the same collection through reducer
revalidation; do not persist editable interval copies on clips.

Split/trim/move/copy preserve the source binding. Replacing media selects a complete
new binding: the replacement's omitted acquisition ID means physical support, while
processing preservation retains its existing independent contract. Unknown or
mismatched explicit contexts fail atomically; no first/latest-origin fallback.

## Work and review surface

Use flat exclusive source selectors `{assetId, streamId, acquisitionId?}` alongside
the existing temporary recording/package branches. Stream selection is explicit.
Add bounded `acquisition.import` for an explicitly supplied captured-source directory
and `acquisition.get` for immutable metadata; do not scan old libraries or import
edit history. New capture finalization can later use the same admission owner.
Ordinary `asset.import` stays a one-file import with physical support.

Source `transcript.get/search/retry` reuse the shared registry and retained source
readers. Existing processing/model readiness remains explicit; inspection cannot
download a model. Transcript identity includes selected asset/stream, acquisition
context/support, model and transcript-policy pins. Capture segmentation is an input
to inference, never merely an overlay after transcription. Keep normalized source
clock and original engine/raw provenance distinct.

The native `speech.transcribe` track becomes a role-free selection containing
`source`, optional `streamId`, `sourceOffsetUs` and `available`. Asset processing
always supplies a stream ID. The existing recording planner may omit it only for a
unique-audio-stream file; native rejects ambiguous selection instead of choosing
its first track. Update the real recording request writers together with the wire;
there is no old/new request union or ignored role field. Ingestion still preserves
its actual recording-domain metadata until that owner's asset generalization.

Native transcription uses existing stream selection, origin conversion, PCM
conversion and token merging. Preserve interval
isolation, channel treatment, too-short segments and current supported formats;
changing ASR/chunking/alignment quality belongs to 12/12b.

Create the public fixture:

```sh
node packages/test-harness/editing/source-evidence.mjs --fixture selected-streams
```

## Acceptance

Actual native acquisition through CLI/MCP must select distinguishable speech from
two audio streams in one container, including nonzero origin, physical empty edits
and an acquisition mask narrower than occupancy. Compare raw words/segments/model
provenance against the existing recording route with matched effective inputs;
retain the existing real-narration timing failure as a quality limitation.

One project uses the same bytes with context A, context B and no context. A masks
an internal interval; B and physical-only retain it. Exact projection, compiled
availability/context and actual preview PCM must agree: a word spanning the hole
is partial only in A, and excluded A samples cannot influence its neighbors.
Undo, historical reads, replay, replacement and restart preserve these bindings.
Capture adoption followed by donor deletion retains raw evidence/hashes and masks.

Keep evidence/transcript/model/audio/native speech preservation gates green. Test
missing/preparing/failed/ready model states, no-download reads, cancellation/retry,
changed generations, request conflicts and interrupted adoption cleanup. Raw
metadata fixtures prove semantics; real native inference proves production wiring.
Neither constitutes improved ASR timing or listening acceptance.

## Failure boundary and discretion

If source ownership is too broad for one commit, land reviewed native selection,
context/model binding and core acquisition passes under this slice, retaining this
single public acceptance target. Do not close it at a storage-only checkpoint.

Delegated: internal file layout, shared reference-table representation and bounded
admission mechanics within the existing owners. Record new limits and keep their
release resolution in 24. Identity, omission/replacement semantics and one-owner
requirements above are fixed. Update Status and the README pickup with evidence.

## Integrated evidence

[Composition binding](../assets/10b-source-acquisition/composition.md) and
[native masked video](../assets/10b-source-acquisition/native-video/README.md)
verify independent per-occurrence support. [Native selected-stream preservation](../assets/10b-native-selection/README.md)
retains exact raw/PCM parity and the existing real-narration timing failure; this
slice does not improve ASR timing or establish listening quality.

[Durable adoption integration](../assets/10b-acquisition-integration/README.md) and
[actual CLI/MCP adoption](../assets/10b-source-acquisition/README.md) prove copied
journal/media survival, cancel/crash/retry cleanup, conflict/replay, replacement,
undo, historical preview and pinned export. Their broader-run deadline failures
and controlled passing reruns remain recorded; no performance threshold changed.

[Transcript storage](../assets/10b-transcript-ownership/README.md),
[asset preparation](../assets/10b-asset-transcript/README.md),
[source reads](../assets/10b-source-transcript-read/README.md) and
[public routing](../assets/10b-source-routing/README.md) share the existing owners.
[Bounded seeking](../assets/10b-transcript-seek/README.md) aligns portable admission
with ingestion so late windows use one predecessor and indexed forward reads.

The [actual native source journey](../assets/10b-source-transcript-journey/README.md)
verifies both distinguishable audio streams, nonzero origin, physical empty edits,
full raw/public word parity, missing-model no-download behavior, cancellation,
retry, source cursor boundaries and restart. Synthetic A/B acquisition journals
around identical speech bytes prove context identity, donor deletion and masks;
they make no physical-capture claim. Public project authoring/preview and decoded
PCM agree with exact compiled support and pure word partiality. The same frozen
native executor's poison checks separately prove excluded samples cannot leak
through resampling context; the evidence labels that direct-native boundary.

The [final historical run](../assets/10b-source-transcript-journey/history/report.json)
advances the public project head, restarts, confirms that newer head persisted,
and reads the exact older document and byte-identical preview. Root integration
matches all 15 recorded production/harness runtime hashes and independently checks
the retained movie digest. [Fresh product-skill use](../assets/10b-transcript-skill/README.md)
verifies imported speech inspection through the real CLI without implementation
knowledge, with setup intervention and validator limitations explicitly recorded.

Remaining enclosing-plan work is unchanged: public project occurrence queries
belong to 10c, full PCM delivery to 11a, ASR cleanup/timing to 12/12b, and listening
quality to its named gates. Acquisition retains a 100,000-interval per-stream cap
and the native 256 MiB journal cap; slice 24 must validate preparation/storage cost
and release limits. No installed-app cutover follows from this slice.
