# Capture PCM representation boundary — proposal before production change

Observed through actual CaptureWriter callbacks with prerecorded buffers, no devices:
- Float32 mono throughout: 16384 input/output frames, exact independently decoded PCM.
- Int16 mono throughout: 16384 input/output frames, exact independently decoded PCM.
- Float32→int16: 12288 output frames for16384 input; representation transition corrupts.
- Int16→float32: 24576 output frames for16384 input; transition corrupts in reverse too.
- Later44.1k buffer: raw PCM copied under established48k; its declared rate is ignored.
- Later stereo buffer: its bytes become twice as many mono frames.

Removing only sourceFormatHint produces byte-identical outputs in all four original
controls. The hint is not the sole cause; a writer's first input format remains its
conversion contract. Initial int16 conversion works, but accepting a later buffer
is not proof the writer converted its new representation. Inputs, MOVs, decoded
PCM and receipts are retained at /tmp/capture-format-controls and
/tmp/capture-format-no-hint. No production change remains in the worktree.

## Minimal owner correction

Keep one input-format boundary in CaptureWriter's audio-track owner. The established
rate/channel count remains the writer recipe chosen when that role's writer is
created. For every eligible audio buffer, before append:

1. Read the actual PCM format. Reject a rate/channel-count change with
   AUDIO_FORMAT_CHANGED before acceptance, preserving the prior accepted payload.
   Do not treat representation changes as output-format changes.
2. Normalize representation to float32 little-endian interleaved PCM at that SAME
   rate and channel count. Use the platform's PCM-only conversion API, with identity
   channel mapping. No resampling, layout-derived mixing, duration manufacture,
   padding or source-clock change. Every normalized buffer has exactly input N frames.
3. Supply that same canonical format as the writer's input hint and existing output
   recipe. Preserve original timing when constructing the normalized CMSampleBuffer;
   the existing CaptureClock/retiming owner remains authoritative.
4. Keep only the current input-format converter per role, replace/dispose it when
   representation changes, and allocate at most the current bounded buffer. No
   cache keyed by arbitrary formats, history or new asynchronous conversion queue.

A canonical-format fast path may reuse the original buffer after format validation.
It is the same boundary, not a changed-format-only special case. Existing rate and
channel support are not narrowed. Before selecting AVAudioPCMBuffer/AVAudioConverter
versus AudioConverterConvertComplexBuffer, check noninterleaved and packed integer
representation support in a bounded converter probe; do not exclude a representation
merely because a convenience buffer cannot hold it. Both APIs are platform owners,
not custom sample conversion. AudioConverter's complex-buffer API offers direct
AudioBufferList input if the higher-level PCM buffer imposes representation limits.

Tests retain the two unchanged controls and both representation transitions with
independent decoded-input equality, plus rate/channel refusal before the second
append and exact first-buffer preservation. Add a stereo asymmetric/noninterleaved
control to prove identity channel order rather than only frame count. Existing
journal-failure/default capture tests stay green. No schema2 writer rollout.

## Platform basis

Apple documents sourceFormatHint as the expected appended-buffer format, and says
buffers should match it for successful writing:
https://developer.apple.com/documentation/avfoundation/avassetwriterinput/init(mediatype:outputsettings:sourceformathint:)

The local macOS SDK AVAudioConverter.h documents convert(to:from:) as PCM conversion
without codec or sample-rate conversion, output capacity at least input frame count.
Channel mapping explicitly overrides layout-derived mapping:
https://developer.apple.com/documentation/avfaudio/avaudioconverter/convert(to:from:)
https://developer.apple.com/documentation/avfaudio/avaudioconverter/channelmap

This is an offline application-owner correction; it does not claim that a real
ScreenCaptureKit session changed format, or close physical capture20/21.
