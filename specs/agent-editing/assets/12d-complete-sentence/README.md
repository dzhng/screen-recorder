# Complete sentence filler candidate

Status: the explicit source selection and PCM preservation checks pass. Audible
neighboring speech and join quality were accepted by the user on 2026-09-29:
“Yes, clear and natural.” Independent protected-word timing remains unverified.
No speech engine or cleanup recipe is selected by this packet.

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
inherited manual visual mark separately. Independent protected-word ranges,
complete filler inventory and repetition intent stay empty. The user listening
verdict applies only to this original/candidate pair.
The outer window includes all proposed w111–w123 ranges with 250 ms guards. It
starts before “So,” rather than inside “do”; these guards are a presentation
choice based on ASR ranges, not an independent audible boundary claim.

The [manifest](manifest.json) records exact source/native/transcript/harness
identities, source-to-output frame mapping and complete WAV/PCM hashes. Retained
PCM is identical outside the declared ramps. A changed-sample negative control
makes the retained-PCM checker fail. An actual native positive control contains the
synthetic poison in the selected source; removing that source interval produces
exactly the same complete candidate PCM, including join ramps. No playback ran.
This is the native `media.audio` excerpt route, not a new public composition,
semantic cleanup service, or edit/history journey.

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
word-boundary labels. The user has now accepted this join; next evidence is an
independent timing annotation of the full sentence, then the broader inventory required
by slice 12; timing and precision/recall gates remain unchanged.

Reproduce with the existing native worker and installed local packet inspector:

```sh
node packages/test-harness/editing/speech-sentence-packet.mjs --native /absolute/path/to/screenrec-native --out /absolute/path/to/new-packet
```

Controls archive: 1105776 bytes, SHA256
`f8938d297e74242d3ff9ad761ed19468f88e7477cb45a647c394d612ee308b2d`.
