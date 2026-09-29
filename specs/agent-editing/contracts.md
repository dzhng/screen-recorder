# Composition and command contracts

These are planned contracts, not currently available commands. The implementing
slices materialize them in the shared protocol. [README](README.md) owns status.

## Media identity and ownership

An **asset** is immutable admitted media with a byte hash and probed streams. A
**clip** is one occurrence of one stream in a project. Reusing media creates new
clip IDs; an asset ID alone can never target a specific use of a word or frame.

`AssetId` identifies immutable media bytes, `StreamId` a probed stream within
them, and `ClipId`, `TrackId`, `ProcessingGroupId`, `ProcessingStepId`, `SyncGroupId` are opaque identities.
Evidence identity additionally includes its processing generation and policy.
Origin is capture/import/generated provenance, not a restriction on use as audio
or video. Do not encode imported speech as a fake captured narration role.

Import snapshots local bytes into managed storage using a streamed copy/hash,
probes the owned copy, and publishes only after validation. Re-importing identical
bytes reuses the asset. A source file changing during admission either yields a
validated immutable snapshot or an explicit failure; workers never follow a
mutable external path after admission. Cross-project reuse acquires a durable
asset reference in the receiving project. It must survive deletion of the donor
project. A filesystem path is not a persistent asset identity.

All assets referenced by retained revisions remain reachable through undo.
Generation stores the actual bounded reference audio as an admitted asset plus
reference text and model/request provenance. No separate enrollment object is
required. Imported original bytes are retained even if decoding derivatives are
created. Rebuildable caches are not sources of truth; model-dependent published processing
results needed for playback/history are retained dependencies, per [processing](processing.md).

Probe metadata records a shared asset presentation origin and each stream's
offset from it. Normalize the earliest valid presentation time to asset time zero
while preserving inter-stream offsets and edit-list/decoder-delay evidence; never
independently zero every stream. For separately captured files, capture-clock
offsets live in source provenance and initial project placements. Missing leading
or trailing media remains a gap, not a duration silently stretched to match video.

## Project document

The final model has this shape; slices add capabilities as their execution paths
are verified. The protocol must reject unavailable operations explicitly rather
than accept documents that silently render without them.

```ts
type Range = { startUs: number; endUs: number }; // safe integers, half-open
type Fraction = { numerator: number; denominator: number }; // reduced safe integers, denominator > 0
type EditTime = number | Fraction; // whole microseconds as numbers; fractional denominator > 1
type SelectionRange = { startUs: EditTime; endUs: EditTime }; // exact stored half-open bounds
type Anchor =
  | { kind: "project"; range: SelectionRange }
  | { kind: "content"; clipId: string; sourceRange: SelectionRange }
  | { kind: "clip"; clipId: string; start: Fraction; end: Fraction };
type MediaClip = {
  id: string; assetId: string; streamId: string; trackId: string;
  source: { kind: "range"; range: SelectionRange } | { kind: "hold"; atUs: number };
  placement: Anchor;
  pitch?: "preserve" | "follow"; // audio; preserve by default
};
type Clip = MediaClip | {
  id: string; trackId: string;
  source: { kind: "silence" }; placement: Anchor;
};
type Curve = {
  keys: { at: number | Fraction; value: number;
    interpolation: "hold" | "linear" | { cubic: [number, number, number, number] } }[];
};
type Composition = {
  canvas: { width: number; height: number;
    fps: { numerator: number; denominator: number }; background: string };
  tracks: { id: string; kind: "video" | "audio"; order: number; parentId?: string }[];
  groups: { id: string; kind: "video" | "audio"; order: number; parentId?: string }[];
  clips: Clip[];
  syncGroups: { id: string; clipIds: string[] }[];
  processing: { target: ProcessingTarget; steps: ProcessingStep[] }[];
};
```

[Processing](processing.md) defines ProcessingTarget/ProcessingStep, the typed registry,
one get/set stack API, nested groups and fixed execution order. Variants include
audio gain, geometry, opacity, pointer presentation and verified noise reduction
when their capability slices pass. A text-source video clip holds literal text/style
and the ordinary clip anchor; it can be seeded from pinned transcript occurrences. There is no persisted special zoom,
presenter, B-roll or filler-removal object. Convenience operations expand into
ordinary edits and return their expansion for inspection.

Empty projects are valid editable state. Rendering requires a positive requested
range; an audio-only project can render against its explicit canvas background.
Duration is the latest resolved clip end; processing windows do not extend it. A project gap
renders the declared background and silence. Gaps in *acquisition* remain reported
as unavailable source evidence; they must not become fictitious captured silence.
Authored silence is an explicit audio-only occurrence with no asset, stream,
source timestamp or pitch policy. It contributes duration and follows ordinary
clip edits. Source-mapping queries omit it rather than inventing recorded audio;
its identity and authored interval remain visible in the composition. Normalized
clip anchors can follow it, while content anchors require an invertible source
clock. It introduces no asset dependency or generated silence file.

Tracks and processing groups order visual siblings from lower to higher integer
`order`, unique across video siblings under one parent. Parent omission means
output. Grouping changes routing, never clip timing or synchronization. The compiler
derives a depth-first leaf rank for evidence ordering; [processing](processing.md)
owns the forest contract. Clips may not overlap within a track; use separate tracks for overlaps.
Audio tracks sum without order significance. No automatic normalization or ducking:
gain automation is explicit and inspectors report peaks/clipping. An optional
explicit output limiter is a future typed effect, not a hidden export change.

The baseline rendition mixes float PCM at 48 kHz stereo before encoding. Mono
duplicates to left/right without a gain change. Inputs with more channels require
an explicit channel map rather than an undocumented downmix. Rendition settings
and channel maps participate in compilation/cache identity; source streams retain
their actual rate/layout and full-track source extraction can preserve them.

## One time model

Command coordinates and admitted source timestamps are integer microseconds.
Stored selection/placement endpoints also accept reduced fractions of a microsecond
when an edit requires them. Whole values stay numbers; fractions require safe-integer
components and denominator greater than one. Reject unrepresentable results rather
than rounding. Use exact integer/rational intermediates to avoid overflow and drift.
For example, splitting source [0,10) mapped to project [0,6) at project time 2
requires a source boundary of 10/3; rounding it to 3 changes the right fragment
from the original mapping. [03a](slices/03a-exact-edit-boundaries.md) owns this gate. For a range clip, the ratio of selected source
duration to resolved project duration defines its playback rate; do not also store
an independently mutable speed value. Source mapping is affine within a clip.
Piecewise speed changes are splits plus retimes; holds are video/image-only.
Loops are explicit repeated occurrences. Reverse playback and arbitrary continuous
speed curves are not required by the accepted workflow; do not invent them in a
renderer or foreclose a later typed extension.

The core compiler owns rounding: project frame `k` samples at
`floor(k * 1_000_000 * fps.denominator / fps.numerator)`. A range clip maps this
to `source.startUs + floor((t - placement.startUs) * sourceDuration / projectDuration)`.
Select the source presentation interval containing that time, not an assumed
source frame number. At a half-open cut boundary, the following clip wins. Preserve
source hold/gap/presentation evidence. A hold uses its explicit source time.

Audio output sample bounds are `floor(projectUs * sampleRate / 1_000_000)` at both
ends, evaluated from absolute project positions rather than accumulated chunk
lengths. A prepared retime delivers exactly the declared sample count with its
latency/tail handling recorded. Container frame/audio padding is reported separately
from requested content duration; it must not shift later clips.

Range previews preserve the full project's frame/sample phase and return an offset
back to project time. A preview beginning between frame timestamps includes the
already visible picture, sampled at its original project instant; only its visible
interval is clipped. The same applies at the preview end. Its leading picture may
therefore depend on a clip whose authored interval ended before the preview began. Rendering a short range must not restart keyframes, shift
caption timing, or evaluate a different source sample from a full export.

A media occurrence may bind an immutable `acquisitionId` separately from its byte
asset/stream identity. Omission means physical file support only; it never selects
an origin implicitly. Explicit capture support intersects physical support before
the existing source/project and ancestor mapping, so rendering and evidence see the
same unavailable intervals. Contexts retain raw provenance independently of donor
projects. Split/trim/copy retain the binding; media replacement supplies a new
binding, with omitted acquisition selecting physical support. Mismatched explicit
bindings reject atomically. [10b](slices/10b-source-acquisition.md) owns adoption and
this schema change.

`projectToSource` identifies all active visual/audio occurrences; `sourceToProject`
returns all occurrences, with clip IDs. Source evidence remains source-scoped.
Projected evidence includes `(clipId, assetId, generation, source range, project
fragments)` and sorts by `(projectStartUs, resolvedTrackRank, clipId, sourceOrdinal)`.
Partial words remain partial; never silently promote fragments to whole words.
Project transcript query windows select intersecting word rows; each row retains
its full editorial fragments and editorial partiality. Narrowing an inspection
window must not erase recoverable word boundaries or imply an editorial cut.
Synthetic unavailable-support gaps have no original word row and describe the
selected window; raw source evidence retains its original source range.

Project phrase search matches consecutive retained whole-word tokens separately
on each selected speech-bearing audio track. With no track filter, search all such
tracks independently and merge results in the declared stable project ordering;
never interleave words from simultaneous tracks into a phrase. It may cross
contiguous clip boundaries on the same track in edited order, but not an explicit
track gap or acquisition gap. Partial words interrupt whole-word phrase matching
and remain available in transcript reads. Source search retains source-token
adjacency. Each match identifies all contributing occurrences and generations.

## Structural edits and attachments

`edit.apply` processes operations in order against an isolated working document,
then commits once. All operation coordinates refer to the document produced by
earlier operations in that batch. A multi-range removal interprets its ranges
together against its own pre-operation state and removes their union. Omitting
ranges removes the addressed occurrences; removing an absent ID is a no-op. The response returns created IDs,
clip lineage, removed attachments, changed sync groups and the normalized edits.
Clients can bind IDs with operation-local labels rather than invent hidden IDs.
A split can bind right-child labels for explicitly named original occurrences,
including linked members; requesting a label for an occurrence that did not split
is an error rather than a guessed neighboring clip.
The transaction owner supplies a stable identity namespace; created IDs combine
entity kind, that namespace and a batch-local ordinal. Normalized output records
ordered per-operation entity replacements/deletions. `changed` describes the net
final document change, including batches that undo their own intermediate work.

| Operation | Defined behavior |
| --- | --- |
| Track / canvas | Add an explicit track, remove an empty track, reorder all video track/group siblings under one parent, or patch canvas dimensions/rate/background. Removing an occupied track requires explicit clip edits first. |
| Processing / groups | Get a target stack; atomically set its complete list in edit.apply. Add/remove groups and explicitly set parent/sibling routing. [Processing](processing.md) owns these contracts; sync groups remain separate. |
| Place / overlap | Place a selected stream without moving other content; require a free interval or a different track. Importing AV and placing it are separate actions. |
| Insert | Open a gap by splitting at insertion time and shifting content on explicit tracks by the inserted duration. Place new media into that gap in the same atomic batch. The command requires ripple scope; named convenience commands can choose a documented scope and show it. |
| Remove | Delete the addressed range/occurrences; `ripple: none` leaves a gap. Ripple requires explicit track IDs and collapses exactly the removed union. |
| Move / reorder | Move named clip occurrences; require explicit destination and ripple behavior. Optional per-occurrence track destinations affect only the expanded selection. Do not infer that every use of the asset moves. |
| Detach / reanchor | Detach freezes the selected occurrences at their exact resolved project intervals. Reanchor changes their dependency while preserving that interval; explicit move/retime owns timing changes. Descendants retain their attachment to the same occurrence. |
| Replace | Address explicit occurrences and media kinds. Preserve the target interval by default; reject duration mismatch. The agent can explicitly choose trim, hold (video), silence padding (audio), ripple or stretch. |
| Split / trim | Trim names one occurrence and a kept interval in resolved project time; linked members lose only the two addressed end windows, not media outside that occurrence's original envelope. Retain source identity; create stable child occurrences and report lineage. The left surviving child keeps the original ID; other children get fresh IDs stored in the receipt. |
| Retime | Change resolved project duration; linked scope changes linked members together. Audio uses the proven pitch-preserving stage unless explicitly `follow`. Explicit ripple includes all target root tracks and shifts later roots by the duration change; unaddressed content crossing the old end rejects. |
| Duplicate | Copy selected occurrences and their attachments with fresh IDs; `scope: linked` explicitly includes synchronized counterparts. Copied roots land at the requested project destination, while dependencies between copied clips are retained. Original occurrences and links remain unchanged. Placing the same asset anew does not inherit another occurrence's effects. |
| Link / unlink | Establish or remove synchronization groups explicitly. A clip belongs to at most one group. Imported AV placement creates linked members by default. |

Interval-preserving replacement retains the addressed occurrence ID and its
synchronization membership. Without expansion, an identical source selection preserves attachments;
a source identity or selection change removes its attached media descendants instead of assigning
them to new content. Detach/reanchor beforehand to retain chosen attachments.
Owned processing is preserved when compatible, or explicitly reset; its lifecycle
and incompatible-reference errors follow [processing](processing.md), not media
attachment removal. Validate the whole supplied selection before applying a fitting policy. `trim`
keeps its beginning and requires sufficient duration; agents select a different
source start explicitly. `stretch` keeps the selected source range and authors
pitch preservation for audio unless `follow` is requested. `ripple` instead
adopts the source range duration and requires explicit ripple tracks. It changes
the addressed occurrence independently, splitting synchronization membership if
its timing changes; untouched media is never implicitly stretched to follow.
A held source has no natural duration and cannot choose this fit.

Explicit `hold` (video) and `silence` (audio) fits accept a range no longer than
the target interval. A shorter selection becomes a native-duration media prefix
plus an ordinary held-frame or asset-free silence tail. Their union preserves
the target interval. The prefix retains the addressed ID; `clipLineage` returns
both IDs. The tail joins the existing sync group, or creates a group with the
prefix. Linked edits therefore carry the envelope, while selected scope edits
only the specifically addressed pieces. Hold uses the last selected microsecond;
source gaps remain unavailable rather than invented footage. Equal duration
creates no tail. Expansion partitions retained processing over the prefix/tail using its lifecycle
contract. Expansion removes old attached media descendants even when the same
source selection is retained; detach/reanchor first to keep chosen attachments.
These fits do not create a second within-clip timeline or automatic rate change.

Ordinary move/split/trim/remove/retime targets linked members by default. Explicit
`scope: selected` permits independent edits; split and unlink affected intervals,
leaving unaffected linked pieces synchronized. Before ripple, expand linked
targets and reject a track scope that excludes an affected linked member; never
silently desynchronize it. Linked range edits intersect the same project interval
with each member; a member absent from that interval contributes nothing. Move
applies one project delta. Retime applies one affine project-time transform about
the addressed interval start to the selected fragments, preserving relative
offsets under that transform. Whole-group retime uses the group's earliest start.
Out-of-range media is never invented to equalize durations. Agents inspect every
expansion in the result.

Ripple changes project-anchored root **clip** placements once, then resolves attached
descendants once. Naming both parent and child tracks does not double-shift a
child. Explicit range removal collapses the requested range union, including
empty time; whole-occurrence removal uses the selected envelope union. An entirely
absent occurrence selection stays a no-op. If unaddressed root content on a named
track crosses a collapsed window, reject with its clip/track identities rather
than silently deleting it. The agent can include that content explicitly.
An independent ripple targeting an attached child without its affected
root is rejected with the anchor identity; explicitly detach/reanchor first.

Ripple move closes the union of the selected occurrences' old intervals, then
opens their whole selection envelope at `atUs` in the resulting timeline.
The destination is therefore the final start time, after closure. Relative gaps
inside a multi-clip selection travel with it. Both original and destination root
tracks must be named. Moving only between tracks at the same time does not open
or close time. Destination content crossing the insertion point splits using the
ordinary linked partition rules; unaddressed content crossing the source removal
windows rejects under the same removal rule above.

Content anchors refer to one clip occurrence and its source range. They follow
move and retime. Trims intersect the anchor with surviving source content. Splits
partition attached effects/overlays/captions and preserve boundary curve values.
No surviving content removes the attachment. Replacing content does not retarget
its old media/caption attachments to unrelated media; the agent can add/reanchor
them explicitly. Target-owned processing follows its separate preserve/reset policy.

An attached media overlay uses the same resolved placement algebra: when its
parent is shortened or retimed, preserve the corresponding portion of its own
source mapping. Retiming that overlay's audio follows its explicit pitch policy.
Anchor dependencies must be acyclic and resolve within the same revision. Held
frames and stills use `kind: clip` with normalized fractions of the parent clip's
project duration (0 through 1), so attachments follow move and retime without
pretending a held source instant has duration. Split/trim restrict and rebase
those fractions onto surviving children; no surviving interval deletes them.
Ordinary source-following attachments use `kind: content`. Both forms belong to
the same resolver; captions/keyframes cannot invent another anchor system.

Project anchors stay at their explicit times unless the batch explicitly changes
them. `touchedFixedAnchors` lists unmoved project-root clips whose intervals overlap
or follow the first ripple window, so the external agent can review them; it does
not mean their positions changed. Captions/effects extend this receipt when their
capability slices arrive.
The engine does not choose B-roll, cover changed speech, remove ums, or decide
what speaking pace is appropriate.

## Visual and audio parameters

Coordinates use top-left canvas space, positive x right/y down, square pixels.
Clip processing starts in oriented source pixels; crop uses the preceding
image domain. Within a geometry processor the order is crop → fit into the
requested rectangle → scale/rotation about a normalized pivot → translation.
Stack order controls the order of distinct instances, including opacity. Parent
processors consume the combined canvas-sized surface, per [processing](processing.md). Fit modes are explicit contain/cover/stretch;
contain is the convenience default. Do not bake orientation or crop into source
assets. Pointer positions and trails use the same transform as their source.

Scalar curves cover position, scale, rotation, opacity and gain. Keys use the
anchor's time domain: integer source microseconds for content anchors, integer
project microseconds for project anchors, and reduced Fraction values for clip
anchors. Validate one key-time representation matching the anchor, never mixed.
Keys must be strictly ordered; equal-time duplicates are rejected. Values clamp
to the first/last key outside their key range while inside the anchor. Segment
interpolation belongs to the outgoing key; hold, linear and cubic Bézier easing
are supported, with cubic x handles in [0,1]. Splits preserve the entire original
curve, not just its boundary value: restrict/reparameterize cubic segments and
control handles exactly, or retain the original curve with an evaluation window.
Compare samples on both sides against the unsplit curve. Splitting alone causes
no visible/audible change.

Core compiles authoring curves into execution primitives. Native workers execute
those primitives; they must not independently choose easing, crop, fit, placement
or rounding semantics. Shared conformance vectors test the transport boundary;
the compiler remains the owner, not the test fixture. Gain is a linear multiplier
in the render contract; dB convenience commands convert once in core.

Captions support explicit text, font, size, color, box, alignment, line wrapping
and anchor. Correcting caption/transcript text does not synthesize audio. Voice
generation is a separate job. Fonts are dependencies: retain the selected font's
identity, reject unavailable fonts instead of silent substitution, and include
redistributable font assets or an explicit required-system-font declaration in
portable packages.

## Managed commands, revision transactions and jobs

Keep the existing invocation style: `screenrec <operation> --params JSON|-`.
`--help` and MCP tool schemas derive from one registry; no new shell grammar or
separate MCP implementation. Example below is illustrative of the **planned** API:

```sh
screenrec project.create --params - < project.json
screenrec asset.import --params - < import.json
screenrec edit.apply --params - < batch.json
screenrec preview.get --params - --output preview.mp4 < preview.json
```

`project.create/list/get/delete`, `asset.import/get/list`, `edit.apply/undo/restore`,
`revision.get/history`, `processing.get/capabilities`, source/project inspection, `preview.get/retry`,
`export.create/status/list/retry/recover/cancel/abandon`,
`package.open/status/close`, `job.get/retry/cancel`, model preparation and
`voice.generate` are
operation families, not independent application servers. Slices add exact schemas
to the protocol registry. Pages default to 250 rows, at most 1000; bulk edit batches
default to a 1000-operation admission bound. Help reports limits. Larger work can
be chunked deliberately; never silently split an atomic batch.

Slice 09 preserves the durable exportId retry/cancel/recover/abandon contracts for
new project exports. Slice 22 adds package admission and explicit adoption as an
editable project; `package.close` releases its inspection handle, not the adopted
project. An explicit package revision selects that historical moment: retain its
complete history prefix and then-active undo stack, excluding later donor edits.
Omitting the revision selects the current head. Export never moves the donor head. Slice 23 removes old recording-target schemas. Old-library in-flight jobs
are not migrated or silently replayed by the new library; cutover reports that
boundary and retains the old library untouched.

An edit carries `projectId`, `expectedRevisionId`, `requestId`, and operations.
Assets must already be ready. Decode, copy, synthesize and stretch preparation run
outside the database transaction. A successful commit atomically stores the full
document, undo history, dependency references and replay receipt. Check matching
request replay before stale state. Reused ID with changed args is a conflict;
failed edits do not publish partial state. Prepared unused assets are not partial
edits and can be reclaimed explicitly when no job/revision retains them.

Project deletion is idempotent by project ID, including an absent project. A durable
marker immediately hides the project and fences reads and edits, including old
edit retries. Creation retry still returns its original receipt but never recreates
a deleted project. The service drains project jobs before retiring historical
revision references. Originals remain assets; deletion does not reclaim them.
Retained project and request identities prevent retry resurrection. Startup resumes
unfinished retirement. As preview/export readers land, their owners must join the
same drain boundary before revisions can be retired.

Undo and restore append new revisions, never mutate historical identities.
In-flight reads/jobs/exports pin a revision and dependencies across later edits.
Cancellation drains worker resources before releasing leases. Jobs expose progress,
failure and explicit retry; a polling client must not restart work. Cache identity
includes composition content, assets, processing generations, settings, profile,
and selected implementation/model versions. No automatic model downloads during
an ordinary read/render; explicit preparation follows the existing model pattern.

Import, generation and retime preparation return a shared jobId and use
job.get/retry/cancel rather than separate job-control implementations per feature.
Job retry preserves the frozen input identity; changing inputs creates a new job.
Exports keep their specialized durable publication controls and exportId because
recovery of an uncertain external publication is different from recomputing media.

Voice generation accepts desired text, an explicit admitted audio reference range,
reference transcript when required, and bounded generation options. Same-video,
local-file and past-project references all resolve through asset admission. Output
is an immutable generated asset plus provenance, not an immediate edit. A requested
target duration is a request to evaluate fit, not permission to silently stretch:
return measured duration and let the agent choose an explicit fit operation.
Persist the generated bytes for replay; a random seed alone is not reproducibility.
If the selected reference is unusable for the chosen model, return evidence of
that failure; never silently select a different speaker or reference passage.

Voice replacement can retain ambience by extracting a selected quiet region of
admitted original audio and mixing it beneath generated speech. Keep room tone
as a separate retained asset/layer with explicit range, gain, repetition and
transition windows. Background matching is an agent-chosen edit, not permission
to modify the whole original track or silently change the generation mode.

## Inspection, exports and supported media

`source` and `project` are explicit time domains. Every artifact reports its
domain, time origin, revision/generation pins, units and returned bounds. Audio
includes bounded WAV excerpts and complete selected-stream/project-mix WAV export
as a job. Waveforms return min/max/RMS buckets with bucket duration and optional
timestamped images. Spectrograms return bounded images with time/frequency axes.
Silence/energy candidates are labeled heuristic and never cut anything themselves.
Processed target/tap inspection uses the same stack executor as preview/export;
raw source evidence remains unchanged. Artifacts identify which target and step
they represent, including whether later parent processing is excluded.

Public picture receipts report sample/visibility timing, selected source layers and
physical picture provenance for video. Timeless image layers name their image kind
and asset/stream identity without a source time or physical sample. The authoring
hold at zero selects the complete image, while placement determines its duration.
Renderer-private affine/mask instructions are not
authoring coordinates and do not belong in agent-facing receipts. Native
publication verifies the complete compiled picture before returning its public
evidence; agents inspect authored placement through the processing API.

Project `cut` events describe exact, track-local editorial source-mapping
transitions, not measured scene changes or proof that the final composite changes
visibly. A row names `projectAtUs`, track/rank, audio/video plane and nullable
`before`/`after` sides. Each side names its clip and source kind, with complete source
binding, exact boundary coordinate and rate when applicable. The pinned revision
is the authority; no source generation, removed-source span or capture provenance
is invented for a project cut.

Derive transitions from full revision neighbors before applying the query range.
Suppress a seam between the same binding/source kind with continuous exact source
coordinates and equal affine rate, regardless of clip IDs. Adjacent identical
holds and adjacent silence likewise do not create a cut. A jump, replacement,
rate change or transition between media/hold/silence does. Internal track entrances
and exits are included, so an overlay reports its own boundaries without changing
underlying tracks. Exclude the whole project's opening and true rational terminal
boundary. Physical/acquisition support gaps are availability evidence, not new
editorial cuts; authored transitions inside gaps do not establish visible content.
Processing changes are outside this narrowly defined event category.

Cut times remain rational and use ordinary `[start,end)` query ownership, including
exits. Clipping a query must never create artificial cuts. Capture interruption
markers retain their separately documented closing-boundary ownership. Screenshot
selection quantizes through the compiler's global frame phase independently;
it must not round the editorial event itself. Cut coverage is available from the
pinned project revision and does not pretend that a raw source supplied cut evidence.

Import baseline: AVFoundation-decodable MOV/MP4 H.264/HEVC, WAV/AIFF/M4A/MP3 audio,
and PNG/JPEG stills, verified by the import slice's fixtures. Probe unsupported
streams and report them; no claim to every format. Preserve original frame timing,
orientation and bytes. Initial output is SDR Rec.709 MP4 H.264/AAC and portable
editable packages; WAV delivery is an inspection/media artifact. HDR imports need
an explicit validated SDR transform before rendering, never silent washed-out
output. Lossless intermediate or additional codecs are not required to complete
this plan. An agent can use other tools to prepare unsupported input.

Canvas dimensions and rational frame rate are caller-selected. Default is the
first visual source's oriented dimensions and a declared 30 fps project clock;
empty/audio-only projects require explicit canvas. Presets are convenience only.
The baseline profile accepts positive even dimensions up to 8192 per edge subject
to capability probing; a request outside its capability is rejected with supported
profiles. An explicit pad-to-even profile may preserve an odd requested content
rectangle inside even encoded dimensions. Report both; never silently crop/resize.

Output controls are agent-facing settings, not only quality presets. Expose the
supported encoding controls through the shared CLI/MCP schema and capabilities.
Presets expand to inspectable defaults with explicit overrides; the default MP4
preset balances sharpness and file size. Resolve and pin the complete settings
before admission, include them in derivative/job/export identity, and report them
with results. Unsupported combinations fail explicitly rather than being ignored
or silently substituted. Geometry remains owned by canvas and processing controls.
[Output-settings adoption](slices/09b-output-settings.md) owns the capability
inventory and verification; new codecs are not implied merely by exposing controls.

Preview and export use the same compiler/executor and differ only in declared
rendition/encoding. Compare decoded matched timestamps with codec tolerance rather
than expecting byte-identical compressed files. Exports pin intent and publish
atomically. A portable project includes history and the transitive asset/evidence
dependencies required for playback, undo and retained generation references. It
opens as an editable project and works after relocation without the old directory,
another project, a model cache, or a network connection. Regeneration may require
explicit model preparation, but existing generated audio must keep playing.
