# Voice acceptance handoff: slices 18/19

Historical audit at the revision named below. Current managed generation and origin
lifetimes are verified in [19f](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/19f-public-voice-jobs.md). Current
[phrase](../18-voice-boundary-timing/README.md) and
[word](../18-word-boundary-timing/README.md) boundary visuals have since passed.
The implementation/visual pickup statements below are superseded. The later
[user review](../listening-review-2026-09-30.md) also supersedes the pending
current phrase/word verdicts and the unreviewed pause disposition below. Preserve
the historical rejected branches; do not use this audit as the current pickup.


Read-only audit at `0552f070`, `/Users/david/dev/screen-recorder`. No generation, model download, recipe change, playback, visual acceptance, UI work or user question was performed. Findings use the retained experiment, choices ledger and recorded user feedback; absence of a recorded response is not approval and does not establish that the user literally never heard a file.

## Current selected candidate

Preserve the original reference-audio-plus-transcript conditioning mode, pinned MLX Audio commit `4ab7e6f7dedd69a136cfaa318c5dc8aed5119446`, Qwen3-TTS model revision `1eccf1cb2519b5a4e8a95b5f0544f3303568164f`, reference bytes and frozen generated outputs. The runtime's effective minimum repetition penalty is 1.5 even though the original request supplied 1.05; preserve that observed behavior when integration eventually occurs. Frozen output bytes, not seed 18, own replay.

The latest phrase candidate is `specs/agent-editing/assets/18-voice-phrase-lead/phrase-shorter-lead-context.wav`, SHA256 `97e80d9879d38b9368322bd355e49c7d32487fbacb8ca95f666d1ad6baf07500`. It is the previous original-mode voice-plus-recorded-hum candidate with 120 ms removed at its entrance and only the 5 ms entrance crossfade rebuilt. The word candidate remains `18-voice-roomtone/word-room-context.wav`; it was not regenerated or changed by this adjustment.

## Accepted, rejected and still without a verdict

| Piece | Recorded disposition | What must not be inferred |
| --- | --- | --- |
| Original reference-conditioned voice | User: “Voice is close, but joins sound wrong.” A closer candidate worth preserving | Full identity, delivery, pronunciation or splice acceptance |
| Initial direct-concatenation joins | Rejected as wrong; replacement also sounded louder | Numeric lexical/performance success cannot reverse that verdict |
| Gain-only audition | User still heard excessive pauses and a more echoey voice afterward | Level matching did not close joins or demonstrate removal of echo |
| First aggressively shortened word | Recognizer changed “paid” to “page”; rejected technically and retained under `18-voice-joins/rejected-short-word` | ASR boundaries are not exact acoustic cut boundaries |
| Restored consonant tail / tighter original-mode word and phrase | ASR agreement restored; no full listening acceptance recorded | Passing ASR is not a human quality verdict |
| Speaker-only conditioning | Explicitly rejected as “way worse”; retained negative evidence | Do not restart this branch or select it because its words pass ASR |
| Addition of actual original background hum | Explicitly requested workflow; original-mode candidate retained | The chosen pause is not independently confirmed speech-free; no universal ambience or de-reverberation policy was approved |
| Room-tone phrase ending | Accepted in the recorded feedback; entrance still too long | Acceptance is scoped to that ending, not the whole phrase or word candidate |
| Latest 120 ms-shorter phrase entrance | No subsequent listening verdict recorded | It is a pending audition, not an accepted fix or proof that120 ms is the right automatic trim |
| Final room-tone word candidate | No separate final approval found | Do not label it accepted or certainly unheard merely because the latest comment discussed the phrase |

Evidence chain: `18-voice/README.md`, `18-voice-levels/README.md`, `18-voice-joins/README.md`, `18-voice-speaker-only/README.md`, `18-voice-roomtone/README.md`, `18-voice-phrase-lead/README.md`, and `choices.md` sections on tighter joins, room tone and shortening only the entrance. The choice to preserve the accepted ending is already settled; it should not be reopened through regeneration or a different mix.

## What is already technically demonstrated

- Six offline generations from pinned runtime/weights/reference/config; OS network-denial canary and offline flags. All three origin paths produced identical bytes for a given text in this run.
- Five warm requests measured wall/audio RTF1.258–1.926, meeting the slice's observed-host target≤2. Initial load plus first generation was66.08s and is not a warm result. Peak MLX allocation5.98GiB and process peakRSS2.19GiB are separate overlapping counters, not a sum; both observed counters were below12GiB. This is not a percentile or universal latency claim.
- Independent local recognizer agreement for the two generated texts (“paid” and “This is available at no cost.”) and reference transcript; a missing-output negative control fails. This closes that lexical cross-check only. No need to rerun synthesis or ASR merely because the original README predates the lexical checkpoint.
- Room-tone extraction/assembly provenance and sample preservation were independently reconstructed. The revised word context retains the recognized “this is paid” after an earlier boundary choice dropped “is.” The unchanged trailing fragment varies between recognizer outputs; it is not protected-word ground truth.
- The 120 ms edit removes2880 samples at24kHz. Its report pins151920 output frames and an exact suffix comparison from new frame53968 to previous frame56848. All97952 suffix samples, including voice level, hum, exit transition and trailing context, remain identical to the previous candidate. Latest isolated/context lexical reports retain the requested phrase. This is preservation evidence, not a new ending audition or entrance acceptance.

The original source hash and both prior/current phrase-context hashes were rechecked during this audit and match retained provenance. No media reconstruction or inference was rerun.

## Complete own-recording context is available

The original is `fixtures/narrated-workbench/narration.mov`, SHA256 `2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c`; the actual file is present. It contains the complete surrounding speech, not merely the five-second experiment excerpt.

The frozen reference is source range1..6s, with inherited-ASR text “Okay, so this is the recorder workbench.” The original audition context is source71.5..76.5s. It contains the meaningful target sentence, “The sample offer says this is free,” but also begins near the previous “identify” tail and cuts off the following sentence. The latest context recognizer rendering “You can mention the sentence here” does not make that source sentence complete.

The inherited full transcript places the target sentence approximately72.288675..74.528675s and the following sentence approximately74.768675..84.128675s: “You can mention the sentence in your narration and ask an external agent to find the spoken phrase from the recorded … the recorded evidence.” It includes a spoken/recognized self-correction; do not silently rewrite it. A candidate source context around72.0..84.5s could preserve both full utterances and their quiet margins. These are transcript-derived candidate bounds, not independently verified acoustic word labels. The known source origin is48675µs; any later extraction must use the existing origin conversion rather than treating decoded-zero and source time as identical.

No wider edited context is currently frozen. If it is later useful, extend the **existing frozen audition** with original before/after samples and prove the central accepted suffix remains untouched; do not regenerate speech, rebuild the room-tone bed or change the recipe just to provide context.

## The 12c lesson applies directly

`12c-protected-speech/user-review.json` records that the user heard no obvious artifacts in four short clips but found them random/confusing and could not understand the words. It explicitly does not confirm intelligibility or word retention and requests no further action on those clips. Future user review should use complete meaningful sentences from their own recording and one clear comparison question.

Therefore do not send isolated onset/tail fragments, a new checklist of unrelated comparisons, or another listening request during this audit. The pending 120 ms entrance verdict stays pending. “Nothing weird heard,” recognizer agreement, sample equality and waveform appearance are four different observations; none substitutes for the missing voice/continuity judgment.

## Remaining gates and the smallest non-listening pass

**Listening-dependent:** final entrance timing, whole-phrase/word delivery, pronunciation/intelligibility to a listener, speaker identity, echo/room continuity, protected joins and whether the selected hum region is actually speech-free. Accepted ending remains accepted within its original scope. No number or picture can close these.

**Visual/technical and independent of another generation:** slice 18 still requires calibrated original-versus-candidate boundary waveform/spectrogram evidence and an unprimed visual review. The existing PNGs are500ms windows of the original direct-concatenation outputs, with no calibrated amplitude axis; they are neither the current room-tone/120 ms candidate nor an accepted visual gate. The smallest useful next pass is one bounded visual evidence pass over the **frozen current phrase candidate and prior accepted-ending candidate**, plus corresponding original boundaries: shared calibrated axes, correct source/output offsets, exact unchanged-suffix markers, and independent critique limited to timing/support. It must not infer identity, click audibility or naturalness. The existing exact suffix/lexical checks should be reused rather than rerun model research.

If a future user comparison is authorized, fuller meaningful context can be assembled from retained original bytes without changing this candidate. That is presentation preparation, not a new synthesis/fit recipe; it is not necessary to ask a question now.

**Managed origin/provenance and slice 19:** the three origin cases were copies of one selected reference, not real managed same-take/external/past-project lifetimes. Slice 19 remains unstarted, and no `voice.generate` operation was found in the current production registry/service/core. Durable generation, explicit model preparation, bounded reference retention, output publication, retry/cancel/crash/lost-response replay, donor deletion, model-unavailable rendering, ordinary audio-only placement/undo and actual CLI/MCP parity remain implementation work. Existing AssetStore/JobQueue/PreparedAudio/public delivery owners are prerequisites, not voice parity evidence. Integrating a new generation endpoint before the candidate's remaining quality disposition would not close 18 and should not be disguised as a small audit cleanup.

No new model, conditioning experiment, automatic crop, loudness policy, room-tone policy, visual UI or duplicated lifecycle owner is justified. Preserve the selected original mode, its reference/config quirks, frozen voice bytes and accepted ending. The only small non-listening pass identified is current-candidate calibrated visual evidence; whole 18/19 acceptance remains open.
