# Recorded narration survives visual-only edits

This public CLI/MCP journey places source seconds 1–13 from the retained real
narrator and existing footage into a 12-second project. It replaces only the video,
then adds a cropped picture overlay. Every rendered float32 stereo PCM byte must
match the original complete project. A fractional range must also match its exact
absolute-sample slice of that full PCM. This is preservation evidence, not a
listening assessment or a claim about all audio codecs.

The [harness](../../../../packages/test-harness/editing/narration-preservation.mjs)
uses existing service, asset, renderer and transport owners. Changed decoded picture
bytes guard against a no-op visual edit. Source hashes/metadata, the original audio
clip, historical revision, restart reads and undo remain checked. A deliberate
public output-gain mutation fails the complete-PCM oracle; no backend code changes.
The oracle compares bytes directly without formatting a multi-megabyte sample diff.
An earlier control was stopped during that expensive diagnostic formatting and
supplies no accepted negative result.

Full and range previews declare exactly the compiler's 48 kHz audio frame counts
and a zero-based delivery clock. The committed export matches full-preview bytes.
AAC decoded output is separate evidence: this run exposes 448 extra decoded frames
for the full output and 447 for the range. Decoded AAC differs from lossless PCM;
reported RMS/maximum differences are observations with no invented tolerance or
quality verdict. Original versus visually edited full AAC output also matches
exactly, but that does not make either encode lossless. The [receipt](report.json.gz)
retains both kinds of evidence and the native/harness identities.

Four-second [original](original-listening.wav) and [edited](edited-listening.wav)
excerpts are available for optional listening. They contain the same preserved
narration samples. No playback or listening assessment was performed. These files
inherit the personal-fixture handling described in the narrated-workbench fixture.
Visual composition quality and broader08 codec/resampling/mixing/listening gates
remain separate.

Reproduce with the frozen compatible native worker:

```sh
SCREENREC_NATIVE=/path/to/verified-native node packages/test-harness/editing/narration-preservation.mjs --out /tmp/narration-fresh
```

Initial and final end-to-end runs pass all nine named checks. The final receipt
matches the committed harness hash and preserves the bounded mismatch control. Independent review found
no actionable defect; its execution was restricted by sandbox socket permissions,
while the primary run used the actual native service. Timing under concurrent
host work is not treated as a performance acceptance measurement.

Combined-root confirmation after transcript-owner integration passes all nine
checks with the same frozen native worker. The [root receipt](root-report.json.gz)
and log retain actual PCM, revision and encoded-clock measurements; no listening
or performance claim is added.
