# Read-only reconciliation: 08 audio mixing / 11 acoustic inspection

No native/build/test runs or repository edits. This audit distinguishes verified mechanisms, missing coverage and actual unavailable behavior; it does not infer listening acceptance from PCM or images.

## 08 — what is already covered

The native production mixer and later public 09/11a paths already prove explicit constant-gain overlap, mono duplication/stereo identity, no silent-track attenuation, protected video/audio replacement, fractional unit-rate source/project clocks, selected-input poison isolation, full/range and pure-split equality, cancellation/restart and clipping reporting. Rebuilding jobs, sample clocks or a resampler would duplicate existing owners (`assets/08-current-acceptance`, `08-audio`, `11a-public-project-taps`).

Coverage now includes 48 kHz AIFF/ALAC equivalence, simultaneous 44.1 kHz mono plus 48 kHz stereo, overlapping 48 kHz AAC/MP3, complete compressed endpoints, and 44.1/48 kHz physical-segment/nonzero-origin/acquisition-gap composition. The converter buffer-state defect is fixed and retains its red case (`08-lossless-containers`, `08-mixed-rates`, `08-compressed-mix`, `08-compressed-endpoints`, `08-physical-segments`).

Long A/V drift is not still untested: the public thirty-minute export checks 120 fractional edits within one output frame, with a 100 ms-shift negative that fails every marker. Full project audio above 1 GiB is also proven with an independent complete PCM oracle, 100 clips/two tracks and bounded sampled RSS (`08-av-drift`, `11a-large-project-audio`). These do not equal24's high-track/two-hour stress gate.

## 08 — concrete remaining work

1. **Finite codec/rate coverage, not open-ended “all formats.”** The composition matrix has PCM 44.1/48 and compressed/lossless-container 48, not the corresponding 44.1 kHz AAC/MP3/ALAC/AIFF combinations. Minimal next numerical checkpoint: start with 44.1 kHz AAC/MP3 overlapping a 48 kHz source, covering full endpoint, fractional tail/range and pure split; list the remaining lossless-container combinations explicitly rather than requiring an exhaustive Cartesian product. Keep independent sample/count/channel checks. Source-only extraction does not prove composition; separately decoded lossy PCM is a mixing/clock reference, not independent decoder-fidelity proof. After that, explicitly enumerate the admitted rate/layout domain and name any remaining representative rates to verify—do not make “broader” an infinite gate or invent a new resampler.
2. **Real narration retention and joins.** The09 preview/export and 15 layer fixtures call their synthetic signal “narration”; their own docs explicitly exclude human narration. They prove mechanics, not the real-narration requirement. Reuse `fixtures/narrated-workbench`: one public video-only replacement plus explicit music overlap should retain the selected narration samples/timing and requested gains; one labeled real-speech join should retain protected neighbors. Deliver compact before/after excerpts. Independent listening remains required for audible join/clipped-phoneme quality; sample equality or a waveform is not that verdict.
3. **Origin coverage:** signed-start protection is only a DEBUG arithmetic regression, expressly not end-to-end negative-PTS media proof (`11a-signed-audio-start`). Keep it unverified; include a short genuinely admitted negative-origin fixture in the finite origin matrix if retaining that admission claim. Existing positive nonzero origins and physical gaps do not cover it. This is a coverage gap, not evidence of a current defect.
4. **Retiming and scale stay with their owners.** Rate-changing/pitch policy waits for 14 and the accepted 13 recipe;44.1→48 sample-rate conversion at unit playback rate is already implemented.24 owns general high-track/multi-hour, queue/cancellation and cache pressure behavior. RIFF capacity is explicitly bounded/refused, not silently truncated. No RF64/alternative backend is implied by this audit.

AAC retains its approved codec-only maximum AND RMS bound below 1/32768, with exact sample counts/clocks/channels/endpoints; PCM/ALAC exactness remains unchanged. The earlier strict-AAC seek mismatch, missing-tail failure and unsuccessful hypotheses stay retained. Configurable final AAC encoding rates under 09b are a different stage from08's48kHz stereo float mix and native-rate raw extraction.

## 11 — genuine remaining work is narrow

Public waveform JSON, waveform/spectrogram PNGs, absolute axes, partial edge buckets, separate channels, all 15 nested taps, outside-view FFT support warnings, size caps, cancellation/retry, historical reads/restart and sidecar cleanup are verified. A fresh image-only skill consumer located the 4 ms interval, mapped repeats and estimated channel tones; it explicitly did not listen (`11-acoustic-lifecycle`, `11-public-acoustic-images`, `11-acoustic-skill`). Old subsections saying image delivery, spectral lifecycle or fresh navigation are pending are stale historical checkpoint text.

Minimal next coverage:

- **Non48kHz public acoustic axes:** the live image/tap fixtures are fixed at 48 kHz. Waveform core does test a 44.1 kHz clock, but that is not live source-versus-project image coverage. Add one 44.1 kHz native source and its 48 kHz project occurrence to the existing public acoustic journey; independently verify impulse/time/frequency labels, partial-edge/full-range agreement and truthful returned rates. This can reuse08's next source fixture without building a new acoustic owner.
- **Actually stretched occurrences:** once14 produces verified retimed PCM, compare its public audio, waveform and spectrogram at known stretched event times, full/range/tap boundaries and repeats. Today explicit unsupported retiming is correct, not a passed stretched-inspection scenario. Denoise/transition inspection similarly follows 15a; the common reducer must consume its retained PCM, not recreate processing.
- **Retained prepared assets:** root's new 14a public preparation already exercises published asset inspection and waveform delivery for unit-rate/gain. Reuse that proof; it does not establish model-dependent DSP or retimed acoustic conformance. Only missing acoustic consumers need additional checks.

11's contract requires recording whether the agent can listen; the fresh consumer truthfully records that it cannot. Lack of listening does not invalidate the image-navigation gate, but cannot close08's real-narration audition or any speech/denoise/stretch quality gate. Peak/energy suggestions remain measurements/heuristics, not autonomous cuts.

## Minimal order

Run one bounded 44.1 kHz composition matrix plus one shared source/project acoustic-axis case; then a real-narration preservation/join artifact journey with listening separate. Wait for the separately owned stretch integration before retimed inspection/gain checks. Reconcile stale status now; reserve broad scale for24. No demonstrated new08/11 implementation defect currently justifies a new backend or wholesale rewrite.
