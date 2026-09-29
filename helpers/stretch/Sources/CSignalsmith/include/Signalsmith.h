#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef enum {
  SCREENREC_STRETCH_OK = 0,
  SCREENREC_STRETCH_INVALID = 1,
  SCREENREC_STRETCH_UNSUPPORTED = 2,
  SCREENREC_STRETCH_NONFINITE = 3,
  SCREENREC_STRETCH_FAILED = 4
} ScreenrecStretchStatus;
ScreenrecStretchStatus screenrec_stretch_exact(const float *input, int32_t inputFrames, float *output, int32_t outputFrames);
#ifdef __cplusplus
}
#endif
