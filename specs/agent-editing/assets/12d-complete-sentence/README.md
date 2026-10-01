# Complete sentence filler candidate

Status: the explicit source selection and PCM preservation checks pass. Audible
neighboring speech and join quality were accepted by the user on 2026-09-29:
“Yes, clear and natural.” The user's [independent human ranges](../12d-human-marks/README.md)
now verify sentence/neighbor boundaries and exact marked protected-word PCM.
No speech engine or cleanup recipe is selected by this packet.
The [requested marking page](../12d-sentence-marking/README.md) collected the
independent audible sentence/neighbor/filler edges; its exports remain separate
from this frozen packet.

The original says, according to the frozen ASR proposal:
**“So let’s do the first paragraph, uh, this page is a recording fixture.”**
The candidate removes the inherited marked `uh` interval. Its intended wording is
**“So let’s do the first paragraph, this page is a recording fixture.”**
Punctuation is for readability, not a new spoken-word annotation.

[original.wav](original.wav) retains the proposed full sentence (7.14 seconds).
[candidate-remove-uh.wav](candidate-remove-uh.wav) makes one explicit 420 ms cut
(6.72 seconds). No denoise, stretch, voice generation, level matching, or extra
pause removal is applied. The existing excerpt owner supplies its 5 ms join
ramps; those affected samples are excluded from the unchanged-neighbor claim.

The [annotations](annotations.json) retain source-clock word proposals and the
inherited manual visual mark separately. Their initially empty independent
fields remain frozen; actual human ranges live in the separate reconciliation
packet. Complete corpus inventory and repetition intent remain unverified.
The user listening verdict applies only to this original/candidate pair.
The outer window includes all proposed w111–w123 ranges with 250 ms guards. It
starts before “So,” rather than inside “do”; these guards are a presentation
choice based on ASR ranges, not an independent audible boundary claim.

The [manifest](manifest.json) records exact source/native/transcript/harness
identities, source-to-output frame mapping and complete WAV/PCM hashes. Retained
PCM is identical outside the declared ramps. A changed-sample negative control
makes the retained-PCM checker fail. An actual native positive control contains the
synthetic poison in the selected source; removing that source interval produces
exactly the same complete candidate PCM, including join ramps. No playback ran.
That frozen packet uses the native `media.audio` excerpt route. The managed
journey below reproduces its accepted samples through ordinary public edits.

[controls.tar.xz](controls.tar.xz) retains all worker requests/responses/logs,
poisoned control WAVs and packet positions used to locate the frozen uncompressed
MOV payload. The source is fragmented: the harness proves the complete original
PCM equals the concatenated packet payload before changing only removed frames.
It does not remux or assume another codec has this layout. The disposable poisoned
source is deleted after the real worker closes; its hash and exact changed file
byte ranges remain reproducible. Raw receipts name the original scratch output
paths; the two primary WAVs above are the retained copies.

The [rejected short-context packet](../12-speech/README.md) is preserved unchanged.
Its outer window began inside the proposed “do” and cannot demonstrate the full
sentence. This replacement presentation supplies context, not missing independent
word-boundary labels. The user has now accepted this join and saved independent
sentence/neighbor boundaries. The broader inventory required by slice 12 remains
open; timing and precision/recall gates remain unchanged. The human packet
records the opening filler omitted by the proposed text and the 15 ms marked
middle-filler prefix retained by the frozen cut.

Reproduce with the existing native worker and installed local packet inspector:

```sh
node packages/test-harness/editing/speech-sentence-packet.mjs --native /absolute/path/to/screenrec-native --out /absolute/path/to/new-packet
```

Controls archive: 1105776 bytes, SHA256
`f8938d297e74242d3ff9ad761ed19468f88e7477cb45a647c394d612ee308b2d`.

## Managed public journey

The [public journey harness](../../../../packages/test-harness/editing/filler-removal.mjs)
uses the already admitted recorded acquisition from 23a, with no new ASR or model
work. It places the same complete context, then submits one atomic `edit.apply`
batch: split twice, remove the middle picture/audio together with named-track
ripple, and set the two audio clips' explicit gain curves. Source-clock offsets
remain attached to their own media. Nothing classifies a word as a filler or
guesses new boundaries.

The gain keys encode the frozen excerpt owner's sample treatment exactly. The
left ramp reaches zero on the last retained sample, not the half-open clip end;
the right reaches unity after 240 samples. Reduced normalized fractions retain
these positions without rounding them to microseconds. This is an authored join,
not a new implicit composition ramp.

All 322,560 delivered stereo frames equal the accepted mono candidate duplicated
into both channels, including both ramps. The original and one-step undo each
equal all 342,720 original frames with the same channel duplication; undo also
restores the complete authored document. Cached MCP WAV delivery agrees with CLI,
and MCP historical revision/export reads agree with the saved receipts. The
existing listening verdict therefore applies to this lossless candidate, within
its original scope.

Preview and committed export are the same 654,407 bytes. Complete decoded AAC
has RMS error 0.0001328865576551984 against the accepted samples with no shift or
scaling, below the existing 0.002 recovered-audio policy. Silence and half-gain
controls fail that policy. Both tracks declare 6.72 seconds; all 202 video clocks
match the existing 30 fps floor policy, and decoded AAC has 960 padding samples,
within the existing one-packet allowance. This does not assert lossless AAC or
another listening verdict.

The full beginning, both sides of the join and final stills were compared with
their containing source frames. A fresh critic inspected all eight full images
and sixteen crops: framing/content match, without added clipping or missing
sections. Small body/chrome text is softened and tiny at the explicitly chosen
640×404 canvas; headings remain identifiable. These stills add no continuous
playback, original-resolution readability or broad color-fidelity acceptance.

The [public evidence inventory](public-inventory.json) addresses the full
[public archive](public.tar.xz): actual requests/receipts, WAVs, both movies,
source/export stills/crops, critique and numerical checks. It also preserves the
first unreduced-fraction admission refusal, its schema diagnosis, and a disposable
saved-candidate corruption control that exits nonzero and reports `passed:false`.
The original accepted files above are unchanged. Scratch paths in raw receipts
are historical; archive-relative names are authoritative for retained bytes.

Run a new isolated project against an existing admitted acquisition, or verify
the retained outputs without a service, rendering or models:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node packages/test-harness/editing/filler-removal.mjs --out /absolute/new-output --home /absolute/isolated-home --acquisition EXISTING_ACQUISITION_ID
node packages/test-harness/editing/filler-removal.mjs --verify-saved --out /absolute/extracted/passed
```

The saved check needs Node 24 and FFmpeg/FFprobe. Optional `--verify-public` with
`--home` and `SCREENREC_NATIVE` reads the retained project's ready artifacts through
MCP and rechecks the saved media; it does not repeat edits or preparation. Only use
it while the recorded home/project identities still exist. No original library,
installed app, native binary or frozen candidate is modified.

Closeout shape/diff/docs review retained one focused journey harness and no new
production owner or dependency. Formatter, lint, syntax and local-link checks
passed. Independent Codex review found no actionable defect, reran the saved
verification and checked every then-archived member; it did not rerun the live
journey. The final archive also retains that review and the reporter mutation
regression. Broad cleanup and independent annotation gates remain open.

[Integrated root verification](public-root-verification.json) independently parsed
all original/candidate/undo PCM, checked the committed movie receipt, rehashed all
49 archived members and reran the saved-output checks without services or rendering.
