# Review and confirmation

Independent read-only Codex review found no actionable defect or inference
overclaim. It verified retained movie hashes, sizes, frame metadata, request
equivalence, trace equality and arithmetic, independently reproduced ffmpeg
results, and recomputed Apple measurements from the existing scratch pixels.
It checked candidate worker hashes and source isolation against the frozen parent
without builds. These checks cover the three sampled frames, not general quality.
The sampled PNGs and compressed raw RGBA have subsequently been retained here;
pre-append bytes are exactly the parent's retained BGRA and are not duplicated.

The consolidated runner's high-rate confirmation reproduces all measurements and
file sizes. Encoded payload and container hashes differ between runs, while all
23 ffmpeg-decoded frames are byte-identical; no cause for the encoded difference
is asserted. Both confirmation movies and decoded-comparison hashes are retained.

The existing native composition-movie harness passes full/range audio-video,
one-microsecond video-only duration and cancellation cleanup checks against the
frozen high-rate worker. These are native production-entry regressions, not a new
CLI/MCP live journey. Its first invocation lacked the sibling cancellation test
executable and failed after earlier checks; a complete rerun with both frozen
executables passes. Neither failure was counted as acceptance.

Shape, diff and documentation review keep one parameterized runner and the frozen
parent inputs. Choice audit adds no production API, profile, dependency or storage
owner: the factor choices are explicitly diagnostic, with no default promotion.
