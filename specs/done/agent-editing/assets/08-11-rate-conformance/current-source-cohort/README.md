# Current AAC source cohort

Eight fresh native processes returned complete byte-identical PCM for the retained
AAC input and source selection. Every current output also matches historical
source 0, including first and last samples; every comparison with historical
source 5 retains its 1,486 changed samples. The historical failure remains valid.
This cohort establishes no universal determinism, platform-internal cause, or
explanation for the missing original mixed-range output.

[The report](report.json) records every request, raw receipt, complete PCM
comparison and exact historical clock/format comparison. The [archive manifest](archive.json)
authenticates all eight WAVs, raw stdout/stderr, requests, the exact input,
both historical variants and the executed scratch probe in `captures.tar.xz`.
All eight outputs were retained before comparisons. No resampled or mixed request,
new build, installation, playback, model work or tolerance change occurred.

The frozen debug worker was rehashed before execution as
`8a0c7732f3c1f99e074048f2ac3b8b29beb613462fb5ce769a134b1cbfdea186`.
Command: `python3 /tmp/screenrec-current-aac.py`; the archived executed probe
records the absolute worker path and launches each JSON request separately with
a 30-second process timeout. Only input/output paths and request identity are
relocated from the historical request. The input SHA256 is unchanged. The host
was macOS 26.6.2 arm64. The other export lane confirmed both full exports and
hosts terminal before these reads; it retained only saved-file verification and
image extraction work. This is not a performance benchmark.

All receipts preserve range 123457–1812349µs, sample range [5444,79924), 74,480
mono Float32 frames at 44.1kHz, and no unavailable spans. Current decoded-frame
counts are 76,529 each versus the historical 81,920; this work does not attribute
the change or claim identical internal decoder work. Platform internal state was
not inspected, even though native worker/application reader instances are fresh.

No discrepancy reproduced within this cohort, so no production repair or broader
parameter sweep follows. Current behavior outside this exact source/request and
eight-invocation cohort remains unverified.

Independent Codex artifact-only review rehashed every archived member, recomputed
all complete PCM comparisons and checked receipt clocks/formats against the
historical archive: no findings. Execution provenance was not independently
reproduced; review performed no decoding or native rerun. Shape/diff/docs review
introduced no production surface, new policy or acceptance threshold.

[Integrated root verification](root-verification.json) rehashed the complete archive
and every member, and independently compared all eight retained current PCM
outputs with historical source 0. No additional native execution was performed.
