# 04 — Select a verbatim local speech engine

Status: preparation/evaluation harness integrated; eight evaluator tests pass.
Independent review found repeated-token alignment and raw-report filename defects;
both are fixed, with red/green coverage and an actual offline synthetic inference
for the filename case. Human fidelity and production-engine selection remain open.
Evidence: [preparation](../assets/speech/preparation.json),
[raw/normalized report retention](../assets/speech/filename-check.json).
Dependencies: 00. Run `bun run lab:speech-eval --help`; the
[evaluation protocol](../../../packages/test-harness/speech/protocol.md) defines
fixture annotation and interpretation. Both pinned candidates now pass actual offline synthetic inference.
[Parakeet preparation](../assets/speech/parakeet-preparation.json) and
[generated word report](../assets/speech/parakeet-synthetic.json) supersede its
earlier preparation failure. Neither candidate is selected for production yet.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

One local engine yields usable filler/phrase timestamps for actual edits, with no cleanup model.

Reproduce the upstream FluidAudio Parakeet-v2 and WhisperKit large-v3-turbo batch examples in bounded probe runners. Acquire pinned model assets, record hashes/runtime/license, disable inference network after setup, and use the same final-model configuration intended for production. Do not integrate both into a model picker. See research.md for primary sources and bounded alternatives.

## Runnable checkpoint

Run bun run lab:speech-eval on manually labeled real narration: short canonical edit fixture, at least 40 fillers across held-out clips, repetitions, false starts, silence, technical names and a five-minute walkthrough. Record full transcript, word ranges, filler precision/recall, timing errors, RSS and speed. Audition removals at returned ranges. Synthetic narration is not a substitute.

## Acceptance

Apply verification.md thresholds, including intact neighboring speech. Every canonical filler must survive. No model chosen solely by vendor throughput or overall WER. Setup failure or absent real fixture is reported pending. Choose the passing candidate with lower measured overhead, not both by default.

## Decisions delegated and scope firewall

Decoding options and a bounded alignment refinement are delegated with evidence. If both fail, try one documented alternative (Apple SpeechAnalyzer first; specialized verbatim model only after license/local-runtime review), then reslice. Forced alignment cannot invent omitted words.

## Visual review

An optional timing plot is evidence, not product UI. If generated, compare against manual boundaries and run screenshot-critique last; audio audition remains mandatory.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

Failed filler fidelity does not authorize cutting the requirement or using cloud inference. Report the failed assumption and preserve the gate.

## Public human fixture candidate

An [AMI candidate](../assets/speech/ami-candidate.md) supplies human audio and verbatim
transcript text, but its word timings come from automatic alignment. It cannot close
the manual timing/filler gate until clips and boundaries are independently checked.

The [natural-speech diagnostic](../assets/speech/natural-diagnostic.md) now records
actual offline emissions over four public human clips. WhisperKit emitted no um/uh
tokens; Parakeet matched 132 of 185 reference fillers. Neither is selected. An Opus
probe in `/tmp/screenrec-apple-speech` is checking the specified Apple SpeechAnalyzer
alternative using installed assets only; manual timing and audition remain open.

The [Apple diagnostic](../assets/speech/apple-diagnostic.md) also ran using already
installed English assets: 18 of 185 reference um/uh were matched. Its returned
alternatives expose some omitted fillers, but tested settings did not make them the
primary transcript. A bounded WhisperKit configuration ablation is now active in
`/tmp/screenrec-whisper-verbatim`; no reference phrases may be supplied as prompts.
