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
