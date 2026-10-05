// Research adapter for the audited integer-stride, zero-padded SDK window clock.
// The caller must bind these dimensions to the exact provider and input receipts.
export function mapPaddedSource(raw, proof) {
  const { sourceFrameCount, sampleRate, windowSamples, stepSamples, outputFramesPerWindow } = proof;
  if (
    ![sourceFrameCount, sampleRate, windowSamples, stepSamples, outputFramesPerWindow].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new Error("Invalid source-clock dimensions");
  const sourceEnd = sourceFrameCount / sampleRate;
  const lastOffset = Math.floor((sourceFrameCount - 1) / stepSamples) * stepSamples;
  const frameDuration = windowSamples / sampleRate / outputFramesPerWindow;
  const analysisFrames = Math.ceil(
    (lastOffset / sampleRate + windowSamples / sampleRate) / frameDuration,
  );
  const analysisEnd = Math.max(
    analysisFrames * frameDuration,
    Math.fround(analysisFrames * frameDuration),
  );
  const segments = [];
  const excludedPadding = [];
  for (const [index, segment] of raw.entries()) {
    if (
      !Number.isFinite(segment.start) ||
      !Number.isFinite(segment.end) ||
      segment.start < 0 ||
      segment.end <= segment.start ||
      segment.end > analysisEnd
    )
      throw new Error("Interval outside proven analysis support");
    if (segment.end > sourceEnd)
      excludedPadding.push({
        index,
        speaker: segment.speaker,
        start: Math.max(segment.start, sourceEnd),
        end: segment.end,
      });
    if (segment.start < sourceEnd)
      segments.push({ ...segment, end: Math.min(segment.end, sourceEnd) });
  }
  return { segments, excludedPadding, sourceEnd, analysisEnd, analysisFrames };
}
