# 20g — unchanged raw camera fragment-prefix feasibility

Status: preparation failed at the fixed external-compile deadline; the physical
question is unmeasured. No ordinary or interrupted media case started. This is a
bounded prerequisite experiment, not a production mechanism or stop-performance
verdict. The original interrupted setup and corrected attempt are retained
separately in the [evidence packet](../assets/20g-camera-raw-prefix/README.md).

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
