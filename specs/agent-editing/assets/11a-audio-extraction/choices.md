# Decisions reviewed in this pass

- Keep decoder continuation in the shared source reader, so source windows,
  recording spans, and composition have one packet/EOF policy. Reopen at most once
  after actual progress, preserve the exact next sample, and fail on another shortage.
- Use two declared packet widths of bounded decoder context. One packet can still
  begin inside the terminal packet; context never becomes selected converter input.
  Unknown or oversized packet metadata refuses explicitly pending format acceptance.
- Correct AAC-only byte equality to strict clocks/counts/endpoints plus RMS and max
  below one 16-bit quantization step. Prior-binary and packet-aligned negative controls
  show this is pre-existing seek-dependent float output. Preserve exact PCM/ALAC and
  unchanged successful old/new range bytes; do not normalize or quantize output.
- Keep full WAV delivery in existing cache/job/artifact owners. The journey measures
  actual large native extraction and full streamed delivery; it adds no runtime store.
- Retain compact provenance and compressed references. Sampled RSS is scoped evidence,
  not proof of every long-media or codec combination. No fresh model inference claim.
