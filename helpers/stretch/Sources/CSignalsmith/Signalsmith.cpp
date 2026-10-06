#include "include/Signalsmith.h"
#include "Exact.h"
#include <algorithm>
#include <cmath>

extern "C" YapStretchStatus yap_stretch_validate(
    int32_t inputFrames, int32_t outputFrames, int32_t channels) {
  if (inputFrames < 1 || outputFrames < 1 || (channels != 1 && channels != 2))
    return YAP_STRETCH_INVALID;
  if (inputFrames == outputFrames) return YAP_STRETCH_OK;
  try {
    yap::ExactProcessor stretch(0);
    yap::configureExact(stretch, channels);
    return yap::admitsExact(stretch, inputFrames, outputFrames)
      ? YAP_STRETCH_OK : YAP_STRETCH_UNSUPPORTED;
  } catch (...) {
    return YAP_STRETCH_FAILED;
  }
}

extern "C" YapStretchStatus yap_stretch_exact(
    const float *input, int32_t inputFrames, float *output, int32_t outputFrames) {
  if (!input || !output || inputFrames < 1 || outputFrames < 1) return YAP_STRETCH_INVALID;
  try {
    for (int32_t i = 0; i < inputFrames; ++i)
      if (!std::isfinite(input[i])) return YAP_STRETCH_NONFINITE;
    if (inputFrames == outputFrames) {
      std::copy(input, input + inputFrames, output);
    } else {
      const float *inputs[] = {input};
      float *outputs[] = {output};
      if (!yap::stretchExact(inputs, inputFrames, outputs, outputFrames, 1)) return YAP_STRETCH_UNSUPPORTED;
    }
    for (int32_t i = 0; i < outputFrames; ++i)
      if (!std::isfinite(output[i])) return YAP_STRETCH_NONFINITE;
    return YAP_STRETCH_OK;
  } catch (...) {
    return YAP_STRETCH_FAILED;
  }
}
