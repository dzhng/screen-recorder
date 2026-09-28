# Platform-rate temporal reproduction

The [report](report.json) freezes nine native cases with the same requests and
oracles as the original rendering reproduction, changing only the bounded
writer's bitrate policy to the existing production renderer's platform default.
All bounded temporal, duration, declared-color and PCM gates pass. Exact requests,
input/code/output hashes, tool versions and resource observations are retained.
The report's invocation reproduces the experiment in an empty directory.

The first run exposed an invalid exact-byte assumption in the empty-edit oracle:
lossy gap frames decoded to RGB values 0–2, so the classifier excluded black and
selected a footage label. The corrected oracle uses the same four-level channel
tolerance already used by this corpus's declared-color check. Every pixel must
satisfy it; a colored frame without white glyphs still fails. The dedicated
[red regression](oracle-red.txt) precedes the correction, then all four focused
membership/frozen-evidence tests pass. Missing frames, timestamps, durations and
unavailable-acquisition refusal are still independent gates.

Independent Codex review decoded the original failures, verified all final
source hashes and the final report, and found no actionable issue. It confirmed
the unchanged default reproduction settings and the distinction between a codec
oracle correction and a production encoding policy. This does not weaken the
whole-image color diagnostic or accept general photographic/text quality.

This is **research evidence**, not a public editing journey or native executor
adoption. Broader recorded-content quality, Rec.709 integration, orientation,
long-project resources and production-entry preservation remain separate gates.
The original frozen renderer evidence and installed production settings are
unchanged. No playback, capture or user-library access was performed.
