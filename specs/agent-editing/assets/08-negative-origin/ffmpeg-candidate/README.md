# FFmpeg negative-timestamp candidate

Result: **non-exercise**. One distinct lossless construction used the existing
48kHz mono16-bit PCM corpus, a requested−0.25s input timestamp offset, preserved
input timestamps, disabled negative-timestamp adjustment and disabled edit lists.
The installed MOV muxer also enabled signed CTS offsets. These requested settings
are not evidence that negative occupied presentation time reached the file.

Both FFprobe's stream/first-packet timestamp and the actual native probe report
zero. Native occupied support is[0,2000000)µs, with `originUs:0`. The negative-origin
prerequisite therefore failed. This construction path stops here: no public
composition or full/range/tail/split claim follows, and no further variant was run.
The verified8kHz/192kHz cohort was not repeated.

[Verification](verification.json) retains exact command, source/candidate/worker
hashes and scope. The lossless-encoded movie is gzip-compressed; the recorded hash
is for its decompressed bytes. Logs and both probes are retained alongside it.
No metadata/database overrides, production changes, models, downloads or playback
were used. This does not establish a general negative-origin admission policy.

FFmpeg's [format documentation](https://www.ffmpeg.org/ffmpeg-formats.html)
describes signed CTS offsets; that capability alone does not imply a negative
occupied AVFoundation target origin. The observed native result is authoritative
for this candidate.
