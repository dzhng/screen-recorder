#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef enum {
  YAP_STRETCH_OK = 0,
  YAP_STRETCH_INVALID = 1,
  YAP_STRETCH_UNSUPPORTED = 2,
  YAP_STRETCH_NONFINITE = 3,
  YAP_STRETCH_FAILED = 4,
  YAP_STRETCH_CANCELLED = 5,
  YAP_STRETCH_IO = 6
} YapStretchStatus;
// Count/channel admission for the fixed recipe, without PCM or file access.
// Success does not validate sample finiteness or the caller's descriptors.
YapStretchStatus yap_stretch_validate(int32_t inputFrames, int32_t outputFrames, int32_t channels);
YapStretchStatus yap_stretch_exact(const float *input, int32_t inputFrames, float *output, int32_t outputFrames);
// Mono/stereo interleaved 48k native Float32. Input is an immutable readable
// regular file. Offsets and counts address frames, not channel samples.
// Output must be a distinct empty O_RDWR regular file,
// without O_APPEND. The caller owns both descriptors, discards output on EVERY
// non-OK return, and publishes it only after OK. No file positions are changed.
// cancelled may be NULL; otherwise nonzero cancels at bounded page IO boundaries.
YapStretchStatus yap_stretch_exact_file(int inputFD, int64_t firstFrame, int32_t inputFrames, int outputFD, int32_t outputFrames, int32_t channels, int (*cancelled)(void *), void *context);
#ifdef __cplusplus
}
#endif
