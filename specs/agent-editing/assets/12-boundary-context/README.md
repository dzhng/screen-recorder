# Workbench boundary context

The earlier narrow panel excludes both alternative word-end predictions. This
wider view preserves the original recording and unresolved independent mark;
its purpose is to expose the missing acoustic context, not choose a word endpoint.

![Wider original narration context](wide.png)

The lower panel concerns “workbench”; the blue reference is 5.648675 seconds in
source time. [Metadata](panel-metadata.json) and [comparison](comparison.json)
provide the scale the raster itself does not label. At 900 pixels wide:

| Point | Source seconds | Original panel x | Wider panel x |
| --- | ---: | ---: | ---: |
| Alignment end proposal | 5.088675 | −110 (outside) | 240 |
| Verbatim end proposal | 5.108675 | −90 (outside) | 247.5 |
| Existing unresolved mark | 5.643675 | 445 | 448.125 |

Fresh unprimed visual review inspected both complete images. It judged the wider
framing better for including all three points, while identifying a 2.67× loss of
local time detail and missing numbered ticks, units, frequency scale and legend.
Accordingly this is context evidence with the table/metadata, not a standalone
precision annotation surface. The 20 ms candidate separation is 7.5 pixels; the 5 ms
mark/reference gap is only 1.875 pixels. The original image remains preferable for
local texture where it contains the signal.

No endpoint, lexical identity, filler label or audible non-regression can be
established from this visual envelope. The original marks and score remain
unchanged. Independent audible review must resolve whether the later sound is
part of the word before a label can change. Slice 12 remains open.

Reproduce using the unchanged repository harness, writing to a fresh directory:

```sh
node packages/test-harness/speech-boundaries.mjs --transcript specs/agent-editing/assets/12-speech/transcript.json --out /tmp/screenrec-workbench-wide-rerun --panels 2 --window 2400
```

The [original panel](../../../recording-for-ai/assets/speech/boundaries/sheet-0.png)
and [text-only trial](../12-alignment-text-coverage/README.md) retain their separate
roles. Generation decodes the actual fixture PCM without speaker playback; no
model, production behavior or annotation was changed.
