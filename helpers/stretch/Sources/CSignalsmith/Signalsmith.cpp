#include "include/Signalsmith.h"
#include "Exact.h"
#include <algorithm>
#include <cmath>

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
