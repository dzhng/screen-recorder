# 20g — unchanged raw camera fragment-prefix feasibility

Status: mixed physical result; general prefix stability remains unqualified.
The original setup deadline is retained. A separate compile-only diagnostic
qualified the unchanged executable, then the physical continuation reused it.
The ordinary case preserves its complete 29-picture prefix through extension and
closure. The separate candidate reports a mismatch at ordinal 24 before the
planned interruption; recovery never ran. Lost later operands and failed raw
output prevent identification of the changed field. This is a bounded prerequisite
experiment, not a production mechanism or stop-performance verdict.
[The evidence hub](../assets/20g-camera-raw-prefix/README.md) separates all phases.

## Question and fixed acceptance

With the existing CameraWriter unchanged, can a physically decoded completed raw
prefix preserve every ordered picture's exact PTS, native-scale digest PTS,
dimensions, visible BGRA bytes and native presentation endpoint through a further
fragment extension and ordinary closure? A raw prefix cannot establish the
independent canonical-movie traversal; both production digests remain required.

The external probe reuses byte-qualified current ScreenRecorderCapture and
ScreenRecorderMedia modules. It decodes the existing three-picture
`camera-visible32.mov` and cycles those buffers for 210 offered frames, paced at
30 fps over seven seconds. Existing CaptureClockIngress retiming and CameraWriter
own clocks, admission, H264 settings, MOV, microsecond scales, the one-second
initial fragment and five-second later fragments. No device or playback runs.

The initial complete top-level `mdat`/`moov` and subsequent complete MOV
`mdat`/`moof` extents identify actual fragment extensions. This is MOV ordering,
not streaming MP4 ordering. Native `canContainFragments` qualifies the initial
fragment and `containsFragments` qualifies later extensions. The observer reads at most 2 MiB of this tiny output and
never interprets sample timing itself. [Apple’s container explanation](https://developer.apple.com/videos/play/wwdc2020/10011/)
and retained actual interrupted MOV headers qualify this ordering before dispatch.
Fresh native readers use the existing
SourceSegment/assetEnd owners. At the first complete fragment, every decoded
picture except its final picture is provisional. On a second actual extension,
all those tuples must be identical; only then is that prefix committed. The
first snapshot's final picture, all later fragments and the still-open tail stay
uncommitted. The completed raw movie must preserve the entire committed prefix,
with complete final ordinal/accepted-mapping checks. Reader status and process
termination are retained. This does not assert a universal tail/backlog bound.

Only an ordinary-case pass permits a distinct interrupted case with the same
input, pace and settings. After its second-extension comparison and seven-second
feed, the controller kills that writer process before closure. A fresh existing
native physical reader compares its committed prefix. The unfinished tail stays
unverified; there is no canonical publication or recovery adoption.

## Bounds and failure

One phase is limited to 180 seconds including the single external-probe compile;
each writer observation is limited to 15 seconds. There are no retries, setting
changes, alternate containers, encoder changes, duration adjustments or broad
builds. Fewer than two actual extensions, absent timing, tuple differences,
reader/writer failure or a bound violation fail-stop with exact evidence. The
SDK documents fragment support, not this physical equality. Its lack of an
emission deadline is tested within the fixed bounds, not silently assumed.

[Evidence and fixed commands](../assets/20g-camera-raw-prefix/README.md) retain
source/module/input authority, process records and the outcome.

## Result and next condition

The ordinary final movie contains 197 accepted pictures from 210 offered frames;
backpressure is retained. All closed ordinals and native PTS match accepted
mappings. This one case does not establish a universal one-picture tail rule.
The second case contradicts adopting that rule from the ordinary pass.

A successor must persist complete operands before assertions and retain bounded,
explicitly unverified failed media before cancellation deletes it. Those corrections
cannot reconstruct the missing historical operands. A new physical candidate also
needs a supported stability condition for decoder dependencies and native endpoints;
changing the discarded tail until the example passes is not such a condition.
Canonical traversal, recovery, backlog and stop performance remain separate gates.

[Observer preparation](../assets/20g-camera-raw-prefix/observer-preparation/README.md)
now qualifies actual filesystem failure retention and complete SDK typechecking.
It preserves the rejected imported-Boolean compile separately from the lossless
bridge. Native cursor values and live cleanup remain unverified.

## Fixed metadata-only next question

Does the unchanged writer's retained closed ordinary MOV expose actual full-sync,
dependency/reordering and stored-byte facts that can support a new boundary
hypothesis? Header contracts and typechecking cannot answer native availability.
This is a necessary observation prerequisite, not another test of the failed tail.

Use only the saved ordinary raw movie and all 197 closed picture/mapping rows from
the physical packet, with their exact identities. Reuse the qualified cursor-fact
owner and existing segment mapping. Enumerate the complete native presentation
inventory; report count/ordinal/rational asset-PTS correspondence, all raw timing
flags, actual sync/dependency-known flags, DTS, decode duration and storage extents.
Record reordering queries only between cursors from that same track instance.
Unknown data stays unknown; zero refresh count supplies no guarantee. Keep the
computed endpoint's decode-duration qualification explicit.

Warm compile preparation is bounded to 150 seconds total and the single metadata
entry to 15 seconds, with 1 MiB stdout/stderr caps. Lossless compiler-only API/type
corrections may use that same preparation budget; preserve each rejected source,
command and terminal separately. They cannot change the measurement semantics.
Freeze source, plan, input and runtime
bindings before dispatch; preserve failures and actual terminals. No writer,
AVAssetReader, pixel decoding, new device capture, media modification or recovery
runs. Check complete saved values afterward without replay. If native facts are
absent or contradictory, report that limitation and stop; do not tune the tail or
select a production mechanism. Useful facts may support a separately planned
candidate, but cannot themselves establish prefix stability or stop performance.

## Metadata result

The [native packet](../assets/20g-camera-raw-prefix/native-cursor-qualification/README.md)
qualifies all 197 rows and 589 same-track queries without decoding pictures or
writing media. Its source/grid differences remain explicit. Seven actual full-sync
samples are observed, but both self-reordering “may” predicates are true at each;
the API has not certified an append-safe boundary. Dependency knowledge is partly
unknown and refresh zero supplies no guarantee.

Independent saved-data review finds every interior owner endpoint equal to the
next presentation PTS, including the long hold. No timing bug is demonstrated by
this fixture; the general decode-duration interpretation remains unproved.
The original failed tuple's changed field is still unavailable.

Next investigate whether the retained codec data and primary contracts provide a
finite dependency/reordering bound with complete-byte and endpoint conditions.
This source-only question may justify a separately fixed candidate; it is not
permission to tune the discarded tail, alter writer settings or adopt incremental
verification. Canonical correspondence, recovery/backlog and stop remain open.
