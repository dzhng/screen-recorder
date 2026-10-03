# Waveform reduction boundary

The [reducer](../../../../../packages/core/src/audio-wave.ts) reads published PCM
through the existing retained-file interface. Sharing WAV validation with audio
publication prevents inspection and delivery from disagreeing about the data
chunk or channel layout. The header byte offset never supplies the time origin.

Waveform resolution is an internal sample count. Buckets use a global sample grid;
clipped edges report their actual support and partial status. This preserves the
meaning of a bucket when an agent narrows its inspection window. Per-channel RMS
uses all samples in the returned support, including real zeros, without treating
missing capture context as evidence that the source was quiet. The later public
artifact envelope must retain unavailable-support metadata from its audio parent.

[Native tests](native-tests.txt) preserve the existing project-tap PCM assertions
and additionally reduce their actual published WAVs under acquired cache leases.
The native worker SHA-256 is
`3daf3c17dc5e093c46486c9ac074e042f52bad716209a1500f4fcd3c83e57b7b`.
The large-file positioned-read test uses a sparse authored WAV; it demonstrates
bounded I/O, not a second native gigabyte extraction. Cancellation and asynchronous
reads retain the existing cache deletion fence until the caller releases its lease.

[Resetting the absolute grid](grid-mutation.txt) makes the impulse/window and
late-file tests fail; the restored implementation passes. Independent
[review](review.txt) found no actionable defects. That reviewer skipped the optional
native test; the explicit native run above did not.

No cached acoustic job, public waveform endpoint, image, spectrogram, heuristic
edit or listening capability is accepted by this pass. Those remain in slice 11.
