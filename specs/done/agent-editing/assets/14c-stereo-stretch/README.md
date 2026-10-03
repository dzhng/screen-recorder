# Linked stereo through bounded interleaved files

The file adapter processes two channels with one upstream Signalsmith instance,
preserving its shared energy analysis and phase coupling. One interleaved frame
page serves the indexed channel views. File offsets and counts remain frames;
source validation and scratch-output publication retain the existing ownership
contract. The mono research array seam is unchanged.

[The evaluator](../../../../../packages/test-harness/editing/stretch-stereo-parity.py)
compares complete outputs with [a direct upstream reference](../../../../../packages/test-harness/editing/stretch/linked-reference.cpp)
that holds separate planar channel vectors. It does not call the file accessor or
shared recipe helper. [Frozen reference hashes](reference.json) bind the inputs,
selection and requested count as well as each complete output. Default validation
requires these references; recording a new reference is an explicit separate mode.

## Evidence and limits

[The stereo report](report.json) covers correlated/anti-phase inputs, distinct
channel tones, overlapping mixtures, distinct channel events and a silent lane
at slower and faster rates. Every byte equals the linked reference. Identity
preserves each lane's signed zeros and subnormal bits. Non-frame-aligned page
positions, excluded-source NaN/Inf poisoning and a nonfinite right-channel sample
exercise selection and layout. The event lanes keep their order and agree exactly
with the reference, including its measured endpoint timing.

A control using two independent mono processors differs from linked output by up
to about 0.0969 in the overlapping-mixture fixture. The proof explicitly requires
this distinction, so a replacement with independent engines cannot pass unnoticed.
A swapped-output-lane mutation also fails the complete-reference comparison.
No downmixing or independent-channel processing is introduced.

The 60-second and 600-second stereo runs both equal the complete planar reference.
Separate native processes keep the file worker near 7 MB resident memory while the
planar control grows to about 521 MB. [The mono regression](mono-regression.json)
retains all accepted speech and endpoint hashes, long-run equality and error
contracts after the shared accessor changes. These are process-memory
measurements, not bounds on total filesystem cache or scratch disk usage.
Cancellation after output begins, a real closed-descriptor write failure and
invalid-input refusals leave no published output or caller scratch file. The
existing caveat remains: callbacks do not interrupt blocked OS calls or every
upstream internal loop.

## Correlated channels are a measured upstream behavior

Perfectly matching input channels do not produce perfectly matching output lanes
in this upstream recipe. Anti-phase input shows the same signed residual. This is
also present in the direct planar reference, with complete file/reference parity:

| Speed | Maximum signed lane difference | Relative to signal peak | Location in output | RMS difference |
| --- | --- | --- | --- | --- |
|0.8×|0.0005315915|0.25933%|frame 288, 6 ms|0.0000067761|
|1.25×|0.0001252145|0.04261%|frame 1471, 30.65 ms|0.0000060636|

The corresponding signed correlations exceed 0.999999998. These measurements do
not establish audibility, stereo naturalness or perfect coherence. No DSP setting
was adjusted to remove the residual, and accepted mono listening is not a stereo
listening verdict. Any new perceptual claim still needs its own evidence.

## Experiment and review record

[The attempts](attempts.json) retain the initial stereo refusal and the failed
auxiliary ideal-coherence assumption. The first linked result already matched
upstream byte for byte; an invented absolute lane-equality threshold then failed.
That threshold was not the port's fixed evaluator and did not describe upstream's
behavior. It was removed as an invalid idealization, with the observed differences
retained as telemetry. Exact linked-reference equality stayed unchanged.

The promoted change is channel-aware file addressing plus one engine's channel
configuration. No vendor source, FFT configuration, default preset, seed or pitch
factor changes. Mono hashes remain fixed. Independent review found no remaining blocking code issue and inspected the
stereo reference and full mono-regression evidence; it did not independently
rerun the binaries. The shared recipe and indexed page remain single owners.
The configured Codex CLI model was already known to be rejected by the account,
so that unavailable review supplies no evidence. No native-worker capability,
public retiming admission, new prepared-audio owner or pitch-follow implementation
is included. [The manifest](manifest.json) binds source and evaluator identities.

Reproduce after building both isolated products, always choosing fresh scratch
paths rather than replacing retained workers:

```sh
swift build --package-path helpers/stretch --scratch-path /tmp/stretch-stereo-build -c release --product StretchFileParity
swift build --package-path helpers/stretch --scratch-path /tmp/stretch-stereo-build -c release --product StretchParity
python3 packages/test-harness/editing/stretch-stereo-parity.py \
  /tmp/stretch-stereo-build/release/StretchFileParity \
  /tmp/stretch-stereo-build/release/StretchParity /tmp/stretch-stereo-proof-run
python3 packages/test-harness/editing/stretch-file-parity.py \
  /tmp/stretch-stereo-build/release/StretchFileParity \
  /tmp/stretch-stereo-build/release/StretchParity /tmp/stretch-mono-regression
```
