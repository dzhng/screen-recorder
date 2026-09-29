# Frozen phrase timing evidence

The comparison target is truthful, calibrated timing around the frozen entrance
and exit: show original context, the prior room-tone candidate and the current
shortened candidate on comparable axes. It does not select a better-sounding voice
or accept the pending entrance. No audio bytes were changed or generated.

[Measurements](measurements.json) pin the three inputs and boundary frames.
The original source context starts at source time71.5s; displayed timestamps are
local to each retained WAV. Edited boundaries align to the start of their120-sample
crossfade; the original row uses the corresponding context position. This is an
explicit edit-coordinate comparison, not fitted signal alignment or independently
labeled phoneme timing. Different spoken content is not a waveform error.

The [entrance overview](entrance.png) and [detail](entrance-detail.png) show changed
post-boundary signal timing with identical preceding context. The [exit overview](exit.png)
and [detail](exit-detail.png) show identical prior/current windows after accounting
for the removed2880 frames. The complete97952-frame suffix remains sample-exact;
this rechecks the retained acceptance-preserving edit without another inference run.

Waveform amplitude and spectral scales match across rows. Entrance amplitude limits
are±0.10 and exit±0.05, so compare their labeled amplitudes rather than visual height
across figures. Spectra use one-sided Hann power density,512-sample windows and
64-sample hops at24kHz, with the same−110..−35dB full-scale-squared/Hz range.
Black is the displayed floor, not proof of silence. A21.33ms spectral window cannot
resolve a5ms crossfade precisely; the waveform detail shows that interval instead.

The [first unprimed review](initial-visual-review.md) found an unexplained green
marker and limited fine timing visibility. Explicit markers and±25ms detail views
address both. The [final image-only review](final-visual-review.json) opened all four
current figures and found no clipping, label collisions or unclear boundary bands;
root inspection agrees. Independent code review verified hashes, mapped boundaries,
window measurements and exact suffix; its log is retained. No listening, click,
identity, intelligibility, word retention or naturalness verdict follows from these
plots. Whole18/19 remains open, including the final word candidate and managed origins.

Reproduce with cached research dependencies (no production dependency added):

```sh
uv run --offline --with matplotlib==3.10.8 --with numpy==2.3.5 --with scipy==1.18.1 python specs/agent-editing/assets/18-voice-boundary-timing/plot.py
```

The plotting script is frozen research evidence beside its inputs' provenance;
it is not a second product acoustic renderer. Existing public acoustic inspection
continues to own agent-facing waveform/spectrum delivery.
