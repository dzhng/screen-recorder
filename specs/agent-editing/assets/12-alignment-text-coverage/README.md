# Supplied-text coverage diagnostic

Adding one hypothesized `uh` before the second Return fixes that marked onset,
but the candidate still fails the unchanged timing and memory gates. This is
local diagnostic support for missing-text absorption, not a selected recipe or
an independently verified filler transcription. Slice 12 remains open.

## Matched condition and result

The [predeclared contract](contract.json) changes supplied text only. It reuses
the [frozen control](../12-alignment/README.md), the full recording, existing
offline runtime/model and unchanged independent marks. All eight model files
were hash-verified. Audio, runner, model files, runtime versions and inference
settings match the control. No downloads, production edits or label edits occurred.
The supplied row has no invented timestamp; the existing runner consumes text.

| Condition | Original words retained | Matched marks | Median / p95 | Peak RSS |
| --- | --- | --- | --- | --- |
| Frozen text | 306/306 | 15/15 | 35 / 556.5 ms | 6,099,189,760 bytes |
| Text plus candidate `uh` | 306/306 | 15/15 | 25 / 303 ms | 6,065,897,472 bytes |

The gates remain median ≤100 ms, p95 ≤250 ms, and RSS ≤4 GiB. One previously
unmarked edge remains unmarked. All matched signed errors are retained below;
negative means earlier than the original mark.

| Original word edge | Control error (ms) | Candidate error (ms) |
| --- | --- | --- |
| w0 start | 195 | 195 |
| w6 end | -555 | -555 |
| w25 start | 15 | 15 |
| w26 end | 20 | 20 |
| w57 start | -50 | -50 |
| w62 end | 25 | 25 |
| w93 start | 35 | 35 |
| w103 end | 93 | 93 |
| w117 start | 0 | 0 |
| w117 end | -20 | -20 |
| w160 start | 25 | 25 |
| w237 start | -560 | 0 |
| w239 end | 25 | 25 |
| w277 start | 155 | 155 |
| w279 end | -50 | -50 |

The [full comparison](comparison.json) retains every original word's two edges,
not just the favorable Return result. 303 words are unchanged. All 306 end edges
are unchanged. Three start edges move: Return (`w237`) +560 ms, Scroll (`w249`)
−80 ms, and Okay (`w280`) −160 ms. The latter two have no independent onset
marks, so their accuracy and any regression remain unknown. The local context
(`w234`–`w242`) changes only at Return's onset; these neighbors are ASR-proposed
words, not independently annotated protected words.

The added `uh` aligns to source 103.408675–103.728675 seconds. Its existence,
identity and exact range remain a hypothesis suggested by the frozen alternative.
The result supports the local text-coverage explanation but cannot establish
complete non-regression: the predeclared collateral-error criterion is unresolved
for unmarked shifts, and there is no independent filler boundary label.

## Evidence boundary and next experiment

The original marks are preserved, including workbench end 5.643675 seconds.
The aligned end remains 5.088675 seconds (−555 ms); agreement with another model
is not annotation evidence. The existing narrow visual panel begins after both
candidate endpoints. The next bounded diagnosis should show both candidate
endpoints and the original mark in a wider panel, retaining the annotation's
independent visual provenance and requiring audible review before any label
correction. Visual envelopes alone cannot satisfy listening or word identity.

Full audible filler inventory, protected words, editorial repetition intent and
new-cut joins remain unverified. No speaker playback occurred. The historical
narrator audition approves only its original cut, not this trial. The later [wider boundary context](../12-boundary-context/README.md) includes both
predicted ends and the unchanged mark; it does not establish lexical or listening
acceptance. Do not use this development recording
to claim generalization, a memory improvement, or faster inference.

## Reproduction and review

Use the already prepared offline environment and PCM identified in the contract;
there is no setup/download step in this trial. The runner enforces a 900-second
deadline. [Runtime identities](runtime.json), [raw result](result.json),
[score](score.json), [process log](process.txt) and [attempt accounting](attempt.json)
freeze one successful attempt with zero infrastructure repairs: 6.10 seconds wall,
0.872 seconds load and 1.324 seconds alignment. Peak RSS is distinct from the OS
peak footprint of 7,270,123,512 bytes. The control was not rerun.

```sh
/usr/bin/time -l /usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' /tmp/screenrec-speech-align-venv/bin/python packages/test-harness/editing/speech/alignment-probe.py --model /tmp/screenrec-speech-align-model --audio /tmp/screenrec-speech-verbatim-input.wav --transcript specs/agent-editing/assets/12-alignment-text-coverage/supplied-transcript.json --out /tmp/screenrec-speech-text-coverage-rerun
node packages/test-harness/editing/speech/score-candidate.mjs /tmp/screenrec-speech-text-coverage-rerun/result.json specs/recording-for-ai/assets/speech/boundaries/marks.json specs/agent-editing/assets/00-baseline/speech-labels.json > /tmp/screenrec-speech-text-coverage-rerun/score.json
node packages/test-harness/editing/speech/compare-alignment.mjs specs/agent-editing/assets/12-alignment-text-coverage /tmp/screenrec-speech-text-coverage-rerun > /tmp/screenrec-speech-text-coverage-rerun/comparison.json
```

The comparator checks frozen input hashes and exact original word order, and
compares all 306 word ranges using the shared scorer's marked-edge results.
A [same-count word-swap negative control](comparison-negative.json) refuses a
corrupted correspondence; the original result was restored and the comparison
reproduced exactly. The four [shared scorer tests](scorer-tests.txt) pass. No
threshold, matcher or production processing policy changed.

[Review](review.json) found and corrected a reproduction-path error: rerun scoring and comparison
now consume the fresh run directory, leaving frozen evidence untouched. Omitting
the comparator's second directory instead verifies the retained evidence.
