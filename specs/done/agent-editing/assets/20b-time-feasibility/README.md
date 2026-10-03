# Capture time representation — bounded feasibility, not ordinary capture support

The existing actual-writer reproduction creates PCM buffers from AVAssetReader,
adds a microsecond host anchor to each media PTS, then copies timing with
CMSampleBufferCreateCopyWithNewTiming. This probe reads those same 48k corpus bytes
and the retained ordinary 44.1k control. It compares the existing recipe with a
nanosecond anchor, then explicitly constructs nearest-nanosecond observations.
No capture device, permission, stream start or production timing path is involved.

`probe.swift` records raw values, scales, epochs, rounding flags, sample counts,
per-sample duration, second-sample PTS and origin subtraction. `analyze.py` uses
Python Fraction as an independent exact arithmetic oracle. Run from repository root:

```sh
proof_dir=$(mktemp -d /tmp/capture-time.XXXXXX)
swiftc specs/agent-editing/assets/20b-time-feasibility/probe.swift -o "$proof_dir/probe"
"$proof_dir/probe" specs/agent-editing/assets/00-corpus/a-audio.wav specs/agent-editing/assets/20a-sparse-storage/run/continuous-44100.mov "$proof_dir/observations.json"
cp specs/agent-editing/assets/20b-time-feasibility/analyze.py "$proof_dir/analyze.py"
python3 "$proof_dir/analyze.py"
```

The analysis reads observations and the tested `probe` binary beside its script.
Scratch outputs preserve the frozen evidence. Reports pin input bytes and binary.

## Exact observations

| Rate | Buffers | Strict exact-adjacency runs | Adjacent timestamp error | Rounded CMTime additions |
| --- | --- | --- | --- | --- |
|48k|12|12|−2/3 or+1/3 ns|8|
|44.1k|11|11|−83/441 or+358/441 ns|10|

The existing microsecond-anchor copy recipe is exact in these inputs. Combining
nanoseconds with 48k requires scale 3000000000; with 44.1k it requires 441000000000.
Both exceed Int32. In this runtime CMTimeAdd returned nanosecond scale with rounding
flags; the oracle verifies the actual fractional errors, rather than assuming the
fallback scale from documentation. Even a request for the second sample's PTS
rounds when that scalar cannot express anchor+1/rate. The per-sample duration itself
remains exactly 1/rate. A timestamp plus frame position/duration therefore contains
more exact information than the scalar CMTime result of adding them.

When the experiment **explicitly supplies** nearest-nanosecond quantization, exact
round-trip prediction accepts every contiguous buffer, rejects a 1ns perturbation,
and detects the known omitted buffer. There is no epsilon comparison. These are
positive/negative controls for a proven quantizer, not evidence that ScreenCaptureKit
uses it. Recreated observed stamps have no rounded flag; neither that flag nor
values that happen to fit establish quantizer provenance.

Apple's [CMTimeAdd](https://developer.apple.com/documentation/coremedia/cmtimeadd(_:_:))
documents finite timescales and rounding when a common scale cannot fit.
[CMSampleTimingInfo](https://developer.apple.com/documentation/coremedia/cmsampletiminginfo)
and [timing-copy construction](https://developer.apple.com/documentation/coremedia/cmsamplebuffercreatecopywithnewtiming)
define the first presentation timestamp and duration of equally spaced samples
within a buffer. They do not establish the source's quantizer or exact continuity
between distinct buffers. Local SDK headers used in the inspection are hashed in
`artifact-hashes.json`; no assumption about undocumented device behavior is accepted.

## Minimal 20b recommendation and remaining gates

Keep CaptureClock as the sole placement owner. Retain numeric raw PTS/epoch, exact
origin and pause boundaries; perform subtraction in checked reduced rational
arithmetic instead of treating generic CMTimeAdd/Subtract as exact. Preserve a
packet/run as its exact mapped first anchor plus physical frame index/count/rate.
Only project to microseconds at existing reporting boundaries. Reuse or promote the
existing native exact arithmetic primitive after the reader owner's commit rather
than create another clock or unrelated rational implementation. Put only arithmetic
actually needed by both owners in ScreenRecorderMedia; Capture must not depend on
CompositionAudioPlan or promote the composition model wholesale. The prototype's
Python Fraction is an oracle, not a proposed production dependency.

Coalescing requires actual evidence: exact continuity, or explicitly proven source
quantization whose round-trip relation preserves the same sample sequence. A fit to
observed numbers is insufficient. Do not infer a quantizer, use a 1ns epsilon, or
assume a rounded flag identifies the source conversion rule. Journal exact accepted
addresses without claiming physical commitment or silently converting their phase.
Lossless persistence of raw/rational fields must also survive any JSON boundary;
field encodings are part of 20b's owner review, not chosen by this experiment.

Ordinary captured-input quantizer provenance and exact canonical container projection
remain **unverified**. A larger internal rational type solves arithmetic loss, not
the MOV timescale or actual-device semantics. Strict raw-equality runs are unsuitable
for these controlled quantized inputs; rejecting ordinary capture or imposing the
probe's tiny run count does not complete the repair. Before enablement, resolve the
representation/coalescence contract through bounded evidence or reslice; no new
reader offset, stored silence, automatic timestamp fit or narrowed recorder policy.

The next bounded step is source-provenance and representation evidence: obtain a
documented source adapter contract or explicitly supplied raw-device observations,
then test canonical representation against those exact inputs. Current prerecorded
controls and older journals cannot establish that missing provenance. No live capture
is authorized; do not replace it with another fitted quantizer experiment.

Independent review confirmed the arithmetic and scope, and found two reproducibility
gaps: the binary location in the rerun recipe and missing SDK provenance. The recipe
now puts all analysis inputs together; the manifest identifies headers, toolchain
and artifacts. The matching rerun passed; review details are retained compressed.
