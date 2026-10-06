#pragma once
#include "vendor/signalsmith-stretch.h"
#include <cstdint>

namespace yap {
using ExactProcessor = signalsmith::stretch::SignalsmithStretch<float>;

inline void configureExact(ExactProcessor &stretch, int channels) {
  stretch.presetDefault(channels, 48000);
  stretch.setTransposeFactor(1);
}

inline bool admitsExact(const ExactProcessor &stretch, int inputFrames, int outputFrames) {
  if (inputFrames == outputFrames) return true;
  const float playbackRate = inputFrames / float(outputFrames);
  // Upstream converts this expression to int before rejecting short input.
  // Reject unrepresentable seeks instead of invoking undefined conversion.
  const float seek = stretch.inputLatency() + playbackRate*stretch.outputLatency();
  return seek < float(INT32_MAX) && inputFrames >= stretch.outputSeekLength(playbackRate);
}

// One frozen recipe for memory and file accessors. Identity bypass belongs to
// the adapters, preserving float bits without entering the stretch engine.
template<class Inputs, class Outputs>
bool stretchExact(Inputs &input, int inputFrames, Outputs &output, int outputFrames, int channels) {
  ExactProcessor stretch(0);
  configureExact(stretch, channels);
  if (!admitsExact(stretch, inputFrames, outputFrames)) return false;
  return stretch.exact(input, inputFrames, output, outputFrames);
}
}
