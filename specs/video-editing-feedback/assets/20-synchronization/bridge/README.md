# Mixed-reference bridge — local evidence only

An edited mixed reference can contain an original microphone signal even when
isolated microphones share no usable waveform. These protocols separate full-domain
candidate discovery, strict surrounding-window admission and a separately frozen
local hypothesis. None establishes a raw-to-raw clock or authorizes an edit.

[The original acquisition protocol](protocol-r1.json) hit the native selected-PCM
owner's duration bound before producing PCM; [the refusal](acquisition-refusal)
remains retained. [The revised frozen protocol](protocol.json) uses the existing
streaming source-audio owner and an explicit source-rate conversion. [Native
inventory](inventory) and [acquisition receipts](acquisition) preserve original
identities, selected sample support, runtime interpretation and resulting hashes.
The source-audio receipt has no hash field; WAV identity is independently hashed.
A successful native WAV was reused after that receipt interpretation error, without
another decode. The runnable acquisition runner requires a fresh output directory.
External original files and full-domain temporary search vectors are not uploaded.

[The broad scout](scout.json) keeps every energy-selected window and competing
coarse peak, including refused candidates. Two windows fail coarse discovery and
all seven strict surrounding 20-second comparisons refuse the unchanged acoustic
gates; actual reference edits and missing anchors prevent a constant clock. No threshold was relaxed or outlier discarded.

[The local protocol](local-protocol.json) was frozen before processing the exact
middle four seconds of every coarse-admitted case. [Local results](local.json)
admit four cases acoustically and refuse three. [Independent recognition](recognition.json)
then observes shared unique phrases on both sides of each acoustically admitted
pair through first-class Parakeet. Literal requests, responses, transcripts and
logs remain alongside the report. This is provider-observed lexical evidence,
not complete-utterance or phonetic ground truth. Three disjoint subanchors support
sampled local offsets; unsampled instants have no synchronization guarantee.
Every original long-span and surrounding-window refusal remains in force, and
all source-level global clocks remain refused.

[Retained fixtures](../../../../../fixtures/video-editing-feedback/synchronization/bridge/README.md)
keep both successful and refused PCM operands through the existing WAV/LFS owner.
[The bundle](bundle.json) fixes each retained artifact's identity.
[Inference-free replay](../../../../../packages/test-harness/editing/synchronization/bridge-replay.py)
verifies those bytes, repeats strict/local numerical results, checks original
clock origins and signed mappings, and recomputes lexical candidates from captured
observations. It does **not** recreate the full-domain energy selection or coarse
competing search from cropped fixtures: that needs the external original acquisition.
Run the runner's help with a prepared NumPy/SciPy Python runtime using `-I -B`.

[Replay falsification](replay-falsification.json) catches a reversed source-clock
sign and omitted pre-work identity verification. [Focused verification](verification.json)
records controls, original waveform preservation, retained replay and narrow lint.
The authored source-rate delay control preserves the original two-millisecond
precision bound; missing anchors, repeated peaks, continuous drift and
piecewise edits still refuse. [Independent review](review.md) is scoped to this
research checkpoint. Slice20 remains open; no production estimator or relationship
owner changed.

[Global bridge refusal](global-refusal.json) is an additional replayable gate over
the retained local results. The two admitted `grahamRaw` windows differ by
3,998,912 samples at 16 kHz, far beyond the frozen 32-frame (2 ms) tolerance, so
one constant raw-source offset is refused. The replay test is included in the
test-harness package suite and records `piecewise-local-only` as the next action;
it does not promote a session clock or change the production relationship owner.
