# Acoustic offset feasibility

Waveform correlation asks whether two signals share separated acoustic anchors.
It does not identify words, assign people or declare an angle clock. Multiple
strong unambiguous anchors must agree; gated, repeated or drifted signals remain
missing or incompatible evidence. The score is not calibrated confidence.

[The estimator](offset.py) owns the bounded candidate and parameter interpretation;
[its controls](offset.test.py) independently plant offsets, ambiguity and drift.
[The case-selected runner](research.py) owns usage, native acquisition, lossless
fixture wrapping and replay. Use an existing prepared Python runtime with NumPy
and SciPy; `-I -B` isolates it from ambient packages and avoids runtime writes.
Generated operands and native calls go to a new explicitly selected directory.
Replay verifies every numerical field against the supplied frozen receipt (or the
feature-owned original); elapsed time alone is excluded. A refused comparison
retains its candidate output. Both native paths validate their work envelope first.

[Retained fixtures](../../../../fixtures/video-editing-feedback/synchronization/README.md)
keep input bytes independent of parameter tuning. [Frozen research](../../../../specs/video-editing-feedback/assets/20-synchronization/README.md)
records refused real comparisons and the justified next hypothesis. This owner
is an experiment, never a production synchronization fallback.
