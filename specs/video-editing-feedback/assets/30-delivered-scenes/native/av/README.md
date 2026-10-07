# Combined delivered scene/audio checkpoint

This retained export is a small public/native A/V experiment for slice 30. One
project carries the solid red/blue video crossfade and two caller-authored audio
sources with the same 250–750ms crossfade window. The committed MP4 contains both
streams. The public scene reader observes video scene rows at 250ms, 500ms and
750ms, and `audio.get` decodes the exported AAC stream to the retained WAV and
landmarks.

The report deliberately keeps the two observations separate. Equal timestamps
do not establish a shared detector or authorize an audio/visual association.
`scene-audio-delivery-replay.mjs` replays the two artifact hashes, stream facts,
scene rows and PCM landmarks without starting the service.
