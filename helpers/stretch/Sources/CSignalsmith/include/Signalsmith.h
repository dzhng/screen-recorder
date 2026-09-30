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
  SCREENREC_STRETCH_FAILED = 4,
  SCREENREC_STRETCH_CANCELLED = 5,
  SCREENREC_STRETCH_IO = 6
} ScreenrecStretchStatus;
ScreenrecStretchStatus screenrec_stretch_exact(const float *input, int32_t inputFrames, float *output, int32_t outputFrames);
// Mono 48k native Float32. Input is an immutable readable regular file; firstFrame
// addresses selected samples. Output must be a distinct empty O_RDWR regular file,
// without O_APPEND. The caller owns both descriptors, discards output on EVERY
// non-OK return, and publishes it only after OK. No file positions are changed.
// cancelled may be NULL; otherwise nonzero cancels at bounded page IO boundaries.
ScreenrecStretchStatus screenrec_stretch_exact_file(int inputFD, int64_t firstFrame, int32_t inputFrames, int outputFD, int32_t outputFrames, int (*cancelled)(void *), void *context);
#ifdef __cplusplus
}
#endif
