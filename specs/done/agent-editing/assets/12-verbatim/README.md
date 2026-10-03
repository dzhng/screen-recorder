# Matched verbatim diagnostic

Research only. The existing Parakeet baseline fails the unchanged visual-edge
100 ms median / 250 ms p95 targets. This pass evaluates the previously researched
CrisperWhisper alternative on exactly the same real narration and frozen marks.
No labels, transcript, filler prompts or reference text reach inference.

The hypothesis is that supervised word timestamps and verbatim decoding improve
both boundary placement and representation of the known filler. A missing or
ambiguous same-word match fails completeness; it is never dropped to improve the
score. All fifteen marked edges are scored by the existing shared scorer; the
sixteenth unmarked edge stays unmarked. Full filler/repetition recall, protected
words and natural joins remain unknown without independent audible labels.

## Reproduction contract

Candidate model `nyralabs/CrisperWhisper2.0_large` revision
`f4334f6e8193f2691212d49b20fa12d370e13896`; runtime
`nyrahealth/CrisperWhisper` revision
`0f5f694d0e3f568b5095020857e1a41542a64479`, Transformers 4.49.0.
Use the documented PyTorch backend, MPS float16, English verbatim mode with
word timestamps and all other pinned-runtime defaults. This is one cold process,
not a warm or isolated performance claim. The inference deadline is fifteen
minutes, with one repair allowed for an infrastructure/API failure; a repair
receives its own attempt record. No timing-target tuning on these labels.

Explicit preparation uses an isolated scratch Python environment and pinned
`hf download --revision`; ordinary inference accepts only a local prepared model,
sets offline flags and runs under a network-denial sandbox. The input is the
entire original narration stream decoded to mono 16 kHz PCM using ffmpeg. Model
seconds are relative to that decoded file; add the inherited 48,675 µs source
origin before scoring. Source, input, runner, runtime and model identities are
recorded. No output text is used as independent ground truth.

The [upstream API](https://github.com/nyrahealth/CrisperWhisper/tree/0f5f694d0e3f568b5095020857e1a41542a64479)
and [pinned model license](https://huggingface.co/nyralabs/CrisperWhisper2.0_large/blob/f4334f6e8193f2691212d49b20fa12d370e13896/LICENSE.md)
separate MIT code from research-restricted weights and outputs. This diagnostic
makes no deployment recommendation. Raw generated text and weights remain in
scratch storage; repository evidence contains identities and aggregate metrics.

## Observed parameter effect

| Candidate | Matched frozen edges | Median / p95 absolute error | Result |
| --- | --- | --- | --- |
| Frozen Parakeet | 15/15 | 135 / 578.1 ms | Fails timing |
| Pinned CrisperWhisper verbatim | 13/15 | 20 / 352 ms | Fails completeness and p95 |

The candidate quantiles describe only the matched subset, so they are not a
like-for-like all-edge improvement claim. The two unmatched marks differ by
spelling and word segmentation, respectively; calling them omitted speech would
be unsupported. The frozen matcher is deliberately unchanged. The known filler
start/end errors are 0/-20 ms, but an isolated represented filler cannot prove
full-corpus recall. The largest matched error is an early end, 535 ms from its
frozen mark. No mark was adjusted to favor either engine.

The single cold process took 18.31 s to load and 44.76 s to transcribe, with
6,535,315,456-byte peak RSS, above the 4 GiB target. Shared-host load and different
runtimes limit performance comparison. Upstream attention-mask/attention-output
warnings were retained in the scratch log without suppressing or patching them.
The first prepared attempt completed; no runtime repair or repeat was used.
[Scores](score.json), [attempt identity](attempt.json) and [runtime/model hashes](runtime.json)
retain the quantitative record. Raw generated words remain at the path in the
attempt record. No user capture or speaker playback occurred.

The [scorer test](../../../../../packages/test-harness/editing/speech/score-candidate.test.mjs)
checks source-clock translation, unchanged unmarked edges, missing/ambiguous
failures and deliberately shifted timing. Removing the source-origin translation
produced the retained [red control](origin-red.txt); restoring it passed all four
shared/adapter tests ([log](scorer-green.txt)). This proves the scorer can reject
misplaced evidence, not that the candidate passes speech quality.

## Commands

```sh
uv venv --python 3.11 /tmp/screenrec-speech-verbatim-venv
uv pip install --python /tmp/screenrec-speech-verbatim-venv/bin/python 'crisperwhisper[transformers] @ git+https://github.com/nyrahealth/CrisperWhisper.git@0f5f694d0e3f568b5095020857e1a41542a64479' 'transformers==4.49.0'
hf download nyralabs/CrisperWhisper2.0_large --revision f4334f6e8193f2691212d49b20fa12d370e13896 --local-dir /tmp/screenrec-speech-verbatim-model
ffmpeg -v error -i fixtures/narrated-workbench/narration.mov -map 0:a:0 -ar 16000 -ac 1 -c:a pcm_s16le -n /tmp/screenrec-speech-verbatim-input.wav
/usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' /tmp/screenrec-speech-verbatim-venv/bin/python packages/test-harness/editing/speech/verbatim-probe.py --model /tmp/screenrec-speech-verbatim-model --audio /tmp/screenrec-speech-verbatim-input.wav --out /tmp/screenrec-speech-verbatim-run
node packages/test-harness/editing/speech/score-candidate.mjs /tmp/screenrec-speech-verbatim-run/result.json specs/recording-for-ai/assets/speech/boundaries/marks.json specs/agent-editing/assets/00-baseline/speech-labels.json
```

Run with a fresh output path and enforce the fifteen-minute process deadline.
The installed dependency versions are frozen in the runtime record; the install
command alone does not pin every transitive dependency. The inherited source
origin is 48,675 µs; ffprobe rounds the physical stream start to 48,667 µs.
That eight-microsecond distinction remains explicit and does not explain the
millisecond-scale failures.

## Next

Do not promote this candidate. The separate [frozen-text alignment experiment](../12-alignment/README.md)
now records the next numerical comparison and its still-failing p95 gate.
Alignment cannot recover words omitted by ASR; independent audible filler and
protected-word inventory and join acceptance remain open.
