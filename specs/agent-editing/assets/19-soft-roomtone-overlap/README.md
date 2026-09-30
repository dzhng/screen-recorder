# Room tone with longer equal-power overlaps

**Selected by the user, with a slight residual seam tolerated.** The
[user review](../listening-review-2026-09-30.md) first reports speech-free sound and
improved continuity, then notes a small remaining seam. After comparing the250ms
version, the user explicitly chooses this200ms version. Preserve this exact output
and do not claim it is entirely seamless. The earlier loop's noticeable repeat
seams and the250ms candidate's whirling sound remain rejected results. This revised
packet uses the unchanged [retained stereo region](../19-clean-roomtone/source-region-stereo.wav),
whose source selection and origin conversion remain owned by the
[earlier packet](../19-clean-roomtone/README.md). The frozen report retains its
assembly-time pending listening state; the linked user record owns the later verdict.

The [normal loop](loop.wav) spreads each repeat boundary over a longer overlap.
The [monitoring copy](loop-monitor-plus24db.wav) applies the same separately labeled
**+24 dB output gain only**. It is a listening aid, not a new ambience level policy.
The fixed proposal uses sine/cosine weights approximated by public linear gain
keys. Their complementary squared weights stay near one within the declared
approximation bound. This controls the fade weights, not perceived loudness or
actual mixed power: correlated source samples can reinforce or cancel. No hearing claim follows from those checks; the user verdict owns acceptance.

The [assembler](assemble.mjs) uses existing public import, project edits, gain
curves, audio delivery and undo through JourneyService. The [report](report.json)
pins the source, worker, executed assembler, runtime files and admitted keys.
An independent sample-domain calculation over those admitted keys matches the
complete public loop within the unchanged `1e-7` tolerance. Dry source bytes are
exact, CLI/MCP WAV bytes agree, the explicit monitoring gain stays below full
scale, and undo restores the normal loop exactly. The [negative control](oracle-control.json)
shows that a wrong expected gain fails the full-sample assertion while receiving
the unchanged public loop.

[Full public exchanges](exchanges.json.gz) retain requests, receipts and all four
MCP audio bodies. The dry source is already retained in the earlier packet; the
transient undo WAV duplicates the normal loop and is omitted here. Their actual
delivery hashes and complete audio bodies remain in the evidence. [Review](review.md)
and [root reconstruction](root-verification.json) verify the execution;
[audited choices](choices.md) describe the bounded implementation decisions.

Reproduce into a fresh scratch directory using the pinned existing native worker:

```sh
SCREENREC_NATIVE=/tmp/screenrec-03d-native-build/debug/screenrec-native node specs/agent-editing/assets/19-soft-roomtone-overlap/assemble.mjs --out /tmp/new-roomtone-overlap
```

The earlier audition and its rejection remain intact. No source change, retiming,
reversal, denoising, normalization, new capture/model or automatic playback occurs.
The improved listening verdict applies to the exact monitoring output, not an
automatic ambience policy. The final user choice tolerates this exact residual seam; no further overlap
trial is requested.
