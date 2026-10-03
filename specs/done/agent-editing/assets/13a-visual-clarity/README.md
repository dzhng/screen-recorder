# Stretch evidence clarity

These scientific panels supplement the immutable
[endpoint evidence](../13a-endpoint-verification/README.md). They make separated
impulse responses, tone-edge shape and authored source guards readable. They are
qualitative evidence, not new listening, word-preservation or production acceptance.
The earlier full-file overviews and center spectra remain useful context.

Each endpoint pair has aligned axes covering both reported extents above 1e−7,
with a 10 ms margin. Exact and diagnostic tail traces occupy separate panels;
gray marks data outside each file. The tail remains a separate recipe, not proof
of content missing from the exact output. Extents come directly from the existing
measurement report; the plotter does not remeasure support or pitch. Envelope
bins keep peak absolute samples, so impulses survive display reduction. The
1e−9 floor is a display limit, not zero. Frame extents use the aligned output
clock; horizontal axes use milliseconds relative to the relevant boundary.

Tone panels show every sample in the first and last 20 ms on one amplitude
scale. Source guard sheets show all seven authored phrase selections, with
manual marks and the selected 25 ms guard shaded explicitly. Their ±25 ms
uncertainty and lack of complete word-span labels remain visible. Guard
positions are only marked on the source: output word positions are not inferred
by dividing source coordinates by speed.

Retained speech comparisons cover phrase 0, phrase 3 and the clean whole-file
control at reference, 0.8× and 1.25×. Other rendered speech PCM and 0.9× scratch
outputs were unavailable; they were not rerendered. The all-source guard sheets
cover the missing phrases' authored input placement without pretending to show
new output evidence. The clean control has no guards or external neighbors.

## Provenance and reproduction

[plots.json](plots.json) records every admitted PCM hash and image hash.
The tone samples come from the existing 13b archive and match the historical
13a evidence hashes. Speech WAVs are the retained historical auditions, checked
both as files and decoded Float32 payloads. The unchanged original narration is
decoded using the historical command and must match the historical PCM hash.

The isolated endpoint scratch files were missing. After explicit authorization
for only this recovery, [recover.py](recover.py) built the frozen research C++
against the checked-in, hash-checked headers in a temporary directory. All 64
reconstructed exact/tail outputs matched their original hashes before admission.
[recovery.json](recovery.json) identifies them; compressed PCM is retained here so
ordinary plot reproduction needs no synthesis or build. This does not change the
recipe or add production/native-worker artifacts.

From the repository root, regenerate only the plots with cached dependencies:

```sh
uv run --offline --with matplotlib==3.10.8 --with numpy==2.3.5 python specs/agent-editing/assets/13a-visual-clarity/plot.py
```

[comparison.json](comparison.json) records actual prior/candidate dimensions and
byte differences. Pixel distance would conflate deliberately changed framing and
panel arrangement with signal, so direct image inspection owns the comparison.
Fresh visual and code review results are in [review.md](review.md);
[choices.md](choices.md) records the reviewed evidence decisions.
