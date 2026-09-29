# Slice 08 finite domain audit

Read-only audit, 2026-09-28, main `ebf421ac`. No builds, tests, native experiments, or repository edits were performed for this audit. Paths below are relative to `/Users/david/dev/screen-recorder` unless absolute. This is a proposal for bounded verification, not whole-slice acceptance or a listening judgment.

## Current follow-up, 2026-09-29

This dated audit is historical. Its incoming mixed-rate evidence is banked in
[rate conformance](../08-11-rate-conformance/README.md), and the proposed low/high
cohort is already verified in [lossless rate boundaries](../08-lossless-rate-boundaries/README.md).
Do not repeat those cohorts. Consult [admission boundaries](../08-admission-boundaries/README.md)
and [current audio identification](../../slices/24p-audio-format-admission.md)
before treating the older source-path description below as current behavior.
Actual negative occupied-origin conformance remains unverified: the
[retained candidates](../08-negative-origin/README.md), including the additional
[FFmpeg attempt](../08-negative-origin/ffmpeg-candidate/README.md), either failed
construction or normalized to zero. None closes that gate or justifies a blanket
unsupported-format policy. The original AAC discrepancy remains a separate limit.

## What the code actually admits

Asset admission and executable audio have different domains. `packages/core/src/assets.ts:25-62,512-547` accepts arbitrary codec names and AVFoundation-decodable media; rate metadata is positive finite, channels positive integral, and origin is signed. Timed occupancy must be valid and nonnegative **after normalization**. This does not reject a negative physical origin. Native `MediaProbe.swift:70-106` chooses the earliest occupied asset-target segment across tracks as origin without clamping it to zero. Consequently audio may also start later than the asset-wide origin.

Composition execution is fixed 48 kHz stereo (`CompositionAudio.swift`). Its source path calls `SourceTrack.open` with default `strictWindowFormat: false` (`CompositionAudio.swift:316-324`, `AudioSource.swift:18-25`). The first ASBD rate is rounded to an integer; that value must be 1..192000. Fixed packet size must be 1..32768 native frames; source channels must be 1..8, then composition narrows this to at most two. Mono duplicates to stereo; two channels map by index. Unit-rate source and placement durations must match; changed rate requires prepared retiming. Codec support remains whatever AVFoundation can decode through this path, not a finite codec whitelist.

Raw-source audio windows use `strictWindowFormat: true` (`AudioPCMStream.swift:88`). `AudioSource.swift:108-134` additionally requires integral native rate, mono/stereo, stable rate/channel signature across format descriptions, and conventional layout when layout metadata is supplied. These stricter checks must not be attributed to composition: composition does not currently call them. Existing fractional-rate, four-channel, and discrete-stereo refusal fixtures prove the raw-window boundary, not the composition boundary. This mismatch is a claim/verification gap, not a demonstrated defect from this read-only audit.

## Negative PTS is not blanket unsupported

The probe, signed origin schema, `sourceOffsetUs: -asset.originUs`, and composition manifest validation permit negative occupied presentation origins. `AudioSource.swift:308-313` explicitly preserves a requested negative decode start; the SourceAudio DEBUG test checks that arithmetic. None of this proves successful end-to-end decoding of a real negative-origin asset.

Existing physical-segment fixtures use **positive** 1.25 s presentation origins compensated by negative source offsets. They are not negative-PTS proof. Negative codec priming packet timestamps also do not establish a negative occupied AVFoundation target origin: edit lists may expose origin zero. A candidate normalized to zero does not exercise this branch. Therefore neither “negative PTS works” nor “negative PTS is unsupported” is supported by current media evidence. A host decoder's refusal of one candidate must be reported with its actual phase/error, without generalizing it into a product-wide policy.

## Representative evidence already banked

| Evidence leaf | Domain and proof | Limit |
| --- | --- | --- |
| `08-current-acceptance` | Constant gain, exact mixing, fractional unit-rate edges, isolation, long cardinality, clipping, cancellation/restart | Keep completed timing/storage work; do not restart it |
| `08-lossless-containers` | 48 kHz mono AIFF and stereo ALAC versus authored WAV; exact full/range/split | Named lossless representatives |
| `08-mixed-rates` | 44.1 kHz mono PCM plus independent 48 kHz stereo PCM; exact mixed float sum and fractional range/split | Rational upsampling representative, not every rate |
| `08-compressed-mix`, `08-compressed-endpoints` | 48 kHz mono AAC and stereo MP3; full 2 s endpoint, 96000 frames, 20003 us tail/961 frames | Decoded-source reference isolates mixing; does not establish independent decoder fidelity. Existing narrowly scoped AAC allowance must not silently expand |
| `08-physical-segments` | 44.1/48 kHz, positive nonzero origin, physical holes, acquisition intersections, selected/alternate streams, full/range/split | Native/compiler evidence; no actual negative origin |
| `08-av-drift` | 30-minute public export, 120 fractional edits, clocks with AAC padding separate | Already completed long-clock proof |
| `11a-audio-extraction` | Source-only long AAC tail recovery, bounded reads, >1 GiB public delivery, cancellation/retry, selection/gaps/poison | Source extraction is not composition proof |
| `08-narration-preservation` | Recorded narration, 12 s/576000 stereo frames, visuals-only replacement/overlay/crop; exact full and fractional PCM, source/history/restart/undo, full/range/export clocks, gain-negative control | Lossless proof is separate from AAC differences and optional unreviewed listening excerpts |

Incoming encoding-agent evidence (worker SHA `6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`): `/tmp/screenrec-audio-rates-controlled/report.json` has synthetic 44.1 kHz mono AAC and stereo MP3 mixed with independent 48 kHz stereo PCM. Full 2 s, fractional range, tail, and split have exact clocks and current zero sample differences; frozen decoded 44.1 kHz PCM controls are exact. `/tmp/screenrec-acoustic-rates-final/{rate-axes.json,report.json}` covers raw 44.1 kHz versus project 48 kHz acoustic axes, impulse at 0.64 s, 4410/11025 Hz tones, exact PCM/buckets, and shifted-time/wrong-rate negative controls. Durable `08-11-rate-conformance` leaf is being prepared by its owner.

Do not omit the earlier `/tmp/screenrec-audio-rates-final/report.json` failure: AAC independent ranged sum differed by 5.960464477539063e-8. The failing WAV was not retained in that early harness; subsequent preservation was corrected. The [archived-byte reinspection](../08-11-rate-conformance/aac-repeat-reinspection.md) corrects the earlier repeat summary: all eight resampled repeats are exact, but source repeat 5 differs in 1,486 samples, including its final sample. This localizes a separate reproducibility observation before composition, without establishing the original mixed failure's cause or current-runtime behavior. No tolerance was added. The existing AAC extraction bound (exact clocks/frame count/rate/channels/end samples, max and RMS below 1/32768) is not automatic authorization for this new mixed-rate comparison. Label the observation and keep exact mixing control separate from decoded-source reproducibility.

## Smallest remaining finite proposal, in order

1. **Bank the scoped incoming evidence without broadening claims.** Preserve the failed AAC observation beside the exact controls. If exact independent decoded-reference reproducibility is a binding closure claim, isolate that discrepancy using the existing frozen-PCM/source paths before claiming it; do not introduce a decoder or tolerance to make the harness green.
2. **One actual negative-origin media case.** First inspect native probe/occupied segments of a short known lossless fixture. Proceed only if its occupied target origin is genuinely negative. Through public import/composition, check normalized source selection, exact full/range/tail/split clocks and PCM against known source samples; an independent 48 kHz stereo overlap can reuse the established mixing oracle. Retain actual candidate/refusal if unsupported by the host, or explicitly record normalization to zero as a non-exercise. Do not change admission policy without a separate decision.
3. **One low/high lossless rate cohort.** Use a low integral rate such as 8 or 16 kHz and a high/downsample rate such as 192 kHz against the existing 48 kHz stereo reference. This covers integral upsampling, downsampling, and the upper admitted boundary; 44.1 kHz already covers the nonintegral conversion ratio. Retain full/fractional/tail/split assertions, independent channel signals, and exact floor-clock sample counts. Select the sample oracle according to what is being asserted: known source/native conversion plus exact mixer sum, not an invented independent resampler equality. No Cartesian codec × rate × channel matrix is needed.
4. **One admission-boundary cohort only where claims require it.** Carry the existing fractional-rate and discrete-layout source fixtures through the composition path, plus a >2-channel refusal. Record actual outcomes and compare them with the advertised command contract. Above-192 kHz and invalid packet-size guards are further explicit boundary categories, not reasons to multiply all codec cases. Code inspection establishes guards, not physical-fixture proof. If consistent raw/composition restrictions are intended, that is a subsequent owner-level design/fix decision supported by this evidence, not an audit edit.

Do not add AAC stereo/MP3 mono permutations, every integral rate, or another long extraction/storage run without a concrete uncovered branch or observed interaction. Legacy 32 kHz excerpt tests are useful context but do not establish 48 kHz composition behavior.

## Closure boundary

There is no finite enumerated codec domain in current admission code. A finite representative suite can support named codec/rate/layout/origin cases and explicit branch boundaries; it cannot honestly certify every AVFoundation-decodable format. Either retain that wider domain as an explicit limit or separately define an executable readiness domain. Do not narrow asset storage admission merely to make an acceptance matrix finite.

Recorded-narration listening and join quality remain independent acceptance evidence. Exact unchanged PCM proves that visual edits preserved audio samples; it does not prove the original audio sounds good, that retiming sounds good, or that a listener has approved joins. Optional original/edited WAV excerpts are available in `08-narration-preservation`, but no listening claim was made. Prepared retiming, models, and other slices retain their own acceptance gates. Whole 08 is not closed by this audit.
