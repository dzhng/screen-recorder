# Reviewed choices

- Reused the existing compiler/native mixer and public CLI/MCP acoustic journeys.
  New modules own bounded rate fixtures and their oracles; no backend or public API
  was added. Both existing journeys still run their original assertions.
- Selected a mono AAC and stereo MP3 input at 44.1 kHz against stereo 48 kHz PCM.
  This adds the missing rate/codec overlap without claiming a complete format,
  channel-layout or timestamp-origin matrix.
- Separated fresh codec invocations from frozen-decoder arithmetic. A strict
  zero-delta AAC comparison was invented by this probe, failed once, and is now
  reported as a measurement with exactness booleans rather than a deterministic
  arithmetic gate. The parent explicitly accepted this interpretation only for
  this checkpoint. The failed result remains unresolved; no resampled-AAC
  tolerance or cause was inferred. Exact MP3 gates and the existing AAC source
  maximum-and-RMS bound remain unchanged.
- Kept numerical and visual evidence separate. A deliberately quiet tone is
  numerically detectable but cannot be claimed readable in a flat full-scale
  waveform. The pulse and frequency-axis counterchecks test wrong interpretations
  of delivered artifacts; they are not altered production output.
- Retained every new capture and failure with content deduplication. Original
  absolute scratch paths remain in historical receipts; the manifest provides
  durable byte-addressable files. Earlier failing ranged WAVs were already
  discarded and cannot be reconstructed as the same failed invocation.
- Deferred real speech listening and preservation to its own bounded checkpoint;
  this avoids letting synthetic PCM arithmetic stand in for narration quality.
