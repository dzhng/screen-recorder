# Native audio FILE choices

## Sound

- **Medium confidence — use an audio-only ISO MPEG-4 mux for M4A.** A caller asks
  for a file beginning at the first authored sample. Apple's dedicated M4A writer
  leaves encoder priming in its visible timeline and relies on Apple-specific
  metadata. The existing MP4 writer emits the standard edit list and produces an
  AAC-only M4A-compatible file at zero origin. No new codec or mux dependency is
  introduced.
- **High confidence — expose presented content and decoder capacity separately.**
  A three-second 44.1 kHz file presents 132300 samples while a decoder can return
  133056 samples including the final compressed packet's padding. Its packet
  capacity cannot serve as proof of content length. Native receipts distinguish
  both values and validate the presented track against the finite PCM quota.

- **High confidence — keep whole-file conversion distinct from inspection.** The
  caller may export a full four-minute PCM mix. Header probing still has the
  existing finite identification allowance, while complete conversion borrows the
  existing streaming loader's bounded chunks and request count. Other inspection
  callers keep their prior byte limit. Positional WAV header reads are necessary
  because AVAudioFile probing can move a borrowed descriptor's shared offset.
