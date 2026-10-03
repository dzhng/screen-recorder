# Complete sentence with RNNoise

**Listening accepted.** The [user verdict](../listening-review-2026-09-30.md)
passes this exact pair for clear, natural words, including their starts and endings. This matched pair extends protected-speech listening to a
complete sentence from the user's recording: “The sample offer says this is free.”
The wording and boundary proposals are inherited ASR, not independent labels.

Compare [the original](original.wav) with [the denoised candidate](candidate.wav).
One listening question: **Are all the words still clear and natural in the denoised
version, especially “sample,” “says,” and the start and ending of “free”?**

The selection preserves context before and after the proposed words without
including the following sentence. Its source clock includes the actual recording
origin; the imported asset's clock subtracts that origin. Endpoints align to the
original file's sample grid so source extraction and project rendering select the
same samples. The [manifest](manifest.json) retains assembly-time readiness/listening state and
records both clocks, neighboring ASR
words, margins and edge levels. Low edge levels support this presentation proposal;
they cannot prove speech-free margins or independent word boundaries.

The original is the actual public source delivery. The public dry project duplicates
every original sample exactly into both stereo channels. The candidate is the same
project with one whole-output RNNoise stage using the existing pinned native
recipe. All deliveries retain the same duration and complete frame count; CLI and
MCP return identical bytes. No gain, normalization, retiming, fades, generated
speech or ambience fill is added. RNNoise begins at this retained sentence's start;
this pair does not judge uninterrupted whole-take processing history.

The [compressed receipts](receipts.json.gz) retain public requests, processing state,
readiness and delivery metadata. The manifest binds source, worker, assembler,
selected built JavaScript entry points and complete delivered files. Existing
[independent RNNoise parity](../15a3e-follow-learned-public/README.md) remains separate
evidence; this packet runs no new C reference comparison. The linked verdict supplies scoped listening acceptance; the [complete denoise matrix](../denoise-acceptance/README.md) combines the other exact cases. No independent protected-word boundary label is inferred.
The source, installed app and frozen workers remain unchanged. No capture, model
preparation, downloads or automatic playback is performed.

Reproduce this focused pair into a fresh directory with existing built JavaScript
and the pinned worker:

```sh
SCREENREC_NATIVE=/tmp/screenrec-03d-native-build/debug/screenrec-native node specs/agent-editing/assets/15a3-protected-sentence/assemble.mjs --out /tmp/protected-sentence-fresh
```

The [root public replay](root-verification.json) reproduces both complete WAV
hashes and every dry stereo sample. The [assembler](assemble.mjs) uses an isolated temporary service home and the existing
public CLI/MCP harness. Its scratch dry WAV proves exact original duplication and
is not duplicated in this packet. [Audited choices](choices.md) describe the only
additional presentation decision.
