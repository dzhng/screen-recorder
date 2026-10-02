# 12i — One retained-sentence supplied-text alignment diagnostic

Preparation is qualified; execution is pending root review. This is one new
bounded question after the closed 12h recognition case: does the same pinned
Qwen3 float16 supplied-text candidate improve that sentence's independently
marked timing? It is not an ASR rerun, model selection, production adoption,
filler inventory or broader speech-quality pass. The toolkit makes no editorial
choice. [Preparation evidence](../assets/12i-sentence-alignment-preparation/README.md)
owns the exact files, commands, hashes and missing historical identities.

## Fixed input and recipe

Use the unchanged checked-in 12d original Float32 mono WAV, all 342720 frames at
48 kHz (7.14 seconds). After separate execution authorization, call the existing
frozen-worker `media.convertSelectedAudio` with the whole file, `sampleRate:16000`,
`channels:1` and a new output path in the owned namespace. No crop, padding,
gain, channel reinterpretation or editorial processing is requested. Require
actual input/output headers, 114240 output frames and full zero-origin support;
bank the complete reply and input/output hashes. The source matches frozen0a.
The conversion shares an audio family with recognition, but missing internal
ASR PCM bytes prevent a causal PCM-equality claim.

Use only the prepared text-only rows derived from actual 12h raw output:
`Um so let's do the first paragraph. Uh this page is a recording fixture.`
All 14 words, capitalization and punctuation remain retained. Neither reference
marks nor recognized timestamps enter the aligner. Use the retained historical
float16 runner unchanged, the exact eight model files and the isolated Python
3.11/56-version environment. Fix MPS, float16, English and offline local-file
loading with the historical OS network-denial sandbox. No alternative precision,
text, model revision, segmentation or parameter search is scheduled.

## One attempt and complete comparison

Recheck the retained source, model, runtime, runner and text identities before
loading. Make one offline alignment attempt under the existing 900-second bound;
bank the actual command, PID, stdout/stderr, terminal exit, durations and peak RSS.
No readiness result, model receipt, historical processing time or raw ASR RPC is
fabricated. The output is an aligner result with its own provenance.

Retain every returned word and timestamp before comparison. Require complete
ordered correspondence with the supplied words. Retain the decoder result
separately from projected evaluator values; use the existing lexical normalization
only to compare punctuation/case, retaining both original spellings. Any missing, extra, reordered, non-finite, inverted or
out-of-support word is a failed correspondence, not a timing improvement.

Project candidate clip seconds once by +50518675 microseconds into the original
source clock. Compare all six independently marked edges (`uh`, `paragraph`,
`this`, each start/end) against unchanged 12h marks and unchanged 100 ms median /
250 ms p95 criteria. Keep every signed error and the original 12h errors beside
it, including any individual regression. Score opening `Um` end separately;
its onset is clip-censored and remains unscored. Preserve the full 7.14-second
input and complete 14-word output even though the marks cover fewer edges.
The unchanged 4 GiB historical resource ceiling remains diagnostic evidence.
Passing this small case would not establish held-out/full-corpus quality or
replace the selected recognizer.

## Stop conditions and authority

Stop before load on a missing or mismatched prerequisite. Stop on conversion
header/frame/support mismatch, model or process failure, deadline, correspondence
failure or resource failure; retain the original failure and do not retry, tune,
download a replacement, widen a limit or mutate an accepted home. A timing result
that fails remains evidence, not permission to edit the recording.

The model/runtime preparation is real and isolated, but the original Python
binary/wheel bytes and historical prepared PCM are unavailable. Preserve this
limitation independently of the exact new pins. Execution requires root review
of this fixed plan; this pass ran no load, conversion, inference or audition.
