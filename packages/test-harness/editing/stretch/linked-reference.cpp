// Direct upstream stereo oracle: planar vectors deliberately differ from file accessors.
#include "signalsmith-stretch.h"
#include <array>
#include <cstdio>
#include <cstdlib>
#include <vector>

int main(int argc, char **argv) {
  if (argc != 6) return 1;
  int first = std::atoi(argv[3]), count = std::atoi(argv[4]), wanted = std::atoi(argv[5]);
  if (first < 0 || count < 1 || wanted < 1) return 1;
  auto input = std::fopen(argv[1], "rb");
  if (!input || std::fseek(input, int64_t(first)*8, SEEK_SET)) return 1;
  std::array<std::vector<float>, 2> samples, output;
  for (int c = 0; c < 2; ++c) {
    samples[c].resize(count);
    output[c].resize(wanted);
  }
  float frame[2];
  for (int i = 0; i < count; ++i) {
    if (std::fread(frame, sizeof(float), 2, input) != 2) return 1;
    for (int c = 0; c < 2; ++c) samples[c][i] = frame[c];
  }
  std::fclose(input);
  if (count == wanted) {
    output = samples;
  } else {
    signalsmith::stretch::SignalsmithStretch<float> stretch(0);
    stretch.presetDefault(2, 48000);
    stretch.setTransposeFactor(1);
    if (!stretch.exact(samples, count, output, wanted)) return 1;
  }
  auto destination = std::fopen(argv[2], "wbx");
  if (!destination) return 1;
  for (int i = 0; i < wanted; ++i) {
    for (int c = 0; c < 2; ++c) frame[c] = output[c][i];
    if (std::fwrite(frame, sizeof(float), 2, destination) != 2) return 1;
  }
  return std::fclose(destination);
}
