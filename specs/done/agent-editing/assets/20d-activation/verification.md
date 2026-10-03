# Final checkpoint verification

The final independent read-only review found no actionable defects after the
retained earlier findings were corrected. The default native suite, five Wire
recovery checks, actual prerecorded controller journey and macOS app build pass.
The final worker identity is in `capture-activation-final-worker.sha256`; this
isolated worker predates the parallel package metadata integration. Root must
build its combined worker rather than treating these bytes as that integration.

Run from the repository root:

```sh
swift run --package-path helpers/mac ScreenRecorderCaptureTests
swift build --package-path helpers/mac --product screenrec-native
SCREENREC_NATIVE=helpers/mac/.build/debug/screenrec-native node --test helpers/mac/Tests/recovery.test.mjs
node packages/test-harness/editing/capture-controller-offline.mjs
swift build --package-path apps/macos --disable-build-manifest-caching
```

The controller harness compiles the real controller with its existing package
input-session substitution. The prerequisite is the retained `00-corpus/a-audio.wav`.
It performs no physical acquisition or live cursor sampling. Its bounded run proves
finalizing acknowledgment, repeated sequence and completed-terminal/cancel ordering
through the actual NativeCapture, writer and publisher. The separate retained
long-controller and long-controller-cancel fixtures prove measured publication
work beyond the old stop deadline and interruption during real publication.

`capture-prefix-retryability-preservation.log.gz` records the existing fragmented
usable-prefix gate: recovery retains 1,033,333 microseconds of 2,999,970 submitted.
Zero observed frames plus a failed reader is not proof of absence. Known access/IO
errors cannot define a committed tail, even after observed frames. Other decoder
failures preserve the existing proved prefix; cleanup still requires the unchanged
clean indexed EOF and A=C=R proof. The damaged SDK controls returned completed with
no sample, so they do not claim to reproduce the failed-reader branch.

`public-audio-final` retains the matching-worker public asset/acquisition full and
off-grid PCM checks plus the native explicit one-microsecond support-mask check.
Its script retains exact requests and hashes; native selection is not a new public
acquisition-mask authoring operation. `public-audio` retains the earlier matching
finite journey, and incorrect scratch interpretations remain explicitly labeled.

The remaining parent-slice gates include public terminal failure detail, settled
cleanup replay and source-admission operational error retry classification. The
UI evidence is state/menu-model tests and compilation, with no rendered visual
acceptance. Physical camera synchronization remains outside this checkpoint.
