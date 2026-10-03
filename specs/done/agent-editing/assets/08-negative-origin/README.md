# Negative occupied-origin feasibility

The bounded two-candidate probe did **not** produce media with a negative occupied
AVFoundation target origin. Negative-origin public import/mixing remains
unverified. These results do not establish a general unsupported-format policy;
the product's signed origin and decoder paths are unchanged.

`verification.json` pins the worker, environment, commands and original file
hashes. The frozen Swift programs adapt the existing SourceAudio lossless fixture
writer and composition insertion path. They synthesize known 48 kHz mono float
samples; no recording, application launch, network media or model was used.
Media is retained gzip-compressed; hashes refer to decompressed bytes.

The first candidate requested a −0.25 s sample timestamp and writer session start.
Writing completed, but its occupied target segment began at zero. The production
worker's retained `media.probe` response independently reports `originUs: 0`, LPCM,
48 kHz mono. The authored CAF contains two seconds; the resulting movie's observed
occupied duration is 1.984 seconds. No duration or sample-preservation claim is
made for this candidate. The prerequisite origin check alone failed to exercise
the desired branch.

The one justified alternative used a composition insertion at −0.25 s, avoiding
the writer session mapping. It failed at insertion with AVFoundation error
−11800 and underlying OSStatus −12780. There are no in-memory segment or exported
media results for this candidate. The retained JSON distinguishes this fixture
construction refusal from a product admission refusal.

The SDK's `AVAssetWriter.h` documentation for `startSessionAtSourceTime:` explains
that a QuickTime session begins at movie time zero and shifts source timestamps
by the session start. Its `AVCompositionTrack.h` documentation for `segments`
requires the first target segment to begin at zero. These explain why these
particular fixture routes cannot supply the intended observation. Apple documents
[insertion into a composition track](https://developer.apple.com/documentation/avfoundation/avmutablecompositiontrack/inserttimerange%28_%3Aof%3Aat%3A%29)
and [writer session timing](https://developer.apple.com/documentation/avfoundation/avassetwriter/startsession%28atsourcetime%3A%29).
The installed SDK used was the MacOSX SDK under `/Applications/Xcode.app`.

Do not substitute negative codec priming timestamps, a negative source offset
compensating a positive origin, or the decoder's arithmetic unit check for a
negative occupied media origin. No public project/full/range/tail/split/overlap
run was performed because neither candidate met that prerequisite. No exact PCM,
listening, whole08 closure or blanket container impossibility claim follows.

Reproduction is intentionally a frozen experiment, not a new recurring harness.
Use an empty `/tmp/screenrec-negative-origin`, restore the two Swift programs
there, run candidate1 before candidate2, then send the saved probe request to the
hash-pinned worker. The first program writes its own source CAF. The candidate
programs should not be rerun in a directory containing earlier outputs: the
original fixture writer reuses an existing movie. No further candidate search
was performed after the authorized two attempts.

A later separately authorized [FFmpeg candidate](ffmpeg-candidate/README.md) used
negative input timestamps with timestamp adjustment/edit lists disabled. Both
FFprobe and native occupied support still begin at zero. It is retained as another
non-exercise, not a new admission rule; that construction path stopped there.
