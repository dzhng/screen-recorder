# Native selected-source transcription prerequisite

This pass verifies the native prerequisite for source acquisition. It does not
close public acquisition, asset transcript ownership or CLI/MCP acceptance.

The [selected-source report](selected/report.json) compares two distinguishable
parts of the retained real narration placed in separate streams of one container.
The container has a nonzero origin and an internal empty edit. Both physical
support and narrower acquisition masks produce the exact expected readable
intervals. Selected PCM is byte-identical to the frozen worker's corresponding
single-stream excerpt. Complete raw transcripts—including tokens, confidence,
words and source ranges—match the frozen worker and the new unique-stream path.
Only the engine's measured `processingTime` is excluded from equality.
Requests, receipts, raw lines and model-file pins are retained beside the report.
No synthetic narration, model download or alternate decoder is used.

The [harness](../../../../../packages/test-harness/editing/selected-source-transcription.mjs)
requires an existing prepared model request, a frozen native binary and the new
native binary. It denies network access to all native calls. Fixture construction
decodes the real take to PCM before placing known sample boundaries. The retained
[first fixture failure](failures/capture-priming-fixture.json) shows why directly
placing the captured AAC track would import its original priming and sample
endpoint into the fixture's asserted clock. Native rounding was not changed.

## Ownership and reuse

`AudioSourceSelection` holds source path, optional stream ID, source-clock offset
and acquisition support. Omission selects only a unique audio stream; ambiguous
selection refuses. Native speech rejects recording roles, including null roles.
The actual recording transcript writer emits the neutral request while retaining
its recording-domain ingestion metadata.

`AudioPCMStream.open(source:spans:sampleRate:)` and `readableIntervals(of:)` share
SourceTrack, AudioSourceReader and interval-local conversion with recording
mixes. The stream conforms to AudioPCMSource and can feed the existing WAVE sink,
so later selected-source inspection needs no second decoder. PCM reports are
neutral; recording audio/movie receipt construction attaches the actual role.
Channel treatment, join ramps, quantization, unsupported-format boundaries and
the ASR/word-merging recipe remain unchanged.

## Preservation and review

The [native preservation run](native-preservation.txt) keeps recording audio,
movie and speech wire checks. [Final wire checks](wire-and-speech.txt),
[core evidence/model/transcript/audio checks](core-preservation.txt),
[recording PCM checks](recording-audio.txt) and [word merging](word-merger.txt)
passed. Removing the unique-stream guard made the
[ambiguity regression fail](failures/ambiguity-guard-removed.txt); the guard was
restored before final native verification.

Independent Codex review found no actionable source/test regression. Its native
attempts were limited by its sandbox (audio reader startup and sandbox-exec), so
native acceptance here rests on the retained actual executions, not that review.
Shape review kept one PCM/conversion owner and removed the role-bearing speech
request. Setup dependency symlinks are excluded from the commit. No app launch,
capture, playback, installation or user-library change was performed.

The [full narration manifest](full-narration.json) retains the known speech-quality
boundary. All 306 inherited words and spoken ranges remain exact. The unchanged
100/250 ms median/p95 timing targets still fail at 135/578.1 ms; cleanup and
listening acceptance remain open. Source selection is not an ASR quality change.
