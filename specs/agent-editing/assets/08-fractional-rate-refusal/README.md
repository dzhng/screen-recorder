# Fractional native rates refuse before execution

Fractional-rate assets remain importable, but audio execution now requires finite
integral native rates in the supported bounds. This closes a demonstrated late
window phase defect by refusing an unsupported execution domain, not by adding an
offset or sample tolerance. Original media and discrete-two-channel mapping are
unchanged. Listening and whole08 acceptance remain separate.

## Failure and localization

The frozen diagnosis uses one 44,100.5 Hz mono CAF with impulses at native frames
88,201 and 352,804: exactly 2 and 8 seconds under the declared rate 88201/2. Predictions were
recorded before rendering. At 8 seconds, interpreting unchanged samples as 44,101 Hz would
move the impulse about 4.35 output frames earlier, so an 8.5-second project suffices.

The old full public output has peaks at frames 96,001 and 384,001 at 48 kHz, preserving their
six-second separation. It is not simply relabeling the native samples. But the
late public range has its second peak at 384,005, four frames later than the same
full-output slice; maximum sample difference is 0.6638753097504377. Exact output
length alone missed the defect.

The reader-only inspection requests 44,101 Hz exactly as production did. Full
AVAssetReader output places the second impulse at 8.000022675222784 seconds; seeking to
308705/44101, the product's bounded context start, places it at 8.000113376113921 seconds.
The four decoded-frame discrepancy exists before the second AVAudioConverter.
The internal AVFoundation algorithm is unknown; the fractional-to-integral
conversion under seeking is demonstrably not phase-stable for this fixture.
`diagnosis.md` preserves the pre-fix investigation and its limits. All red source,
full/late WAVs, predictions, public replies and pre-conversion receipts are retained.

## Owner and cache disposition

The shared SourceTrack validator checks every actual format description before
conversion to Int. Nonfinite/nonintegral rates refuse; finite integer rates must
lie in 1..192000 Hz. Raw-window validation reuses this rate check and retains its
existing channel/layout and stable-format restrictions. Composition does not
inherit those separate layout restrictions.

Project audio moves from implementation v3 to v4; movie moves from v13 to v14.
Prepared-audio request identity includes the execution manifest and therefore the
audio executor version. No separate registry or prepared-store version is needed.
Picture and raw-source identities are unchanged because their execution behavior
is unchanged. Previously published originals/receipts retain their provenance;
they cannot satisfy a new recipe with the updated executor identity.

A persistent library was seeded with ready fractional audio, movie preview and
prepared audio under the old worker/identities. After restart under the new worker
and service, identical public requests created different jobs and all failed with
an integral-rate reason and no publication. Asset metadata still reports 44,100.5 Hz.
This verifies real cache behavior, not just version constants.

## Verification

- Native common-opener regression failed on old code, then passed with the guard.
  The existing SourceAudio suite also passed full/range, selected-stream,
  physical/acquisition-gap, poison-isolation and bounded late-read checks.
- The persistent-library public audio/preview/prepare cache gate passed.
- The public admission cohort retained old raw refusals and four-channel project
  refusal. Discrete stereo still renders exact authored samples in both channels
  for full and range; fractional project full/range now refuse.
- Native audio mixing preservation passed, including 44.1/48 kHz and the 8/192 kHz
  lossless cohort, independent sums, fractional windows, tail/split and channel
  controls. No new resampler-quality or AAC tolerance claim is added.
- 39 focused core audio-inspection, preview and prepared-audio tests passed.
  Service build and the release native worker build passed. An initial build
  invocation used the package name instead of the executable product name; that
  command error is retained separately and was corrected without product changes.

`verification.json` pins native identity, commands, artifact hashes and review.
The worker is `/tmp/screenrec-integral-audio-native`; the original diagnosis uses
frozen 6663. Programs are frozen probes with their original scratch/worktree paths,
not new production interfaces. Reproduction uses a fresh scratch directory and
an isolated library. `cache-gate.mjs seed` must run against the old implementation
and worker before `verify` uses the new pair. Only verification success removes
its scratch library; failed diagnostic state is deliberately retained for inspection.

Compressed files preserve original bytes; the two tar archives contain the complete
integer and public-boundary follow-up artifacts. Media was synthesized or decoded
without capture, app launch, playback, downloads or model inference.
