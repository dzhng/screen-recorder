#include "include/Signalsmith.h"
#include "Exact.h"
#include <algorithm>
#include <cmath>

extern "C" ScreenrecStretchStatus screenrec_stretch_validate(
    int32_t inputFrames, int32_t outputFrames, int32_t channels) {
  if (inputFrames < 1 || outputFrames < 1 || (channels != 1 && channels != 2))
    return SCREENREC_STRETCH_INVALID;
  if (inputFrames == outputFrames) return SCREENREC_STRETCH_OK;
  try {
    screenrec::ExactProcessor stretch(0);
    screenrec::configureExact(stretch, channels);
    return screenrec::admitsExact(stretch, inputFrames, outputFrames)
      ? SCREENREC_STRETCH_OK : SCREENREC_STRETCH_UNSUPPORTED;
  } catch (...) {
    return SCREENREC_STRETCH_FAILED;
  }
}

extern "C" ScreenrecStretchStatus screenrec_stretch_exact(
    const float *input, int32_t inputFrames, float *output, int32_t outputFrames) {
  if (!input || !output || inputFrames < 1 || outputFrames < 1) return SCREENREC_STRETCH_INVALID;
  try {
    for (int32_t i = 0; i < inputFrames; ++i)
      if (!std::isfinite(input[i])) return SCREENREC_STRETCH_NONFINITE;
    if (inputFrames == outputFrames) {
      std::copy(input, input + inputFrames, output);
    } else {
      const float *inputs[] = {input};
      float *outputs[] = {output};
      if (!screenrec::stretchExact(inputs, inputFrames, outputs, outputFrames, 1)) return SCREENREC_STRETCH_UNSUPPORTED;
    }
    for (int32_t i = 0; i < outputFrames; ++i)
      if (!std::isfinite(output[i])) return SCREENREC_STRETCH_NONFINITE;
    return SCREENREC_STRETCH_OK;
  } catch (...) {
    return SCREENREC_STRETCH_FAILED;
  }
}
