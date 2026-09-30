# Familiar sentence after retiming and denoise

**Listening accepted.** The [user review](../listening-review-2026-09-30.md) passes this exact pair for word clarity and naturalness after the accepted retime.

- Reference: [accepted A](../13a-corrected-selections/internal-slower-0.8x.wav), whose words and join already passed the user's review.
- Candidate: [the same complete sentence with output RNNoise](candidate.wav).

Inherited ASR transcript: “Okay, so this is the recorder workbench.” The candidate has no added gain, normalization, fades or further trimming. Its overall level may differ because of denoising; the accepted judgment concerns words and naturalness, not a new stretch audition.

The public project replays the existing accepted authoring route from the immutable original sentence, then adds one whole-output RNNoise step. Before that step, all 246478 frames exactly reproduce accepted A. The reference is mono; the public dry render copies every sample equally into left and right without gain. The candidate retains the same stereo frame count and matches the existing frozen C697657 RNNoise reference exactly in both channels. Both dry and candidate deliveries agree across CLI and MCP.

This route is explicit: it is **original source → accepted public retime → RNNoise**, not direct import of the already retimed WAV. Direct import exposed a separate fractional source-endpoint limitation; no clipped or padded substitute was used in this packet. Existing retiming acceptance and the post-retime integration mechanics remain separate evidence. The linked user review supplies the listening verdict; no media was played automatically while assembling this packet.

[The manifest](manifest.json) binds source, reference, worker, independent C reference and candidate hashes. [Compressed receipts](receipts.json.gz) retain actual public requests, processing state and delivery receipts. The reference links to the accepted file rather than duplicating it.

Reproduce just this one pair into a fresh directory using the [assembler](assemble.mjs):

```sh
SCREENREC_NATIVE=/absolute/path/to/frozen/screenrec-native node specs/agent-editing/assets/15a3-post-retime-familiar/assemble.mjs --reference /absolute/path/to/rnnoise-api-697657e249b1 --out /tmp/post-retime-familiar-fresh
```

The shared accepted-retime authoring helper is also used by the existing A–D runner; this assembler invokes only A. It uses an isolated service home, immutable repository inputs and existing binaries. No installation, model preparation, capture or playback is performed.
