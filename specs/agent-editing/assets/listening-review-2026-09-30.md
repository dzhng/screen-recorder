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

This first review closes its exact three auditions. Later sections record the
remaining finite denoise cases; independent speech-boundary labels, the ambience
source/loop gate and physical capture acceptance remain separate. No audio was changed or played automatically while recording
this evidence.

## Complete protected sentence and authored stereo

The user answered the new complete-sentence comparison (“The sample offer says
this is free,” including starts and endings): **“Yes, clear and natural.”**
The separate stereo-headphone balance/naturalness answer was **“Yes, balance and
voice sound good.”** These accept the exact mono-reference/duplicated-stereo
denoise pair and the explicitly authored left-original/right-half-level pair.
Their verdicts apply to those exact pairs; the known-noise case has its separate
verdict below. Precise acoustic word labels and the earlier room-tone loop remain
unverified. No arbitrary spatial-field guarantee follows from this channel case.

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

## Earlier room-tone loop — seam rejection

After listening to the six-second +24 dB monitoring copy, the user reported:
**“There are noticeable repeat seams.”** This fails that exact candidate's loop
continuity check. It does not establish whether the selected region is speech-free;
that part of the question remains unverified. The original pause's separate voice
blip finding and all accepted denoise/voice contexts remain unchanged.

| Presented surface | File | SHA-256 |
| --- | --- | --- |
| Rejected seam audition | [loop-monitor-plus24db.wav](19-clean-roomtone/loop-monitor-plus24db.wav) | `23bbe8eebcb57f8410daefb1ba2418621abac20ae473bf3710c79b598b3d5493` |
| Normal-level counterpart, retained | [loop.wav](19-clean-roomtone/loop.wav) | `1619ff735b564740fb58f7b546f928853515e93c7cb2e8aa9e3daa3e12344dec` |

The frozen packet's assembly-time pending state and all recipe/media identities
remain preserved. A revised explicit overlap treatment may be auditioned from
that same selected region; mechanics alone cannot claim the audible seams fixed.

## Longer curved room-tone overlaps — qualified improvement

The exact six-second200ms-overlap monitoring copy initially received
**“Yes, speech-free and continuous.”** The user then qualified that answer:
**“better, still a little bit of seam but much less noticible. if there are any
other low hanging fruits you should try it to see if you can improve”**.
Record the later, more specific disposition: the source sounds speech-free and
this treatment improves the seams, with a slight residual seam still reported.
Do not treat the initial answer as an unqualified seamlessness verdict.

| Reviewed surface | File | SHA-256 |
| --- | --- | --- |
| Improved200ms overlap, +24dB monitoring copy | [loop-monitor-plus24db.wav](19-soft-roomtone-overlap/loop-monitor-plus24db.wav) | `674f8b5f7f800876e561ba4479e5350f77c9410732789459cfba273235547771` |
| Normal-level counterpart | [loop.wav](19-soft-roomtone-overlap/loop.wav) | `7fa912f6ced158759e62ed7e5f6577034b731d1ca18fce3e27ac67147f66ff55` |

The following250ms-overlap comparison uses the same source region and diagnostic
gain. It removes interior single-copy sections through explicit public gain
curves; its full PCM, transport and undo checks pass. Its later rejection and the final choice appear below; the mechanical checks
cannot supply an audible improvement verdict.

## Final room-tone choice

After hearing the250ms comparison, the user replied:
**“before was better, this one just have higher frequency wirling sound. let's
jsut go with before”**. This selects the exact200ms version above, with its
acknowledged slight residual seam. The speech-free verdict remains; that residual
is explicitly tolerated in the selected treatment. Do not perform further loop
experiments or transfer this choice to new source material without a new request.

The250ms candidate is rejected for the reported whirling sound. Its mechanical
checks remain valid but do not override that listening result.

| Final disposition | File | SHA-256 |
| --- | --- | --- |
| Selected200ms monitoring copy, slight seam tolerated | [loop-monitor-plus24db.wav](19-soft-roomtone-overlap/loop-monitor-plus24db.wav) | `674f8b5f7f800876e561ba4479e5350f77c9410732789459cfba273235547771` |
| Rejected250ms monitoring copy | [loop-monitor-plus24db.wav](19-half-roomtone-overlap/loop-monitor-plus24db.wav) | `18b107789a77b3941c2f5f0a49b242f300deb21f3ac4a87a249f3c206c446163` |
