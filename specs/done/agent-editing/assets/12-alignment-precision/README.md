# Alignment precision diagnostic

Half-precision alignment reduces peak resident memory below the unchanged 4 GiB
gate on this recording. It does not fix the timing failure or establish speech
quality. The frozen float32 control remains the reference; no production recipe
or annotation changed.

The [contract](contract.json) changes model/input precision only. All model files,
audio, original supplied transcript, evaluator and Python package versions match
[the frozen control](../12-alignment/README.md). The offline network-denied trial
completed once with no repair, download, playback or user-library change.

| Condition | Peak resident bytes | OS peak footprint | Median / p95 marked error |
| --- | ---: | ---: | --- |
| Frozen float32 | 6,099,189,760 | Not retained | 35 / 556.5 ms |
| Float16 | 3,574,104,064 | 5,349,705,864 | 35 / 556.5 ms |

The resident-memory measurement is the existing gate metric; the larger OS memory
footprint is reported separately and must not be described as below 4 GiB. No
speed comparison is claimed while other independent native checks run. The one
trial took 21.91 seconds wall time; [raw process accounting](process.txt) is retained.

[Full comparison](comparison.json) verifies all 306 supplied words in order and
all 15 marked edges without regression. Of 612 word edges, one changed: the start
of `going` at ordinal 18 moved from 10.72 to 10.64 seconds. That edge has no
independent mark, so its accuracy is unknown. All word endings and the other 305
starts are unchanged. The unchanged p95 remains above 250 ms; the incomplete
filler inventory and listening gates also remain open.

Parameter-effect map: float16 is a provisional memory improvement on one fixed
recording, with unchanged marked timing and one unverified collateral boundary.
Verdict: retain as a diagnostic candidate, not a production winner. The alternative
load-peak investigation is no longer the next test because this numerical memory
gate passed. Before promotion, resolve the unmarked shifted boundary and the
existing independent workbench timing/listening questions. If the supplied-text
coverage candidate is independently accepted, confirm precision against that
candidate's frozen float32 result rather than assuming the effects combine.

Reproduce the single factor with the retained runner and prepared local model:

```sh
/usr/bin/time -l /usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' /tmp/screenrec-speech-align-venv/bin/python specs/agent-editing/assets/12-alignment-precision/alignment-float16.py --model /tmp/screenrec-speech-align-model --audio /tmp/screenrec-speech-verbatim-input.wav --transcript specs/agent-editing/assets/12-speech/transcript.json --out /tmp/alignment-float16-fresh
node packages/test-harness/editing/speech/score-candidate.mjs /tmp/alignment-float16-fresh/result.json specs/recording-for-ai/assets/speech/boundaries/marks.json specs/agent-editing/assets/00-baseline/speech-labels.json
```

The retained runner differs from the existing alignment probe only in its model
precision and the matching recorded setting. Its manifest preserves input/model/
runtime identities. This is development evidence on the same recording, not
held-out generalization or complete cleanup acceptance.
