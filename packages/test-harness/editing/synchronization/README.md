# Acoustic offset feasibility

Waveform correlation asks whether two signals share separated acoustic anchors.
It does not identify words, assign people or declare an angle clock. Multiple
strong unambiguous anchors must agree; gated, repeated or drifted signals remain
missing or incompatible evidence. The score is not calibrated confidence.

[The estimator](offset.py) owns the bounded candidate and parameter interpretation;
[its controls](offset.test.py) independently plant offsets, ambiguity and drift.
[The receipt adapter](receipt.py) is the only bridge from an estimator result to
source-bound synchronization evidence. `receipt.make` requires an evidence id,
generation and distinct asset/stream identities; it accepts only a measured
constant offset whose three anchors satisfy the estimator's spread policy. A
refused, drifting or malformed result has no offset and cannot be consumed by
`angle.declare`. The adapter never declares an angle, retimes a source or
changes the composition.
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

[The lexical scout](lexical-scout.mjs) independently recognizes retained windows
before looking for unambiguous shared utterances. Its separate
[frozen checkpoint](../../../../specs/video-editing-feedback/assets/20-synchronization/lexical/README.md)
retains literal provider text and competing occurrences. Passing a lexical
prerequisite would still require independent timing controls and source alignment;
the scout never estimates a clock. Inference-free replay preserves every captured
raw observation and refuses a changed frozen report identity.

[Mixed-reference research](bridge.py) searches a bounded edited reference using
separate raw source clocks. [Local subanchors](local.py) and shared [recognition
capture](recognition.mjs) separate sampled acoustic support from literal provider
observations. The [retained checkpoint](../../../../specs/video-editing-feedback/assets/20-synchronization/bridge/README.md)
preserves all surrounding-window refusals alongside local observations.
[Bridge replay](bridge-replay.py) needs no inference and repeats the retained
numerical/lexical operands; its help states why full-domain selection cannot be
reproduced from cropped fixtures. None is a production synchronization fallback.
