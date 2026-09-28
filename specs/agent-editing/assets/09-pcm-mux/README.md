# PCM assembly boundary

The native movie assembler consumes `AudioPCMSource` format and bounded async PCM
blocks. Recording mix behavior stays in AudioPCMStream; composition can supply its
own stream without translating editorial plans or decoding an intermediate WAV.
MovieMux remains the one H.264 copy, AAC clock and assembly implementation.

The native worker builds successfully. Existing production-wire audio/movie tests
report [14 passes and one failure](native-preservation.txt), including passing AAC
priming, excluded-source isolation, fractional timing and tiny/sub-sample outputs.
The two-cuts movie case reproducibly fails with short decoded coverage. Restoring
both Swift files to pre-change HEAD and rebuilding reproduces the
[same failure](baseline-two-cuts.txt), so it is not introduced by this extraction.
That existing converter coverage gate remains open; no all-green movie claim is made.

Independent Codex review found no actionable regressions; its own build attempt
waited behind the active SwiftPM build. The implementing run completed the build
and production-wire checks above. This is native preservation evidence, not a
public project preview/export journey or composition mux adoption.

Reproduce with `swift build --package-path helpers/mac --product screenrec-native`,
then `node --test helpers/mac/Tests/movie-render.test.mjs helpers/mac/Tests/audio.test.mjs`.
