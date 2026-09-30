#include "include/Signalsmith.h"
#include "Exact.h"
#include <array>
#include <algorithm>
#include <cmath>
#include <cerrno>
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>

namespace {
struct Failure { ScreenrecStretchStatus status; };
struct Cancellation {
  int (*check)(void *);
  void *context;
  void poll() { if (check && check(context)) throw Failure{SCREENREC_STRETCH_CANCELLED}; }
};
// exact() scans then revisits input, and subtracts a reflected tail from output.
// An indexed page preserves those accesses without splitting its DSP calls.
class Page {
  static constexpr int capacity = 4096;
  std::array<float, capacity> samples{};
  int fd, frames, start = -1, length = 0;
  int64_t first;
  bool output;
  Cancellation &cancellation;
public:
  Page(int fd, int64_t first, int frames, bool output, Cancellation &cancellation)
    : fd(fd), frames(frames), first(first), output(output), cancellation(cancellation) {}
  void flush() {
    if (!output || start < 0) return;
    for (int i = 0; i < length; ++i)
      if (!std::isfinite(samples[i])) throw Failure{SCREENREC_STRETCH_NONFINITE};
    transfer(true);
  }
  void transfer(bool write) {
    size_t done = 0, bytes = size_t(length)*sizeof(float);
    while (done < bytes) {
      cancellation.poll();
      auto offset = (first + start)*int64_t(sizeof(float)) + done;
      auto pointer = reinterpret_cast<char *>(samples.data()) + done;
      ssize_t count = write ? pwrite(fd, pointer, bytes - done, offset)
                            : pread(fd, pointer, bytes - done, offset);
      if (count < 0 && errno == EINTR) continue;
      if (count <= 0) throw Failure{SCREENREC_STRETCH_IO};
      done += size_t(count);
    }
  }
  float &at(int index) {
    if (index < 0 || index >= frames) throw Failure{SCREENREC_STRETCH_INVALID};
    if (start < 0 || index < start || index >= start + length) {
      cancellation.poll();
      flush();
      start = index / capacity * capacity;
      length = std::min(capacity, frames - start);
      if (output) {
        // Output accesses are forward except the final reflected-tail subtraction.
        // Re-reading persisted pages handles that revisit without endpoint assumptions.
        samples.fill(0);
        transfer(false);
      } else {
        transfer(false);
        for (int i = 0; i < length; ++i)
          if (!std::isfinite(samples[i])) throw Failure{SCREENREC_STRETCH_NONFINITE};
      }
    }
    return samples[index - start];
  }
  struct Channel { Page &page; float &operator[](int index) { return page.at(index); } };
  Channel operator[](int) { return {*this}; }
};
}
extern "C" ScreenrecStretchStatus screenrec_stretch_exact_file(
    int inputFD, int64_t firstFrame, int32_t inputFrames, int outputFD, int32_t outputFrames,
    int (*cancelled)(void *), void *context) {
  if (firstFrame < 0 || inputFrames < 1 || outputFrames < 1 ||
      firstFrame > INT64_MAX / 4 - inputFrames) return SCREENREC_STRETCH_INVALID;
  struct stat inputStat{}, outputStat{};
  if (fstat(inputFD, &inputStat) || fstat(outputFD, &outputStat)) return SCREENREC_STRETCH_IO;
  if (!S_ISREG(inputStat.st_mode) || !S_ISREG(outputStat.st_mode) ||
      (inputStat.st_dev == outputStat.st_dev && inputStat.st_ino == outputStat.st_ino) ||
      inputStat.st_size < (firstFrame + inputFrames)*4 || outputStat.st_size != 0 ||
      (fcntl(outputFD, F_GETFL) & O_APPEND))
    return SCREENREC_STRETCH_INVALID;
  try {
    Cancellation cancellation{cancelled, context};
    cancellation.poll();
    if (ftruncate(outputFD, int64_t(outputFrames)*4)) return SCREENREC_STRETCH_IO;
    Page input(inputFD, firstFrame, inputFrames, false, cancellation);
    Page output(outputFD, 0, outputFrames, true, cancellation);
    // Validate the complete selected input, including identity and any unread endpoint.
    for (int i = 0; i < inputFrames; ++i) (void)input.at(i);
    if (inputFrames == outputFrames) {
      for (int i = 0; i < inputFrames; ++i) output.at(i) = input.at(i);
    } else {
      if (!screenrec::stretchExact(input, inputFrames, output, outputFrames))
        throw Failure{SCREENREC_STRETCH_UNSUPPORTED};
    }
    output.flush();
    cancellation.poll();
    return SCREENREC_STRETCH_OK;
  } catch (const Failure &error) {
    return error.status;
  } catch (...) {
    return SCREENREC_STRETCH_FAILED;
  }
}
