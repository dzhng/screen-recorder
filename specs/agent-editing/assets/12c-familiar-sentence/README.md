# A familiar complete sentence

This optional comparison uses the user's retained recording rather than unfamiliar
dataset words: “Okay, so this is the recorder workbench.” The text comes from the
existing ASR transcript; it is not a fresh listening annotation. The five-second
reference is the existing 1–6 second extraction retained by the voice reproduction.

- [Original through the ordinary renderer](original.wav)
- [Same sentence with learned noise reduction](learned.wav)

The comparison is for whether words and naturalness survive processing. It does
not repeat the already-settled filter preference question. No action on this packet
is required, and no listening acceptance is inferred from its creation.

Both files were produced through actual public CLI/MCP operations: asset import,
project placement, preparation and complete audio delivery. The shared renderer
converts the 24 kHz mono reference to 48 kHz stereo in both cases. Each contains 240,000
frames. The original has an empty output stack; the other adds the frozen learned
processor. Gain remains unity, with no normalization, new trimming or splice.
The denoised signal is quieter; numeric levels in the report are diagnostics, not
a judgment about retained words, pumping, echo or perceived loudness.

[Source/output identities](manifest.json), [public receipts](report.json), and a
[fresh reproduction](reproduction.json) retain the numerical delivery evidence. The assembly script writes a new output directory
when run with the built native worker and CLI/service, for example:

```sh
SCREENREC_NATIVE="$PWD/helpers/mac/.build/debug/screenrec-native" node specs/agent-editing/assets/12c-familiar-sentence/assemble.mjs /tmp/new-sentence-comparison
```

No audio was played automatically. Protected speech, timing labels and broader
quality remain open in the [parent acceptance](../../slices/15a3-denoise-acceptance.md).
