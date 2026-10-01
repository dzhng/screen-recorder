# 12h — Recognize the unchanged retained sentence

Status: bounded additional case planned; no recognition executed yet. Broader
[12](12-speech-evidence.md) remains open and the selected baseline is unchanged.

## Contract

Determine whether the selected Parakeet v2 recipe represents the independently
human-confirmed opening `um` in the entire existing seven-second sentence WAV.
This tests evidence quality, not permission to remove speech. The toolkit makes
zero editorial decisions. Preserve all originals, human marks, accepted cuts,
voice/noise/ambience results and prepared model homes.

The [investigation](../assets/12h-retained-sentence-recognition/investigation.json)
owns exact input, mark, raw-result and alternate-result identities. The target
was already omitted from raw recognition of the full narration; it occurs about
50 seconds into that input. Leading padding has no supported initialization
boundary hypothesis and is excluded.

## Fixed input and owner

Use the entire unchanged [original WAV](../assets/12d-complete-sentence/original.wav),
SHA256 `38ad96206360f48ece6ded712f0a1d72b18efb9eae3dfd5e01b49721e67c8dfb`:
mono Float32, 48 kHz, 342,720 frames. Read its full local support `[0,7140000)`
microseconds; no new crop, caller padding, gain, denoise, synthesis or prompt.
Map returned local times once by adding `50518675` microseconds. The original
recording origin `48675` must not be added again.

Reuse the unchanged frozen `0a9cd72…6928` worker and selected FluidAudio 0.15.7
revision `41540ea…0612` / Parakeet v2 model revision `ee09c569…6d39`, digest
`4fe3f59c…6824a`, int8 encoder, batch TDT/default configuration. Verify exact
source/runtime identities and all registered model bytes before inference.
Use the [genuine prepared source](../assets/23n-parakeet-model-readiness/verification.json)
through the existing Models owner into an isolated owned namespace. Preparation
may adopt verified local files only: no downloads or fabricated/copied readiness
receipt, no changes to the accepted source or prepared home. No worker build.

Before inference, qualify actual source support with metadata and verify the
selected recipe. Preserve the WAV header and Float32 data-payload hash, request,
actual native support, model status/receipt and producer authority. The shared
audio reader performs the required conversion. Expect 114,240 mono 16 kHz samples
but retain the actual reported count. Refuse unsupported/unavailable support,
unexplained counts or recipe mismatch. If the unchanged owner does not expose
internal PCM bytes, disclose that limit instead of inventing an admission hash.

## One execution and evaluator

Execute exactly one offline `speech.transcribe` with a fresh decoder and a fresh
owned output. Keep the existing 180-second native ceiling and 8 MiB response
bound. Record decoder PID at launch, stdout/stderr, complete response and raw
ASR text/tokens/words, actual close event and before/after preservation hashes.
Forward only declared source metadata and the one transcription operation.

Test exact normalized `um` before `So`; `uh` is not recovery. Report its marked
end separately. Its onset is clip-censored and must never be scored. Require
recognized protected `paragraph`/`this` and middle `uh`; use their six existing
independent edges with the existing unique-word matcher and unchanged 100 ms
median / 250 ms p95 criteria. Report every signed error and missing/ambiguous
match. These six edges are a sentence subset, not the historical eight-edge
cohort; `workbench` lies outside this input. Preserve the inherited thirteen-word
sentence sequence as a regression diagnostic, not independent spelling truth.
Use the saved omission as a negative evaluator control without repeating inference.

One result, omission, regression, error or timeout ends the case. No retry,
parameter search, arbitrary model swap, repair-driven tuning or baseline adoption.
Use focused syntax/lint/format and evaluator checks, then local review and choices.

## Interpretation and closeout

This is an additional fixed sentence case, not a proven single-variable causal
experiment: container, resampling, context and long-form chunking differ from the
historical full-input run, whose internal PCM and per-chunk outputs are missing.
A positive result would establish local representation only; a negative result
would preserve a specific omission. Neither identifies the historical cause,
selects a replacement recipe, proves general recall or closes 12/full release.

Own the bounded producer/verifier, leaf and compact assets only. Root owns shared
hubs and integration. Preserve runtime/model homes and raw outputs outside Git;
bank their exact authority, full compact exchanges/results, meaningful checks,
review and [choices](../assets/12h-retained-sentence-recognition/choices.md).
