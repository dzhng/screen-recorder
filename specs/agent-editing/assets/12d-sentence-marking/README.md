# Independent sentence marking

Status: the requested local marking page is prepared and its clock, export,
seek and layout checks pass. The user's [actual independent marks](../12d-human-marks/README.md)
are saved and reconciled; the scoped sentence/neighbor-label check passes.
Parent corpus inventory/timing and dependent speech gates stay open.

The current [guided waveform page](../12d-waveform-guidance/README.md) asks for
one boundary at a time, starting with the opening “um” reported by the listener.
Click the waveform to select and hear a short preview, then press Next to confirm.
The final confirmation saves the selections. There are no timestamp inputs or
separate confirmation form. Optional Back revisits a boundary; Skip keeps an
unclear edge unknown. No boundaries are prefilled and opening “um” has no
independent range until the listener actually marks it. The retained human export
now contains both filler ranges and every requested sentence/neighbor edge.

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
The [audio loading repair](../12d-marking-recovery/README.md) holds the complete
original clip in the browser after loading, shows a retry message on failure,
and keeps the original available during marking. The prepared server runs
detached from the command session; saving still requires that server to be alive.
The requested user page intentionally remains running. Its disposable test server,
tab and synthetic saved files were closed/removed.

[Blank page](blank-page.jpg) shows the historical initial state. The
[root verification](root-verification.json) and [artifact inventory](manifest.json)
pin the checks and retained bytes. The
[verification archive](verification.tar.xz) retains every full capture and crop,
HTTP checks, synthetic export probes, clock/range mutation failures and restored
passes, raw visual metrics and the root/independent review report. **All test
positions in that archive are synthetic and excluded from human ground truth.**
Those initial checks exercised the historical form without audio playback.
Current interaction, source-clock/export and visual evidence lives in the guided
page packet; earlier manifests retain their original source hashes. The Codex
CLI second review remains unavailable after its configured model rejection;
no passing CLI review is claimed.

The [choices ledger](../../choices.md) owns implementation decisions. The human
reconciliation verifies the matching immutable binding and confirmation before
using only the actually marked ranges for 12d. A good-sounding cut or a
waveform is not a substitute for missing independent labels.
