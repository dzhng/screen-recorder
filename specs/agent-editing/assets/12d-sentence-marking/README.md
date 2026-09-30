# Independent sentence marking

Status: the requested local marking page is prepared and its clock, export,
seek and layout checks pass. Actual independent listening marks remain pending;
12d and the parent speech gates stay open.

The page plays the frozen original sentence only when the listener presses Play.
All edges begin blank. Mark the sentence start/end, `paragraph`, `uh` and `this`
by listening. Click the waveform to seek, zoom around the playhead, then use an
edge's playhead button or type clip seconds. Leave connected or uncertain edges
blank and describe uncertainty in the notes. Check “I placed these marks by
listening” before saving evidence; otherwise save a draft.

The source selection is the [frozen original packet](../12d-complete-sentence/manifest.json).
Its ASR text helps identify words, but no proposed ASR times are prefilled. One
[clock owner](../../../../packages/test-harness/editing/speech/annotation-time.mjs)
converts clip seconds to the original recording clock. Blank/partial ranges stay
unknown. Even confirmed marks cover only this sentence and cannot establish a
complete corpus filler inventory or repetition intent.

The [local server](../../../../packages/test-harness/editing/speech-labeling.mjs)
rehashes the frozen clip and source, binds exports to the exact source packet,
and saves each submitted snapshot in a separate JSON file. It neither changes
existing evidence nor imports the marks automatically into the evaluator.
The page is an evaluation tool, outside the product editing UI.

Run from the repository with Node 24 and existing built core artifacts:

```sh
node packages/test-harness/editing/speech-labeling.mjs --out /absolute/separate/mark-directory
```

Use the local URL printed by that command. In this prepared session it is
`http://127.0.0.1:58829`; saves go to `/tmp/screenrec-sentence-marking-20260930`.
This session address is temporary; restart the command if it stops.
The requested user page intentionally remains running. Its disposable test server,
tab and synthetic saved files were closed/removed.

[Blank page](blank-page.jpg) shows the requested initial state. The
[root verification](root-verification.json) and [artifact inventory](manifest.json)
pin the checks and retained bytes. The
[verification archive](verification.tar.xz) retains every full capture and crop,
HTTP checks, synthetic export probes, clock/range mutation failures and restored
passes, raw visual metrics and the root/independent review report. **All test
positions in that archive are synthetic and excluded from human ground truth.**
The default harness command passes its original bootstrap/speech checks plus
five new clock/export/range tests. Browser seeking and saving were checked
without audio playback. The final critic found no clipping/overlap; compact
phone-scale tick spacing and vertical distance to later rows remain minor layout
limitations. The Codex CLI second review remains unavailable after its configured
model rejection; no passing CLI review is claimed.

The [choices ledger](../../choices.md) owns implementation decisions. After the
listener saves, inspect the matching immutable binding and confirmation before
reconciling only the actually marked ranges with 12d. A good-sounding cut or a
waveform is not a substitute for missing independent labels.
