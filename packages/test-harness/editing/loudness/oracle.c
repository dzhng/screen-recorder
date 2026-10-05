/* Research oracle: independent libebur128 on explicit little-endian Float32 PCM. */
#include "ebur128.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
int main(int argc, char **argv) {
  if (argc != 4) return 2;
  unsigned int channels = (unsigned int)strtoul(argv[2], NULL, 10);
  unsigned long rate = strtoul(argv[3], NULL, 10);
  if ((channels != 1 && channels != 2) || rate == 0) return 2;
  FILE *f = fopen(argv[1], "rb");
  if (!f) return 3;
  ebur128_state *s = ebur128_init(channels, rate, EBUR128_MODE_I | EBUR128_MODE_LRA | EBUR128_MODE_TRUE_PEAK);
  if (!s) return 4;
  float block[8192]; size_t count, frames = 0;
  while ((count = fread(block, sizeof(float), 8192, f))) {
    if (count % channels) return 5;
    for (size_t i = 0; i < count; i++) if (!isfinite(block[i])) return 6;
    if (ebur128_add_frames_float(s, block, count / channels)) return 7;
    frames += count / channels;
  }
  if (ferror(f)) return 8;
  double integrated, range, sample = 0, peak = 0, value;
  if (ebur128_loudness_global(s, &integrated) || ebur128_loudness_range(s, &range)) return 9;
  for (unsigned int i = 0; i < channels; i++) {
    if (ebur128_sample_peak(s, i, &value)) return 10;
    sample = fmax(sample, value);
    if (ebur128_true_peak(s, i, &value)) return 11;
    peak = fmax(peak, value);
  }
  printf("{\"frames\":%zu,\"integratedLufs\":\"%.9g\",\"loudnessRangeLu\":\"%.9g\",\"samplePeakDbfs\":\"%.9g\",\"truePeakDbtp\":\"%.9g\"}\n", frames, integrated, range, 20 * log10(sample), 20 * log10(peak));
  ebur128_destroy(&s); fclose(f); return 0;
}
