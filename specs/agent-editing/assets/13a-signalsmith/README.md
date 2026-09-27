# Signalsmith exact-length candidate

Status: numerical candidate reproduced; **not accepted for production**. Speech
listening, protected-word joins, short selections and independent visual review
remain open. This experiment does not change the selected-duration/source-isolation
contract and does not establish speech quality from impulse energy or peak position.

## Research contract and reproduction

The incumbent is the frozen native/atempo experiment in [13](../13-stretch/README.md).
The hypothesis is that explicit latency and endpoint handling can deliver the
requested duration without the wrapper truncating a raw processing tail. The
cheapest first test used two impulses at the exact first/last selected samples.
Only after those results improved did testing expand to the original seven-case,
four-rate matrix, source-poisoning, and four impulse phases. No performance
threshold or new listening threshold was introduced.

Generate the same reference inputs, then run the candidate in fresh directories:

```sh
node packages/test-harness/editing/stretch-reproduction.mjs --case all --out /tmp/stretch-reference
node packages/test-harness/editing/stretch-signalsmith.mjs /tmp/stretch-reference /tmp/stretch-signalsmith
```

The candidate validates reference input hashes and its vendored dependency hashes
before running. The bounded short-window comparison is separately reproducible:

```sh
node packages/test-harness/editing/stretch-short.mjs /tmp/stretch-reference /tmp/stretch-short
```

Source/runner hashes, compiler flags, configuration, output hashes,
resource observations and the reference report hash are in [report.json](report.json).
The raw reference report's incidental runtime fields may differ on regeneration;
matched source PCM and experiment identities, not timing noise, own comparison.
Representative context WAVs are frozen here for audition; full exact and raw-tail
outputs regenerate with the runner. All processing is local and opens no speakers.

## Candidate and distribution

[Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch)
reports separate input/output latency and documents fixed-length processing.
The pinned source's `exact` method provides an even more direct recipe; its
implementation was inspected instead of assuming the method name proved timing.
Equal selected/output frame counts bypass the processor and return exactly the
selected PCM, including very short selections. The identity assertion failed on
the pre-bypass output and passed after this explicit recipe change. For non-unit
retiming, the research wrapper uses default mono 48 kHz configuration, fixed random seed,
pitch factor one, the portable FFT backend and `-O2` without fast-math.

`exact` performs an output seek to align the start, processes the finite selected
input, then flushes the remaining output with its own endpoint treatment. Its
seek/flush code subtracts reflected residual output to shape the boundaries.
That is a substantive algorithm choice, disclosed here: it is not merely dropping
a fixed prefix or cropping a tail. The wrapper supplies only selected source PCM
and asks for the already-declared output frame count. It adds no surrounding real
speech, output zero padding, wrapper crossfade or post-hoc duration crop. A separate
`tail` mode follows the upstream seek/process/flush example for support diagnostics;
it is not treated as the exact mode's missing audio or an identity oracle.

The minimal unmodified headers and both MIT notices are frozen in the research
runner's [vendor directory](../../../../packages/test-harness/editing/stretch/vendor).
[The dependency manifest](../../../../packages/test-harness/editing/stretch/vendor/sources.json)
pins both Git commits, included-file hashes and backend. The MIT notices must
accompany copies/substantial portions if the code is later distributed. No product
target currently links these headers.

[Rubber Band's integration documentation](https://breakfastquay.com/rubberband/integration.html)
describes offline timing management, but its [distribution options](https://breakfastquay.com/rubberband/license.html)
are GPL or commercial licensing. No commercial license was bought and no Rubber
Band runtime was adopted. Signalsmith was selected for this bounded next experiment,
not declared the final engine on the strength of its license.

## Parameter-effect map

| Mechanism                           | Measured effect                                                                                                                                           | Disposition                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Native duration crop                | Correct retained count and tone pitch; nonzero raw tail and context-dependent impulse movement                                                            | Baseline, not accepted endpoint recipe                                               |
| Native zero/real context            | Zero context did not establish a universal shift; excluded real context changes retained samples                                                          | Rejected as a transparent compensation method                                        |
| Signalsmith `exact`, default preset | Exact requested counts; tone error below 1%; isolated-source and untouched-neighbor checks pass; edge peak displacement materially smaller in this corpus | Provisional numerical candidate; listening gate open                                 |
| Signalsmith raw seek/flush          | Explicit pre-roll and tail expose support behavior independently of exact endpoint shaping                                                                | Diagnostic only                                                                      |
| Default preset on 10 ms input       | `exact` refuses the input; wrapper returns failure before publishing output                                                                               | Unsupported; short-selection treatment must be researched before general integration |

The measured default input/output latencies are each 2880 samples. They are
queried from the engine, not hard-coded corrections. Phase-zero leading impulses
land at frame zero for all four speeds. Trailing impulse peaks move by at most
17 samples for that case; the maximum observed peak displacement over all tested
phases is about 33 samples. Full support windows and the explicit numeric support
threshold are recorded, not just the largest peaks.

Endpoint shaping changes non-unit transient amplitude. That is not proof of
missing speech. The unit-rate identity bypass avoids any such transformation.
Short-input refusal is not permission to silently add a minimum editable duration.
The [short-window report](short.json) records the default-versus-256 comparison:
all tested 10 ms cases processed with the smaller window, with a maximum measured
1 kHz pitch error about 0.035%; the long 440 Hz regression stayed below 0.001%.
The 100 ms real excerpt establishes processing and source isolation, not word
preservation. Five-millisecond failures remain explicit and publish no output.

No automatic preset-switch or minimum-duration policy is accepted. The next
quality question is whether this smaller window preserves the protected spoken
words and natural joins that the default candidate must also pass. Freeze any
accepted window-selection rule with those results instead of treating it as
unreviewed implementation discretion.

## Verification and remaining gate

The matched matrix passed exact count, unit-rate identity, tone pitch, silence, finite samples,
excluded-source poisoning and byte-identical untouched neighbors. Endpoint phase
cases retain separate exact/raw-tail measurements. The short experiment records
56 case/rate/configuration results, including explicit unsupported outcomes. A deliberate octave mutation
failed the pitch check; the restored matrix passed. One initial diagnostic dispatch
ran before compilation completed and launched no processor; it supplies no quality
evidence. Measurements are single runs, not a performance or repeatability claim.

No independent listening occurred. The real rushed-speech excerpt remains an
unverified pace candidate, and the short-phrase joins lack newly auditioned
protected-word labels. Independent visual critique is also pending. Keep slice
13a and retiming integration open; numerical observations do not close those gates.
