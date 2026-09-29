# Familiar sentence at different speeds

This optional listening material uses the same retained recording as the
[familiar denoise comparison](../12c-familiar-sentence/README.md). Its inherited
ASR transcript reads: “Okay, so this is the recorder workbench.” The text is not
a new listening annotation or a set of protected-word timing labels.

- [Original](original.wav)
- [Slower, 0.8×](slower-0.8x.wav)
- [Slower, 0.9×](slower-0.9x.wav)
- [Faster, 1.25×](faster-1.25x.wav)

Each file contains the complete five-second source selection, adjusted only by the
frozen stretch recipe. There is no new trimming, gain normalization, fade, noise
reduction or admission of surrounding speech. The original stereo channels are
byte-identical; selecting one gives the mono input required by the isolated parity
adapter without downmixing. The 1× output is byte-identical to that selected PCM.
Output counts are the floor of the input count divided by the stated rational
speed. Native probing confirms readable mono48k WAVs at the resulting durations.

The assembler checks source and worker hashes against retained evidence before
rendering. [manifest.json](manifest.json) pins every output; the same script in a
fresh directory reproduces them with the frozen native parity executable. This
is new listening material, not a new engine experiment or a public operation.

No audio played automatically, no listening verdict is recorded, and public
retiming remains disabled. Whole-word joins, short-speech treatment, production
channel/state integration and the full13a/14 gates remain open. A later listening
comparison should focus on one speed and whether all words remain clear and
natural against the original, rather than asking the user to interpret isolated
unfamiliar word fragments.
