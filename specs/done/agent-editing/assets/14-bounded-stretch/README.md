# Exact stretch with bounded file access

The isolated mono preparation seam retains upstream `exact()` and its accepted
endpoint behavior while replacing duration-sized input/output arrays with two
fixed pages. No application capability, worker protocol, preparation registry or
DSP setting changes. The [recipe adapter](../../../../../helpers/stretch/README.md)
explains the file ownership contract; [the proof runner](../../../../../packages/test-harness/editing/stretch-file-parity.py)
owns the cases and asserts their outputs.

Upstream scans the input for energy, reads it again during synthesis, and revisits
output for reflected-tail subtraction. Indexed `pread`/`pwrite` access preserves
those operations. Splitting the processing calls would change their global
rounding and energy domain. Mapping the whole files would not make resident
memory as explicit. Neither alternative was promoted or benchmarked.

## Fixed comparison and result

The promotion rule is complete byte equality with retained accepted speech and
endpoint hashes, plus complete equality with the whole-array C adapter for long
runs. Cancellation/error returns must not publish a result or leave the caller's
partial file. Process memory is measured in separate native processes at two
input durations; the evaluator allows bounded measurement noise, not linear
buffer growth. No listening verdict or tolerance is changed.

[The raw report](report.json) records successful checks through the Swift file
entry point. All four corrected accepted speech WAVs reconstruct byte for byte;
all frozen leading/trailing impulse phase hashes match; identity preserves signed
zero and subnormal bits. Excluded-source NaNs do not enter the selected run.
The 60-second and 600-second repeated-speech inputs both produce complete outputs
identical to the whole-array control. The 600-second output hash is
`4b3bb100cf2c7d95bb94ac48e38ba1bd798bbc728b9e518e2448d5fdcf50ece8`.

The native file worker stays near 7 MB resident memory at both scales, while the
array control grows from about 28 MB to 262 MB. These are one-run process RSS
observations, not an OS page-cache or total-system-memory claim. Output scratch
storage necessarily grows with the requested duration.

Cancellation passes before work, during validation, during the upstream energy
scan, and after output PCM has been written. A real descriptor closure during
synthesis produces an IO failure. Both leave neither published output nor the
caller's partial file. Descriptor checks cover inode aliases, invalid/read-only/
append/nonempty outputs and preserve source bytes and both descriptor positions.
A caller-owned existing destination survives a failed publication attempt.

## Experiments and review

| Change | Observation | Verdict |
| --- | --- | --- |
| Fixed-page generic upstream accessors | Accepted speech, identity and ten-minute output exactly match the pointer adapter | Keep |
| File entry through Swift with caller-owned scratch publication | Constant-scale process RSS; cancellation and real IO failure clean up | Keep |
| Shared representable-seek guard | Unsafe extreme ratio refuses before upstream float-to-int conversion; accepted hashes unchanged | Keep |
| Flip one output-tail bit | Frozen-hash assertion fails | Evaluator detects corruption |
| Suppress cancellation request | Expected failure/publication assertion fails | Evaluator detects lost cancellation |

[Mutation records](mutations.json) include the invalid initial wrapper attempt:
resolving its symlink prevented the intended mutation from being applied. Separate
wrapper files corrected the experiment. This was a harness setup failure, not a
surviving processor mutation.

Shape review kept one recipe helper and one vendored implementation; the array
seam remains the small research control. Independent code review found the unsafe
seek conversion and verified its shared guard. Follow-up independent review found
no remaining blocker and inspected the final speech/scale/failure evidence; it did
not independently rerun the tests. The additional endpoint hashes were then
checked by the same runner. The requested Codex CLI review could not run because
the account rejected its configured model; that failed invocation supplies no
review evidence.

## Limits and next seam

Input remains mono native Float32 at 48 kHz with pitch factor 1. The caller must
keep input immutable and own scratch-file disposal/publication. The file API
retains upstream signed-int frame counts; it adds no research-duration refusal.
An unrepresentable derived seek returns unsupported in both adapters. Upstream
floating-point sample-position rounding is unchanged, including long inputs.

Cancellation checks occur at page IO boundaries. They do not interrupt a blocked
system call or every internal upstream loop, including its zero-input flush work;
no universal wall-time latency guarantee is claimed for arbitrary rate extremes.
The bounded proof is scoped to preparation, not public job deadlines or shutdown.

Stereo and pitch-follow remain independent prerequisites. Extend recipe execution
only after testing upstream's joint multichannel behavior and explicit pitch
semantics; do not silently run two mono engines or widen admitted formats. Public
adoption must still bind this seam through existing prepared-audio ownership and
verify complete retained-run, pure-split and short-query behavior.

Reproduce with fresh output and scratch build directories (never overwrite a
frozen worker):

```sh
swift build --package-path helpers/stretch --scratch-path /tmp/stretch-file-build -c release --product StretchFileParity
swift build --package-path helpers/stretch --scratch-path /tmp/stretch-file-build -c release --product StretchParity
python3 packages/test-harness/editing/stretch-file-parity.py \
  /tmp/stretch-file-build/release/StretchFileParity \
  /tmp/stretch-file-build/release/StretchParity /tmp/stretch-file-proof
```

[The manifest](manifest.json) pins changed source/evaluator identities and the
unchanged vendored manifest and frozen listening worker. Generated scale media
stays in scratch; the runner reproduces it from the retained speech source.
