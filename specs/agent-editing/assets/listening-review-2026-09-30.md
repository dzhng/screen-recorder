# User listening review — 2026-09-30

The user reviewed the four numbered items presented in this chat and replied:

> for 4 - I actually can't hear anything, except for a very short blip of my voice ~70-80% of the way in
>
> all others one sounds good

Items 1–3 are accepted for their presented listening questions: post-retime
denoise word clarity/naturalness, the shortened phrase entrance, and the generated
word/transition in context. Preserve these exact outputs; do not repeat their
listening review or transfer approval to different media or recipes.

Item 4 fails the speech-free source-region check. The pause is mostly inaudible
to this listener but contains a brief voice blip around 70–80% of its duration.
That approximate location is a listener observation, not a measured sample boundary.
The retained interior spans 0.3–1.2 seconds of this 1.5-second pause and may include
the reported blip; it cannot be treated as independently approved speech-free
room tone. The accepted contextual candidates remain accepted, but this does not
approve reusing the underlying region for arbitrary ambience loops. Select and
audition a clean region from existing immutable audio before closing that gate;
prove loop continuity separately. No new capture is authorized.

| Presented item | Media | SHA-256 |
| --- | --- | --- |
| 1. Accepted: post-retime RNNoise | [candidate.wav](15a3-post-retime-familiar/candidate.wav) | `a441f5e54c67ce1b341c9b334fe6b24c61b9a842079928a8a27d5eef803d8cb3` |
| Reference for 1 | [internal-slower-0.8x.wav](13a-corrected-selections/internal-slower-0.8x.wav) | `53da1582ea82e3d6bb4ba16d9f7c75f978f838d28dd1f1e05b501bb0a5aeccc7` |
| 2. Accepted: shorter phrase entrance | [phrase-shorter-lead-context.wav](18-voice-phrase-lead/phrase-shorter-lead-context.wav) | `97e80d9879d38b9368322bd355e49c7d32487fbacb8ca95f666d1ad6baf07500` |
| 3. Accepted: generated word with recorded hum | [word-room-context.wav](18-voice-roomtone/word-room-context.wav) | `1e027babed08f14d81429c9384dac87aa13f382e7956683db2a06ae025115493` |
| Original context for 2/3 | [context.wav](18-voice/context.wav) | `779cbc2c8b034ec8aff96879cda49c0042ca4401ac25aab8e41abae3de79bb45` |
| 4. Rejected as speech-free room tone | [pause.wav](18-voice-roomtone/pause.wav) | `00b967c105e8acb9bbcf867439cdaf4301bf2d906801d9d1dbb2529f32b79658` |

This closes the exact three auditions, not broader denoise/spatial coverage,
independent speech-boundary labels, the ambience source/loop gate or physical
capture acceptance. No audio was changed or played automatically while recording
this evidence.

## Complete protected sentence and authored stereo

The user answered the new complete-sentence comparison (“The sample offer says
this is free,” including starts and endings): **“Yes, clear and natural.”**
The separate stereo-headphone balance/naturalness answer was **“Yes, balance and
voice sound good.”** These accept the exact mono-reference/duplicated-stereo
denoise pair and the explicitly authored left-original/right-half-level pair.
They do not approve naturally recorded spatial fields, the separate known-added-
noise packet, precise acoustic word labels or the pending earlier room-tone loop.

| Accepted comparison | File | SHA-256 |
| --- | --- | --- |
| Original sentence | [original.wav](15a3-protected-sentence/original.wav) | `b2b31731a63b3bc973a5fd11661f4b7c3f5384416949a97029c3b0a6043fb05c` |
| Denoised sentence | [candidate.wav](15a3-protected-sentence/candidate.wav) | `f3479c98cd2dbee88da1b4781ef0d5ea51f34d2b1beed7da56931f204d6d4eb6` |
| Authored stereo original | [original-stereo.wav](15a3-protected-sentence/original-stereo.wav) | `458a3c6f28cda0fbaa3ad26942fd157147e423aeff6f7ee98c14f2ec9ffc7aa1` |
| Denoised authored stereo | [candidate-stereo.wav](15a3-protected-sentence/candidate-stereo.wav) | `1f48a774880f4c1c311a0ae40d6cb527bac39a5e0c8b24a6a9128c9baa1a822a` |

## Complete sentence with known added noise

The user answered the level-matched comparison with declared hum, hiss and brief
noise bursts: **“Yes, clearer noise floor and natural words.”** This accepts the
exact pair below for audible noise reduction and clear, natural retained words.
The comparison copy applies only the declared offline Float32 gain; the raw public
RNNoise output remains retained separately. This verdict supplies the remaining
known-noise hearing case in the finite12c/15a3 matrix. It does not establish
independent word-boundary labels or approve the pending room-tone source/loop.

| Comparison surface | File | SHA-256 |
| --- | --- | --- |
| Noisy original | [mixture-source.wav](15a3-noisy-sentence/mixture-source.wav) | `1f10f930f13757d717f16176c2a59a32c2d983875656d5749be970d91fdb2f9a` |
| Accepted level-matched denoised copy | [mixture-processed-matched.wav](15a3-noisy-sentence/mixture-processed-matched.wav) | `cde8d135f31eec1a8b1a2be1d79ebfc4acb1a1abe1ee0b3dcdb088db7340d2eb` |
| Raw public denoised output | [mixture-processed.wav](15a3-noisy-sentence/mixture-processed.wav) | `50530aa33f8895be422db026fb4c8bd060482964ef904e2a42293984148eb010` |
