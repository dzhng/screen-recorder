# Frozen local denoise acceptance

The finite 12c/15a3 matrix and 15a public integration are accepted for the frozen
local RNNoise implementation. The [user listening record](../listening-review-2026-09-30.md)
owns exact media identities and verdicts. Technical receipts establish execution,
state and delivered-media contracts separately; none claims to hear the output.
The earlier preference and unfamiliar cropped-word observations are historical
evidence, not the word-retention pass.

| Required case or contract | Authoritative evidence |
| --- | --- |
| Real narration/room tone; conventional and learned comparison; frozen recipe | [Matched controls](../12c-matched-noise/README.md), [selected learned recipe](../12c-rnnoise/README.md) and [native-entry parity](../15a1-denoise-entry/README.md) |
| Clean/reference-only controls; stationary and transient noise measured separately | [Independent clean controls](../12c-clean-reference/README.md), matched controls above and [transient controls](../12c-transient-noise/README.md) |
| Protected words, consonants, starts/ends and naturalness | [Familiar sentence](../12c-familiar-sentence/README.md), [different protected sentence](../15a3-protected-sentence/README.md) and exact user verdicts |
| Known added noise; raw gain/clipping and separately matched audition | [Complete known-noise sentence](../15a3-noisy-sentence/README.md), its [root replay](../15a3-noisy-sentence/root-verification.json) and user verdict |
| Post-retime speech quality | [Accepted familiar post-retime output](../15a3-post-retime-familiar/README.md) and user verdict |
| Channel policy and balance | [Independent-channel execution](../15a2f-independent-channels/README.md), [authored stereo audition](../15a3-protected-sentence/README-stereo.md), [root replay](../15a3-protected-sentence/root-stereo-verification.json) and user verdict |
| Exact sample count/latency/tails, repeatability, arbitrary input chunks and short selections | [Frame timing/state](../12c-rnnoise-timing/README.md) and native-entry parity above |
| Selected-input isolation, pure splits versus changed retained input, bounded full/range reads | [Retained reproduction](../12c-prepared-output/README.md), [linked runtime](../15a2d-linked-runtime/README.md) and [selected-input isolation](../15a2e-state-isolation/README.md) |
| Combined overlapping inputs, noncommuting order, window/mix animation, dry neighbors and history | [Combined public join](../15a3a-unit-rate-combined/README.md), [explicit transitions](../15a3b-denoise-transitions/README.md) and [fresh skill use](../15a3b-mix-skill/README.md) |
| Preserve-pitch and follow-pitch learned delivery through public preview/export | [Combined preserve-pitch proof](../15a3c-post-retime-combined/root-verification.json), [follow-pitch public proof](../15a3e-follow-learned-public/root-verification.json) and [matched movie proof](../15a3f-follow-learned-movie/verification.json) |
| Immutable revisions, concurrent identities, fenced publication, retry/cancel/restart and unavailable processing | [Shared preparation lifecycle](../14a-prepared-audio/README.md), linked runtime above and the existing [queue tests](../../../../packages/core/src/jobs.test.ts) |
| Retained portability and long/late delivery | [Learned portable transfer](../14a-learned-portable/README.md), [successful long output](../../slices/24f-successful-learned-scale.md) and [deep/wide learned routing](../24v-learned-routing-scale/README.md) |

The stereo case is explicitly authored, with its intended relationship retained;
no naturally captured spatial field or additional speaker is required by this
matrix. The different protected sentence and known-noise comparison resolve the
concrete remaining quality questions without turning an individual verdict into
a guarantee for arbitrary media. Noise-only attenuation, clean-reference waveform
change and mixture error remain separately reported, including unfavorable
measurements; the user verdict owns retained-word/naturalness acceptance.

Independent word-boundary labels and filler/repetition inventory belong to 12/12d's
cut-accuracy gate, not denoise sample-grid preservation. The unanswered 19 room-tone
source/loop question remains separate: denoising and ambience fill are independent
editorial choices. Installed cutover 23, final scale 24 and autonomous 25 remain their
own gates; earlier scoped scale proofs do not close them. External model
redistribution remains unverified outside this local personal implementation.

Existing assembly manifests and reviews retain their creation-time pending states
and hashes. Later user verdicts supersede those listening dispositions without
changing the frozen media, recipe or historical execution evidence. Runnable
reproduction owners are the existing frame/parity/native/public harnesses linked
above; no extra denoise wrapper or renamed probe is introduced.
