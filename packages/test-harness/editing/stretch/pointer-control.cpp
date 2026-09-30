// Whole-array control for file-adapter parity and isolated process memory measurements.
#include "Signalsmith.h"
#include <cstdio>
#include <cstdlib>
#include <vector>

int main(int argc, char **argv) {
  if (argc != 6) return 1;
  int first = std::atoi(argv[3]), count = std::atoi(argv[4]), wanted = std::atoi(argv[5]);
  if (first < 0 || count < 1 || wanted < 1) return 1;
  auto input = std::fopen(argv[1], "rb");
  if (!input) return 1;
  std::vector<float> samples(count), output(wanted);
  bool read = std::fseek(input, int64_t(first)*4, SEEK_SET) == 0 &&
    std::fread(samples.data(), 4, count, input) == size_t(count);
  std::fclose(input);
  if (!read || screenrec_stretch_exact(samples.data(), count, output.data(), wanted) != SCREENREC_STRETCH_OK) return 1;
  auto destination = std::fopen(argv[2], "wbx");
  if (!destination) return 1;
  bool written = std::fwrite(output.data(), 4, wanted, destination) == size_t(wanted);
  return std::fclose(destination) || !written;
}
