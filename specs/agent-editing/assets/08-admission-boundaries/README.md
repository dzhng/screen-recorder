# Audio admission boundaries

One finite public cohort confirms different source and composition readiness
boundaries. It does **not** demonstrate an output-clock, range-phase, or channel
corruption defect, and does not change admission policy.

All three synthesized LPCM CAF assets imported with their original rate/channel
metadata. Raw and project requests selected the same admitted assets through MCP
`audio.get`; successful WAVs were delivered through CLI `audio.get`. Each path
requested `[0,1000000)` and `[123457,812349)` microseconds. All placements were
unit-rate, with no audio processing.

| Source | Raw extraction | Composition |
| --- | --- | --- |
| 44100.5 Hz, two channels | Failed: integral native rate required | Ready: 48 kHz stereo |
| 48 kHz, four discrete channels | Failed: mono/stereo required | Failed: explicit map needed for more than two channels |
| 48 kHz, two discrete channels | Failed: conventional layout required | Ready: 48 kHz stereo |

These are asynchronous audio-job failures after successful import and project
editing, with `retryable:false`, no published result and no delivery. The report
preserves exact public reason strings; the `audio.get` status does not include
native error codes. No fixture failed at import or placement.

Each successful full WAV contains exactly 48000 frames; each range contains
33067, matching absolute floor-clock bounds `[5925,38992)`. Both ranges equal
those complete full-output slices byte for byte after float decoding. Every
sample in both discrete-stereo output channels matches its independently authored
channel formula in full and range, with maximum difference zero. No channel
collapse, swap, added gain, or sample-count discrepancy was observed.

This does not independently establish fractional-rate source-clock fidelity.
The current composition opener rounds native rate metadata for its selection and
resampling calculations; correct 48 kHz output length and self-consistent windows
cannot prove that rounding preserves physical source timing. No independently
correct fractional-rate conversion oracle was used. No listening occurred.

## Contract interpretation

[11a](../../slices/11a-audio-delivery.md) explicitly limits **source** extraction
to integral rates and conventional mono/stereo. The observed raw refusals agree.
Its broader sentence about unsupported layouts refusing rather than silently
remapping deserves precise scope when composition capability is documented.
The composition path currently maps two channels by index. This cohort shows
that discrete channel values survive that map; it does not assign speaker meaning
to unlabeled channels. Matching refusals solely for uniformity would be a policy
change, not a demonstrated correction.

The [project sample-clock contract](../../contracts.md) requires absolute sample
bounds and consistent range phase. Those checks pass here. Slice08's wider
admitted-format claim is still broader than the named evidence. Next work, if
prioritized, should resolve the intended composition fractional-rate/layout
contract before either adding shared refusal validation or claiming full support.
An independent source-time reference would be needed to diagnose fractional-rate
fidelity. No such policy or backend change was made in this checkpoint.

## Reproduction and retained evidence

`verification.json` pins commands, worker, source and artifact hashes. The fixture
program adapts the existing `SourceAudio` refusal cohort; its authored samples use
separate per-channel formulas. Restore `fixtures.swift` into an empty
`/tmp/screenrec-audio-admission`, run it, build the workspace, and run
`packages/test-harness/editing/audio-admission-boundaries.mjs` with the recorded
arguments and frozen worker. The harness requires a fresh output directory,
creates an isolated service home, and shuts down and removes that home afterward.
No app, capture, playback or model was used.

`report.json.gz` retains complete public replies and receipts, including the
historical scratch cache locators; they are provenance, not live dependencies.
All delivered WAVs and input CAFs are retained compressed. `range-comparison.json.gz`
contains the independent delivered-file comparison from `analyze.py`; a one-frame-shift negative control is detected for both assets. After the single cohort, oxfmt formatting and a reviewed failure-cleanup correction changed the harness source hash. Verification records both hashes; media request/comparison logic is unchanged. The existing-output collision control confirms no scratch-home leak before service startup. Report writing, service shutdown and scratch removal now use nested cleanup so each is attempted. No second media cohort was run.
This is characterization, not a regression gate that blesses today's policy.
