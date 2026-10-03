# Capture audio-gap repair architecture

Read-only audit of main `bfd2c9b3`; no devices, builds, experiments or edits.
Independence disclosure: the required evidence README contains a “General fix
proposal” section, which appeared during the initial evidence read. I have seen
that high-level suggestion, but no other agent's separate proposal. The decisions
below are derived from the current writer, journal, recovery and consumer contracts.

## What must change, and what must not

The retained owner probe establishes payload displacement, not merely a bad mask:
11 accepted PCM callbacks decode to the original samples with callback4 removed
and later payload concatenated. The declared later endpoint remains2.100s while
media ends1.929333s. Pause-overlap omission changes the expected source positions
but the same packed payload remains. Preserve this red oracle and the continuous
control; do not substitute count/tail metadata for sample-identity placement.

`CaptureClock` remains the sole host→source clock and pause-removal authority.
`CaptureWriter.stream` currently retimes each accepted buffer, appends to one
AVAssetWriter PCM input, then journals only role/startUs/endUs. `track.samples`
counts callbacks, not PCM frames. `audioSamples` records are ordinary writes;
track start/control/finish boundaries synchronize. Append success does not itself
prove which bytes survived an interrupted movie fragment.

`MediaRecovery.inspectTrack` decodes intervals and intersects them with physical
occupied segments and acquired journal support. `SourceTrack.open` similarly
intersects availability with occupied `SourceSegment`s, then AVAssetReader seeks
in asset time. `acquisitions.ts` imports one role.mov/one matching stream and derives
source availability from journal evidence. All assume the asset already places
its actual PCM at the claimed source times. A different support mask, source offset,
source duration or recovery rounding cannot repair packed payload. No reader should
learn a separate capture-specific timeline.

## Recommended smallest general repair

**Make the canonical role MOV itself carry the sparse placement.** First prove a
bounded container mechanism that preserves exact PCM and explicit empty intervals,
including after a crash. If AVAssetWriter can directly persist the required sparse
track representation, that is the smallest implementation. Do not assume different
PTS, fragment settings, repeated session calls or final endSession fix it: current
PTS already fails, and the exact host API behavior requires a small isolated proof.

If no direct crash-safe sparse writer is demonstrated, use the current writer as
an explicitly packed *staging payload* and add exact payload-address evidence to
the **existing CaptureJournal**. At finalization/recovery, materialize a canonical
single-track MOV with occupied runs at source positions and empty edit-list gaps.
Prefer a lossless container remux/composition transfer; its exact PCM preservation
and edit-list behavior must be measured before selecting the API. No padding,
resampling, re-encoding assumption, second clock or per-reader remapping is allowed.

The address record needs enough information to distinguish coordinates:

- role and payload-file identity, format/rate/layout identity;
- accepted PCM start frame and frame count in the packed payload;
- source presentation start and exact media duration/count relation;
- ordered record/commit association sufficient to identify a recoverable prefix.

Keep exact frame/rational positions internally; project/journal microsecond support
is a derived presentation boundary. Repeated rounded microsecond durations must
not become a cumulative audio clock. Preserve sub-microsecond source timing where
needed to distinguish true discontinuity from callback timestamp quantization;
verify the lowering into the existing source-microsecond contract rather than
adding a tolerance. Only genuinely contiguous payload/source pairs may coalesce.
A source gap is not an acquired silence interval. Overlap, backwards timestamps
or a format change need an explicit supported representation or refusal, not an
implicit concatenate/drop/retime policy.

These records describe storage addresses, not a new editorial timeline. CaptureClock
still supplies source placement. Normal finish and restart recovery must call the
same materialization/validation owner, after which existing SourceSegment,
MediaRecovery, acquisition, raw-audio, waveform and composition paths consume the
same canonical media without a mapping adapter.

## Crash publication and bounds are part of the repair

Use a distinct staging payload name so an old/current reader cannot mistake
packed bytes for canonical role.mov. Keep staged payload and journal until a
verified canonical MOV has been atomically published. A complete capture result
and finished journal record must follow successful role publication, not merely
writer.finishWriting. Recovery must be restartable/idempotent across each stage;
never overwrite or delete the only recoverable payload before publication succeeds.

Define the actual crash contract explicitly. Existing ordinary per-buffer journal
writes and AVAssetWriter fragments are not a cross-file transaction or a proven
power-loss guarantee. A journal record can outlive media bytes, or accepted media
can outlive its record. Recover only the intersection of **verified address mapping
and decodable payload**, preserving source positions for that verified prefix and
reporting the rest missing/uncertain. A half-committed boundary must not authorize
later packed samples at an earlier source coordinate. Verify whether raw PCM sample
cursor/count evidence is sufficient to fence the recovered prefix; add record
integrity checks if required, not an invented assumption that append meant durable.

Bound memory by streaming records and coalescing contiguous runs; work may be linear
in recorded bytes, never quadratic replay or whole-audio RAM. Do not split files per
callback. Container segment metadata grows with real discontinuities, so define
and test an explicit gap/run budget and failure boundary. Finalization may need
temporary disk approximately proportional to payload size; account for that and
cancellation. Existing `streamEvidence` is bounded; `inspect` currently retains
pause/audio arrays, and acquisition binding has a100000-interval limit. Reuse these
boundaries deliberately rather than quietly introducing an unbounded run list or
O(number-of-runs) simultaneous readers/writers. A million-callback continuous take
should remain a single logical occupied run, not a million container edits.

## Alternatives and tradeoffs

| Alternative | Benefit | Cost / judgment |
| --- | --- | --- |
| Direct proven sparse container writing | No remux copy; canonical media exists during recording | Best if demonstrated for normal completion and interrupted fragments; current append recipe demonstrably does not do it. |
| Packed staging + journal addresses + shared sparse materialization | Keeps real-time append simple; consumers unchanged after publication; crash repair can replay exact addresses | Recommended fallback; adds bounded finalization/recovery I/O and requires precise durability/publication protocol. |
| One media file per contiguous run, then consolidate | Closed runs independently recoverable, explicit starts | More file/resource handling, potentially many runs, same eventual canonical publication requirement; consider only if fragmented packed recovery cannot be made trustworthy. |
| Permanent sidecar remapping in source readers | Avoids remux | Reject for this repair: propagates a parallel placement authority through raw audio, probe, recovery, export, acquisition/package and external playback. Existing consumers would disagree. |
| Write silence into holes | Simple clock length | Reject under this contract: invents media and can make unavailable support look acquired; a mask does not remove the semantic deception. |
| Finalize-only edit list without recovery mapping | Small happy-path change | Insufficient: crashed captures retain the proven displacement with no reliable later addresses. |

## Existing recordings

Do not mutate immutable imported assets or silently rewrite old recordings in place.
Legacy journals have microsecond acquired intervals but no explicit PCM frame
addresses/counts; rounded durations, callback counts or decoded total length alone
are not a universal reconstruction proof. Preserve existing continuous recordings
unchanged. For an old discontinuous take, first test whether its physical container
already preserves placement. If it does, keep the existing consumer path. If it is
packed and no exact mapping can be established, report ambiguous/unverified later
placement, retain original bytes, and expose only independently established support
(or refuse that role). Do not continue claiming acquisitionVerified merely because
a journal header exists. Any optional historical reconstruction must be an explicit,
validated derivative with provenance, not a metadata relabeling. File/journal
compatibility needs a concrete reader policy before choosing a format version.

## Required tests before promotion

1. Actual CaptureWriter continuous control is unchanged, then omitted middle
   callback and measured pause-overlap cases: exact later marker/sample identities
   at declared source positions; empty gaps remain unavailable; no inserted samples.
2. Leading silence versus missing leading support, nonzero audio start, several
   holes, adjoining callbacks with noninteger-microsecond durations, 44.1/48k and
   two independent audio roles/channels. Test overlaps/backwards/format-change
   refusal or explicitly supported semantics. Keep exact count and phase oracles.
3. Healthy stop **and** interrupted cap. Crash before/after payload append,
   before/after mapping record, mid-record, around fragment persistence and during
   canonical-file publication; restart recovery twice. Verify actual recovered PCM
   addresses and missing tails, not merely successful decode or declared duration.
4. Raw source audio, source evidence/acquisition import, waveform and composition
   full/range/tail/split consume the same repaired role file. Include a seek wholly
   after a hole: it must return the intended later payload, not an earlier packed
   sample. Legacy continuous and truthful sparse fixtures remain unchanged.
5. Long continuous and many-gap captures with bounded memory, segment/file counts,
   I/O and cancellation. Existing native capture/recovery tests remain intact;
   physical device timing and ten-minute sync are separate later gates.

Immediate next step is a **bounded storage proof**, not the full repair: feed the
already frozen omitted-buffer corpus into the smallest candidate sparse-container
construction, prove exact sample-address placement and empty occupancy with the
existing readers, and then deliberately interrupt that same representation before
publication. Stop at a failed representation rather than masking it in consumers.
No new webcam feature or capture-device session is required for this decision.
