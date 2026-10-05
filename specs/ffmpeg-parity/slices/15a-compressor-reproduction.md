# 15a — Explicit compressor recipe

Status: recipe frozen; production not implemented. Dependency: [10](10-loudness.md).

## Research question and owner

Which one mature implementation meets the explicit compressor contract under the existing composition state/prepared-audio seam? Test pinned FFmpeg first where adequate; preserve existing native processors. This is one treatment’s reproduction, not production behavior.

Threshold/knee are dB, ratio dimensionless, attack/release milliseconds; stereo is linked. Detector is explicit input signal or selected processed tap before this processor; reject routing cycles. Detector state follows the same compiled state domains as program signal. Preserve sample count and compensate any latency.

## Frozen artifact and verdict

Distinct detector/program steps and overlap/gap cases; freeze detector tap semantics, parameter mapping/ranges, response, linked-channel behavior, context/tails and full/window/split oracle. Record candidate build/recipe/fixtures, independent expected results, precise typed fields and units, supported ranges, refusal cases and measured work. No behavior implementation begins until this measured contract is frozen in the owning production slice. Test existence does not establish response semantics.

Caller supplies treatment parameters; research selects only a compatible implementation and freezes validated mappings. Delegate internal naming and bounded fixtures. If FFmpeg is selected, slices 01–05 remain production prerequisites. A failed reproduction is unfinished and must be resliced. Actual listening is required for sound claims; numerical response is the bounded acceptance oracle.

## Frozen linked peak compressor

Use bundled FFmpeg 9.0.2 `sidechaincompress` with explicit downward mode, peak
detector, maximum stereo linking, unit input/sidechain/makeup levels and full mix.
Program and detector are separate complete compiler-declared prefix PCM inputs;
self compression uses the same input for both. No implicit RMS default survives.

Public controls: `thresholdDbfs` (20log10(.000976563)..0, approximately−60.206..0),
`ratio` (1..20), full-width `kneeDb` (0..20log10(8), approximately0..18.0618),
`attackMs` (.01..2000), `releaseMs` (.01..9000), and detector `input` or an explicit
processing tap. Threshold maps to10^(dBFS/20); knee maps to10^(fullWidthDb/20).
Above a hard knee, steady gain is(threshold/detector)^(1−1/ratio). A soft-knee
confirmation checked independent dB quadratic arithmetic:6dB full knee,3:1 ratio
and detector exactly at threshold yielded gain 9440608621 versus.9440608763.
Attack/release follow this implementation's detector convention, coefficient
min(1,4000/(milliseconds×sampleRate)); they are not a universal envelope-time claim.

**EOF contract:** unpacketized equal12000-frame calibration inputs emitted only
8192 frames. Both operands are retained. The selected recipe reshapes **both**
inputs to128-frame packets with zero padding, runs the compressor, then trims to
the declared authored frame count. Padding is internal flushing, never admitted
content or a replacement for unavailable source support. This fixed grid is part
of recipe identity. Unknown/mismatched support or detector dependency cycles
refuse; authored detector silence has zero level and release recovery.

Parent accepted exact counts/timing and ≤1e-6 linked ratio, steady gain, complete envelope, packet
and full-context crop PCM differences before confirmation.
[Held-out17003-frame confirmation](../evidence/audio-recipes/dynamics-report.json)
used unequal19/43 packet fragmentation ahead of the common128 grid, distinct
program/detector channels, and authored detector gaps. Exact count/crop/packet
equality and linked gain passed. Steady gain 3968502581 matched independent
power-law.3968502630; initial/tail and long detector silence returned to unity.
[Soft-knee evidence](../evidence/audio-recipes/knee-report.json) and
[complete operands](../evidence/audio-recipes/operands.json) are retained.

The shared state-domain/prepared-span extension must freeze detector-prefix
dependencies before production. The service cannot interpret routing or rebuild
a timeline. Structural split, retimed/repeated content and public consumer proof
remain production work; no sound-quality claim or unrequested ducking was made.

Review strengthened transition evidence with independent exponential peak-detector
recurrence followed by hard-knee power-law gain  The complete retained candidate
envelope differed at most 3.72e-9 PCM, under the already frozen1e-6 gate.
An instantaneous attack/release substitute failed, as did polarity inversion and
gross makeup on limiter operands. The finite PCM reader refused a NaN operand.
These observer corrections reused retained arrays; unchanged inference was not
repeated. Complete failure operands/reports remain in the archive.
