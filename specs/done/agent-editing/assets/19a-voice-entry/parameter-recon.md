# Frozen reference-generation controls

Read-only source audit of the installed `mlx_audio/tts/models/qwen3_tts/qwen3_tts.py`,
`tts/utils.py` and `audio_io.py`, byte matched against `helpers/voice/pins.json`.
This is source behavior, not a parameter quality sweep or a public API contract.
Line references refer to the pinned runtime, not a moving upstream release.

The reference-audio-and-text branch at lines1127–1257 enters in-context generation
before sentence splitting. It passes temperature, max_tokens, top_k, top_p,
repetition_penalty, language and streaming controls. `speed`, `instruct`, `voice`,
`split_pattern` and `streaming_context_size` do not affect this branch. Additional
kwargs such as `min_p` and `repetition_context_size` are ignored even though lower
level sampling helpers support them. They must not be advertised as working knobs.

Sampling at803–860 treats nonpositive temperature as greedy and positive values
as logit scaling, without finite/range validation. top_k applies only between
zero and each codebook vocabulary size; other values disable the filter. The
first codebook has3072 entries and residual books2048, so intermediate values
affect them differently. top_p filtering at49–60 only applies strictly between
zero and one; other values disable it. These permissive branches do not establish
safe public ranges. Public validation must reject malformed/nonfinite requests
and report the settings that actually took effect.

The reference branch clamps repetition_penalty to at least1.5 at1237. Repetition
uses the recent64 first-codebook IDs; residual books do not receive that history.
The frozen requested1.05 therefore means effective1.5. `max_tokens` controls the
iteration bound at2275 (default4096, frozen256), with earlier EOS possible. There
is no text-derived bound here. Worker seed is an explicit MLX seed, not a model
generate argument. Language lookup at737–742 lowercases configured keys and
silently falls back to automatic prefixing for unknown strings; public selection
should expose actual supported keys rather than that silent fallback.

Streaming is quality-affecting: nonstream decoding at2446–2477 includes reference
codes then proportionally removes their decoded prefix; streaming at2350 onward
decodes generated codes through a different path. It is not merely transport.
Do not expose it as equivalent delivery without separate output/quality evidence.

Reference loading in utils621–688 converts file input to mono24kHz Float32. The
active call does not request normalization, cropping or segment selection. ICL
preparation638–664 encodes the whole reference; text prefill692–733 includes both
reference and requested text. No explicit reference duration bound was found.
Tokenizer stride1920 at24kHz yields12.5 codes per second;256 generated tokens
nominally span20.48 seconds before EOS/assembly effects. Configuration position
limits are not measured reference-duration support. Bound reference, text and
output work jointly, and measure actual output counts rather than inferring them
from this ratio. Canonical native reference extraction avoids adding ambient
Python decoder dependencies. The private five-second envelope remains private.

Next experimental gate: preserve frozen preset byte parity; change one supported
control at a time, verify forwarding/effective receipts and repeatable output
identity, test EOS/token termination, then assess complete-sentence quality and
reference-length memory/time before choosing public bounds. Ignored options and
streaming require explicit rejection or separately verified support. No inference
was run during this audit.
