#pragma once
#include "vendor/signalsmith-stretch.h"
#include <cstdint>

namespace screenrec {
// One frozen recipe for memory and file accessors. Identity bypass belongs to
// the adapters, preserving float bits without entering the stretch engine.
template<class Inputs, class Outputs>
bool stretchExact(Inputs &input, int inputFrames, Outputs &output, int outputFrames) {
  signalsmith::stretch::SignalsmithStretch<float> stretch(0);
  stretch.presetDefault(1, 48000);
  stretch.setTransposeFactor(1);
  // Upstream converts this expression to int before rejecting short input.
  // Reject unrepresentable seeks instead of invoking undefined conversion.
  float seek = stretch.inputLatency() + (inputFrames / float(outputFrames))*stretch.outputLatency();
  if (seek >= float(INT32_MAX)) return false;
  return stretch.exact(input, inputFrames, output, outputFrames);
}
}
