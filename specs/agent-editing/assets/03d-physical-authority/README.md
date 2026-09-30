# Physical support is authoritative

The independent AVFoundation probe establishes that occupied container CMTime,
full decoded PCM and original Float32 WAV payload agree for all three fixtures.
There is no support ambiguity to resolve before the exact-admission cutover.
The [authority table](authority.json) records exact clocks and complete PCM hashes;
the [public trace](report.json.gz) retains real requests, receipts and metadata.
The [original placement failure](../03d-exact-admission-red/README.md) remains red.

| Input | Exact end (µs) | Admitted end (µs) | Original / raw inspection / extraction frames |
| --- | --- | --- | --- |
| Accepted A, 48 kHz | 15404875/3 | 5134958 | 246478 / 246477 / 246478 |
| 44.1 kHz, nearest down | 441170000/441 | 1000385 | 44117 / 44116 / 44117 |
| 44.1 kHz, nearest up | 441160000/441 | 1000363 | 44116 / 44116 / 44116 |

Every delivered raw sample equals the corresponding original sample exactly.
The omitted final sample is nonzero; synthetic fixtures end in 0.8125. Complete
extraction and AVFoundation decoding equal every original PCM byte. Thus the
explicit floor selection remains correct, but omitted raw audio does not currently
mean complete physical support for downward-rounding inputs.

`audio.extract` has a whole-WAV path that retains physical frame counts. Its success
is not evidence for `audio.get`, which resolves an omitted range through admitted
bounds. The cutover must preserve extraction's complete PCM and fix raw inspection
through exact admission and selection; no output padding or count override is
justified by these measurements.

## Reproduce the frozen red

Use Node 24 and a built repository runtime. This fixture starts only an isolated
service and compiles its small AVFoundation reader in a fresh `/tmp` directory.
It does not build or replace production native code, touch installed app state,
load models, play media or capture new media.

```sh
SCREENREC_RUNTIME_ROOT=/absolute/path/to/built/repository \
SCREENREC_NATIVE=/tmp/screenrec-exact-native-14f-build/debug/screenrec-native \
node specs/agent-editing/assets/03d-physical-authority/probe.mjs /tmp/fresh-authority-output
```

The [runner](probe.mjs) generates deterministic Float32 fixtures, retains the
accepted A by hash, compiles [Probe.swift](Probe.swift), compares complete physical
PCM, then exercises public import/discovery, omitted raw inspection and extraction
independently. Its assertions deliberately preserve the frozen worker's red;
new-code green proof belongs to the cutover gate, without overwriting this evidence.
The two generated44.1k inputs are also retained as `44100-round-down.wav.gz` and
`44100-round-up.wav.gz`, matching the source hashes in authority.json, for the
new-runtime regression gate. Other output media is reproducible and stays in
scratch; accepted A remains at its existing canonical path. The trace was measured against native SHA-256
`0525dfb9` prefix, with unchanged production TypeScript from the pre-cutover runtime.

This proof covers zero-origin single-stream WAV admission. Unequal stream starts,
fractional shared origin, sparse gaps, signed wire/domain validation and downstream
preservation remain the explicit [03d](../../slices/03d-exact-media-admission.md)
cutover gates. No new quality or listening verdict follows from PCM equality.
