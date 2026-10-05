# Selected audio and compiled PCM

Source reads and project rendering share physical decoding while retaining different
selection authority. A selected source requires agreement between supplied support
and occupied container segments. A project consumes the compiler's source schedule
and ordered processing tree. Missing acquisition and authored silence stay distinct,
even when both deliver zero samples.

## Support, phase and context

The [source stream](AudioPCMStream.swift) preserves native support origin and bounded
sample demand. Selected transcription joins readable spans in its own cumulative
sample clock; speech conditioning is separate from authored processing.

Prepared audio retains the shared [media input](../ScreenRecorderMedia/README.md)
through consumption. Metadata and primary chunk-storage admission precede an
explicit streaming transition, so an inspection allowance cannot truncate a
whole-source PCM request.

The [composition owner](../../../../packages/composition/README.md) selects resampling
context and state domains. Native filtering must preserve that context across
blocks and structural splits, without reading material an edit removed. Parents
process summed child PCM; empty or bypassed stacks do not add an implicit gain or
join policy. Learned state is independent per output channel, and preparation
publishes only a complete paired result through the existing durable owner.

The [RNNoise dependency](../../../denoise/README.md) owns its fixed mono recipe;
[time/pitch processing](../../../stretch/README.md) owns the adopted stretch library.
Those dependencies do not choose project context or create preparation lifecycles.

## Conversion and encoding

[Selected conversion](SelectedAudioConversion.swift) starts phase at selected frame
zero and continues across delivery blocks. Validated input length defines filter
support; a separately floored output quota defines publication length. Channel
mapping follows rate conversion. Non-finite results refuse rather than being
normalized or clipped into a successful answer. Conversion may normalize signed
zero, so exact source-file preservation needs the caller's verified reuse path.

Selected silence can contain filter contributions from adjacent selected samples.
Reapplying a missing-source mask to already mixed PCM would change the authored
result. Source windows, composition windows and completed selected files therefore
retain their own support policies rather than sharing an assumed zero-origin filter.

Movie assembly binds the compiler's picture and audio planes once. Standalone WAV
and encoded audio use that same completed PCM; audio-only output does not need a
picture renderer. Consumption rebases window sample positions without changing
stored project clocks.

AAC priming and terminal packet capacity differ from authored content. Empty audio
edit support can close a movie clock gap without generating PCM or changing encoded
packets. Presented edit-list timing remains authoritative when external tools round
duration to decoded samples. Lossless WAV identity cannot establish AAC waveform
identity or perceptual quality.

[Verification tools](../../../../packages/test-harness/editing/README.md) locate
independent numerical, endpoint and publication proof. Listening, source selection,
conversion and cancellation are separate claims; one successful encoder cannot
certify all of them.
