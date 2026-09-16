# Bounded retained audio stream

The production excerpt writer now consumes the same finite PCM stream that will
feed movie encoding. No second mixer remains. Before consumption the stream
exposes its resolved sample rate, mono/stereo layout, interleaved Float format,
exact frame count, quantized duration and track-availability reports. Each block
states its cumulative playback frame position and valid frame count; its sample
array contains exactly that many frames. A consumer finishes each block before the
producer proceeds. Retaining an unbounded queue in a consumer violates this contract.

One converter remains alive for each acquired source interval across output blocks.
Span and acquisition/container-gap boundaries reset it; block boundaries do not.
The shared layout still quantizes cumulative playback time, and applies the existing
join ramps inside retained spans. Arithmetic now splits quotient and remainder so
long valid timelines do not overflow intermediate microsecond-to-frame products.
The public excerpt keeps its thirty-second limit, format, gains and availability
semantics. Longer WAVE output is an internal proof sink, not a new public export.

## Verified numerical behavior

[The machine report](report.json) compares all 25 preserved pre-refactor WAVE
fixtures: PCM data and format chunks are byte-exact. The old baseline directory
was only read. Existing native checks still cover offsets, mono/stereo mapping,
unequal rates, acquired/container gaps, cumulative fractional cuts, ramps, silence,
source immutability, the thirty-second boundary and invalid requests.

The scale fixture uses the same generated five-minute, 48 kHz stereo source for
both runs. A ten-second plan emits 477,184 frames and peaks at 28,557,312 native
RSS bytes; the five-minute plan emits 14,397,184 frames and peaks at 29,507,584 bytes.
These counts include two deliberate cuts. The longest block has 8,192 frames; final
blocks hold 2,048 and 3,840 frames without capacity padding. Independent RIFF/data
inspection counts every output frame. Independently read windows at joins, the
middle and near the end disagree with the generated waveform by at most 4.66e-10.
Source hashes before and after the full proof match. These measurements support
bounded decoded memory, not a promise about every machine's speed or memory floor.

A held asynchronous sink receives only one block until it is released/canceled.
Task cancellation unwinds it; a sink throwing after three blocks never returns a
completed result. The five-minute variant additionally cancels the real WAVE sink
after several blocks have reached disk and verifies that both destination and
staging are absent. This WAVE cancellation case is not run in the ten-second
variant, as the report's `waveCancellationExercised` field makes explicit.
A truncated source also fails through the actual native worker without completed
WAVE output or staging litter. No extra process or queue is introduced.

AAC input priming has an additional native/public-wire regression: a two-second
AAC source shifted by 125 ms yields exactly 6,000 leading silent frames followed
by 96,000 decoded frames. It is byte-identical to the pre-refactor native decoder.
FFmpeg's independent AAC decoder differs by 1.264e-5 RMS, while a one-sample shift
in this fixture differs by about 0.0116 RMS. The test allows one 16-bit PCM step
for decoder differences; it does not silently move the start or accept priming as
recorded material. This is input decoding evidence, not AAC movie-encoder proof.

## Reproduce and inspect

After building the native audio test executable and worker:

```
swift run --package-path helpers/mac ScreenRecorderAudioTests
node --test helpers/mac/Tests/audio.test.mjs
node helpers/mac/Tests/streaming-audio.mjs
```

The streaming script generates its own source and independently inspects outputs.
`SCREENREC_AUDIO_STREAM_EVIDENCE` selects an absolute empty artifact directory;
`SCREENREC_AUDIO_BASELINE` optionally names the preserved old fixture directory for
byte-exact comparison. It retains generated long WAVE files outside the repository.
Only the compact report and small playable [uncut tone excerpt](uncut-tone.wav) and
[edited tones](edited-tones.wav) are committed. They contain generated tones, not
speech or personal audio. Independent static review found no actionable regressions.

## Explicit remaining gates

No adjacent-speech audition was performed, and no existing source/edited speech
fixture was present in this checkout or the supplied baseline. The listening gate
remains open. Tone arithmetic does not establish intelligibility or absence of
perceptually objectionable joins in speech. Parent 13 still owns AAC encoding,
audio/video mux duration and drift, pointer composition and public playback/export.

The WAVE sink preserves the existing excerpt publication contract. Cooperative task
failure/cancellation removes its stage; hard process/service death can bypass native
cleanup. Integrated jobs must place output under the established attempt owner and
reclaim its scope after worker termination or restart reconciliation. This slice
does not claim that arbitrary non-cooperative sink code can be interrupted inside
its own await; sinks must honor task cancellation, while the existing worker deadline
and reap remain the authority for native work that does not return.

## Merged verification

The root checkout rebuilt the native audio harness and worker, then passed all
existing native audio assertions, six public native-wire regressions and eleven
core audio tests. Its regenerated WAVE files match all 25 original baseline PCM
and format chunks exactly; [the comparison receipt](merged-pcm.json) names them.
This confirms the shared stream after integration with the explicit-path audio
planner; no AAC movie or speech-audition acceptance is inferred.
