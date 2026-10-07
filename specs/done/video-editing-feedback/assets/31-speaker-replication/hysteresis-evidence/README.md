# Asymmetric speaker-turn hysteresis

Status: short quality and three-speaker continuity pass; required ten-minute
four-speaker overlap fails. No provider, supported long-form envelope or runtime
closure is promoted.

This experiment distinguishes **beginning** a speaker turn from **retaining** one.
A strong onset avoids starting weak phantom slots; a lower offset can retain an
already established turn through weak overlap. It changes one conceptual factor
in the retained Nemotron observations, without model inference, reference labels
in the interpreter, padding, clipping or duration filtering. The fixed pair was
registered in [the short protocol](protocol.json) before candidate scoring.

[The interpreter](interpret.mjs) owns the state rule. Its small control test first
failed against equal onset/offset behavior, then passed with hysteresis. Read-only
[replay](replay.mjs) verifies compressed hashes, complete native Float32 bytes,
physical support, exact native comparator parity and the existing unchanged
global diarization scorer. Pass the repository root and, optionally, a hydrated
alternative-evidence folder; omitted operands default to the sibling bundle.
The replay also reproduces the planted identity-swap failure and per-repetition
overlap diagnostics. It performs no acquisition or inference.

## Parameter-effect map

The canonical numbers, complete turns and resource observations live in
[short results](results.json) and [long results](long-results.json).

| Interpretation | Short three-speaker | Short four-speaker | Longer three-speaker | Ten-minute four-speaker | Decision |
| --- | --- | --- | --- | --- | --- |
| Equal native thresholds | Pass | Missing overlap | Pass | Missing overlap | Comparator; long-form red |
| Strong onset, weak offset | Pass; more false speech | All gates pass | All gates pass; more false speech | Overlap improves but remains below gate | Provisional short winner; long-form rejected |

Retaining weak scores recovers simultaneous support while keeping the observed
identity count. It also extends false speech; it is not a general accuracy win.
The ten-minute assembly contains byte-identical repetitions of the same short
input. The first repetition passes overlap while later repetitions lose it;
the diagnostic establishes variation under long-call processing, not its cause.
Global identity confusion remains within its gate. A deliberate halfway identity
swap fails that gate while preserving simultaneous support, so local-slot timing
alone cannot masquerade as global continuity.

## Expansion and spend

Short admission reused frozen observations and performed no inference. The
retained return/silence control also passed before expansion. The separately
frozen [long protocol](long-protocol.json) authorized two sequential fresh-state
calls using shared immutable PCM, weights and the exact pinned worker. The
unedited real interview passed before the four-speaker assembly was attempted.
Both calls denied network access and stayed inside resource bounds. Their
[transport and original observations](long-observations) preserve cold load,
inference, process RSS, diagnostics and every complete raw score. The
[operand manifest](long-operands.json) owns byte identities. No media, weights,
installed runtime or build output is copied into this bundle.

Two inference attempts ran, with no retries, downloads or repairs. Their measured
combined wall time was about fifty seconds; replay and score interpretation took
well under the separate analysis budget. Cold load is retained separately from
inference. Short resource figures are inherited recorded observations, not new
measurements. Process RSS excludes separate accelerator services/system caches.

## Next hypothesis and limits

Inspect the pinned model's actual supported streaming/cache path and full-input
preprocessing before another inference run. Test one documented bounded native
streaming configuration against the frozen pair only if the owner supports it;
otherwise select a distinct local overlap-capable provider. Repeating the same
long call or tuning thresholds on the failed assembly adds no independent proof.

The attempt is interpretation-held-out only: native short failure was already
known, and VoxConverse appears in training. Repeated clips are continuity controls,
not population identity evidence. Experimental source/runtime layers are not a
sealed relocated closure. No known-person identification, word attribution,
public labeling, product promotion or user listening is established here.
