# Complete-IDR camera prefix feasibility

**The fixed raw-prefix cases passed; general append safety remains unqualified.**
Both cases retain all29 pictures before their actual decoded closingIDR through
further active extensions and ordinaryclosure/separate interruption/reopening.
[Execution evidence](../assets/20h-camera-idr-fence/execution/README.md) preserves
the fullresult. All20g outcomes stay intact.
[The reference packet](../assets/20h-camera-idr-fence/README.md) separates executed
byte inspection from the frozen prototype, exact commands and bindings.

## Contract

Can an actual complete IDR close the preceding coded sequence so that every
ordered decoded picture, clock, visible BGRA byte and existing owner-computed
endpoint remains identical after a further active fragment extension and ordinary
closure? The closing IDR must itself be traversed by the native decoder. Its
picture/duration and the whole later coded sequence remain uncommitted.

H264 IDR reference reset plus `no_output_of_prior_pics_flag=0` with unchanged
applicable parameters supplies a decoder-drain hypothesis. It does not certify
immutable file bytes, presentation timestamps, segment mapping or native endpoint
invariance. The retained SPS's inferred DPB/reorder bound is **12**, conditional
on conformance; it is neither a reference-age bound nor a time/encoder deadline.
Cursor MAY predicates and an arbitrary discarded tail cannot replace the fence.

## Fixed preparation and case

The frozen external prototype reuses qualified observation ownership, failure
retention, complete picture comparison and native timing/decoding owners. Only
its decoded-row cap grows to cover the new fixed feed. Current native source,
modules/objects, input and compiler/SDK bindings must match before dispatch.
No maintained harness or production architecture is selected.

Cycle the existing three-picture input for **390 offered frames at 30 fps over
13 seconds**. Keep CameraWriter, retiming, H264/MOV, microsecond scales and
one-second initial/five-second later fragments unchanged. A complete IDR may first
be available in the second fragment near six seconds; the third extension near
eleven seconds is then needed for an active comparison. Thirteen seconds covers
that prospective third extension. This supplies no SDK emission guarantee and is
not a retry or parameter adjustment of the seven-second case.

Compile preparation has a total **150-second** bound using the previously
qualified warm recipe; all writer/query work has **20 seconds per case**, and
fresh interrupted-source reading has **15 seconds**. Stdout/stderr each have a
1 MiB cap, raw files/copies a 2 MiB cap, and decoded inventories a 400-row cap.
The fixed whole controller phase is 210 seconds. Deadline cleanup permits one
second for query-first termination, native wait/reap and failure preservation,
then kills and awaits the writer if necessary. No physical retries or tuning.
Lossless compiler-only API/type corrections share the same preparation budget,
with separate frozen rejected-attempt namespaces; they cannot change semantics.

## Immutable observations and complete-byte gate

Save a bounded copy from byte offset zero ending only at the last complete MOV
`mdat` followed by its referencing `moov`/`moof`. A second bounded read through
the same descriptor must match the saved prefix. Do not rewrite atoms, rebase
physical offsets or treat an open-ended/partial atom as committed. Persist copy
lengths and complete bytes before native inspection. This detects a torn read;
it does not promise the original writer will never change earlier bytes.

Native readers inspect the immutable copies. Save complete decoded picture
operands, raw cursor facts and segment bounds before gates. Capture complete
CMFormatDescription metadata, SPS/PPS bytes, NAL length width and actual track
transform. Every applicable cursor format must equal the captured description.
The scoped byte inspector refuses unsupported syntax rather than guessing.

For every sample preceding the selected IDR and the closing IDR itself, require
complete referenced sample extents within complete media boxes, complete NAL
length chains/access units and identical applicable parameter/format identity.
Require actual type-5 IDR and no-output-prior zero, unique valid media DTS,
strict decode/presentation separation and every committed owner endpoint at or
before the **asset-clock** fence. Media and asset clocks remain distinct. The
native output must include the IDR picture, not merely its header/cursor flag.

At the first qualifying snapshot select its latest noninitial complete IDR and
freeze all preceding picture/logical operands. Admit correspondence through the
existing mapping owner; retain exact source ticks and rounded writer-grid flags.
At a later complete fragment require at least one actual successful append
**after selection**, with the writer still unclosed; record offered/admitted
counts at both events. Delayed encoder output after feeding stops is insufficient.
Then compare every committed ordered picture tuple and logical encoded sample.

## Extension, closure and interruption

Compare complete logical NAL payloads, parameter/format/transform identity, raw
sample clocks, mapping origins/rate and owner endpoints. Save physical sample/
chunk offsets, URLs and indices separately. Normal closure may relocate equal
payloads, so physical offset equality is not a requirement. Segment durations
naturally grow: require the same mapping/support on committed ranges and equal
owner endpoints, rather than equality of the whole growing segment end.

After the further active comparison, ordinary closure must retain that same
complete prefix and match the entire closed ordinal/PTS inventory against all
accepted mappings. The endpoint remains the existing owner's mapping/clipping of
SDK **decode duration**, not an independently guaranteed display duration.

Only ordinary success permits a distinct case with the same fixed recipe. Its
own candidate and active comparison must pass before the controller deliberately
SIGKILLs the still-unclosed writer. All byte-query children must already be
terminal and awaited. A fresh existing physical reader compares an immutable
complete-fragment copy from the interrupted raw source. Label this as raw-source
reopening; no canonical recovery, publication or unfinished-tail proof follows.

## Failure and allowed claims

Preserve both operands, exact differing fields, complete copies, admissions,
observations and capped unverified raw bytes before writer cancellation/discard.
Every byte query records actual argv, PID/parent/group, start, exit and wait.
On deadline the supervisor kills an outstanding query only while its native
parent remains live and the query belongs to that parent's owned session group;
the native owner reaps it during the fixed cleanup grace. Preserve actual missing
receipts/failed persistence as missing. Never replace them with reconstructed
success. Any unsupported syntax, absent fence, admission gap, tuple/logical
difference, failure or bound violation stops this case without tuning.

A scoped pass could qualify this tiny input/recipe's selected raw prefix through
extension, closure and separate interruption. It would not establish general
append safety, bounded backlog or unresolved-tail duration, either independent
canonical digest, source-wide format coverage, throughput or stop performance.

## Actual ownership limit

All byte-query children exited and were awaited normally, but Foundation assigned
each its own process group. The frozen timeout guard presumes the native parent's
group and would refuse those actual child groups. No timeout occurred: this
exceptional cleanup/deadline path remains unqualified and needs a separate
nonmedia ownership check. Do not mutate or replay these frozen cases to conceal
the discrepancy.
