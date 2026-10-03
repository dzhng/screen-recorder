# Frozen-text alignment experiment

The failed verbatim candidate does not establish a replacement speech engine.
This experiment isolates timestamp prediction: retain every word of the frozen
Parakeet transcript, discard its timestamps before inference, and align that text
to the same complete mono 16 kHz narration PCM. No independent marks enter the
model. All fifteen frozen marks and the unchanged 100/250 ms median/p95 targets
remain the scoring contract; missing or ambiguous matches fail completeness.

Candidate: [Qwen3 ForcedAligner](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B-hf),
Apache-2.0 model revision `c07281df297b9905d24a508279258cccf987a064`, native
Transformers 5.17.0 with PyTorch 2.14.0. Use its documented processor preparation,
model forward and timestamp decode operations; MPS float32 is the explicit macOS
adaptation. This is one full-recording cold-process experiment, with a fifteen
minute deadline and one infrastructure/API repair allowance. It does not tune
thresholds, words, chunks or marks after observing scores.

Hypothesis: a dedicated aligner improves supplied-word edges relative to the
frozen Parakeet timing without relying on alternative spellings or filler
transcription. Falsification: missing/ambiguous edges or median/p95 outside the
unchanged targets. Even passing those numerical gates cannot discover omitted
words, establish a complete filler inventory, decide editorial repetition intent,
or prove natural joins. Memory is measured against the existing 4 GiB target;
shared-host timing is diagnostic, not a warm performance claim.

Preparation is explicit and isolated. Inference uses local model files, offline
flags and an OS network-denial sandbox. Original source, prepared audio, frozen
text, model and runtime identities are retained independently of the scorer.

## Result and interpretation

All 306 supplied words survive in order under the frozen scorer's punctuation
normalization. All 15 independent edges match uniquely. Median absolute error is
35 ms, but p95 is 556.5 ms and worst error is 560 ms: **timing fails**. The known
filler edges are 0/-20 ms from their marks. The two worst errors are the
`workbench` end (-555 ms) and second `return` start (-560 ms). These are diagnostic
locations to investigate, not grounds for changing their independent marks.

| Timing strategy | Matched edges | Median / p95 | Decision |
| --- | --- | --- | --- |
| Frozen Parakeet | 15/15 | 135 / 578.1 ms | Fails |
| Qwen alignment of that same text | 15/15 | 35 / 556.5 ms | Fails |

The candidate improves the median on this development corpus but barely changes
the tail. No broad accuracy or winning recipe is inferred. Its model load took
2.58 s and alignment 2.70 s; those timers exclude Python/import startup and are
not total process time. Peak process RSS was 6,099,189,760 bytes, exceeding the
4 GiB target. One offline run completed without repairs. No speaker playback,
capture, user library changes or production engine edits occurred.

[The full result](result.json), [score](score.json), [runtime/model identities](runtime.json)
and [attempt](attempt.json) retain the reproducible record. The model's Apache-2.0
card permits a different artifact policy from the research-restricted verbatim
candidate: these supplied-text alignment outputs are retained in the repository.
Neither model weights nor a runtime environment is checked in.

## Reproduce

Use the same PCM input prepared in the [verbatim experiment](../12-verbatim/README.md).
All setup is explicit; the ordinary run stays offline. Pin transitive versions to
[runtime.json](runtime.json) when rebuilding the exact observed environment.

```sh
uv venv --python 3.11 /tmp/screenrec-speech-align-venv
uv pip install --python /tmp/screenrec-speech-align-venv/bin/python 'transformers==5.17.0' 'torch==2.14.0' soundfile librosa
hf download Qwen/Qwen3-ForcedAligner-0.6B-hf --revision c07281df297b9905d24a508279258cccf987a064 --local-dir /tmp/screenrec-speech-align-model
/usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' /tmp/screenrec-speech-align-venv/bin/python packages/test-harness/editing/speech/alignment-probe.py --model /tmp/screenrec-speech-align-model --audio /tmp/screenrec-speech-verbatim-input.wav --transcript specs/agent-editing/assets/12-speech/transcript.json --out /tmp/screenrec-speech-align-run
node packages/test-harness/editing/speech/score-candidate.mjs specs/agent-editing/assets/12-alignment/result.json specs/recording-for-ai/assets/speech/boundaries/marks.json specs/agent-editing/assets/00-baseline/speech-labels.json
```

Use a fresh run directory. The retained scorer is shared by both experiments;
its name now reflects the common candidate shape. All four existing tests remain
active, including the source-origin mutation control, missing/ambiguous failure
checks and a deliberate timing shift. No matching policy or threshold changed.

The subsequent [text-coverage diagnostic](../12-alignment-text-coverage/README.md)
changes only one supplied word and preserves the complete comparison. It supports
a local explanation for Return but does not pass the global gates.

## Later evidence and current scope

The historical proposal to recheck `workbench` is superseded by the
[actual independent marks](../12f-human-marks/README.md). Preserve the frozen
scores above; those later marks have their own comparison and scope. This report
does not schedule another annotation, alignment or listening trial. Any further
technical experiment follows the [active speech-evidence contract](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/12-speech-evidence.md).
Full audible inventory, protected words and joins retain their technical limits.
Repetition-removal intent belongs to the external caller; the
[former solicitation](../12-repetition-intent/README.md) is retired.
