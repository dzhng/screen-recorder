# Native recovery checkpoint

The generated own-window capture probe was killed before and after movie fragments,
and during pause. Raw reports beside this file preserve kill delays, decoder output
and media paths; source media remains in those temporary directories. These are
process-kill observations, not power-loss proof.

The integrated Swift capture checks and all five Node native-wire/recovery checks
passed on 2026-09-15. Worker fixtures prove independent audio survival, short optional
audio, unchanged video bytes, acquisition gaps and truncated journal tails. The
native capture tests also exercise encoder backpressure and held-tail decoding.

The early 250 ms kill has no decodable video. Later own-window fixtures retain
roughly one second and eleven seconds respectively. The pause case retains its
prefix and an open pause marker. Exact intervals are in the recovered reports.
FFmpeg reports timestamp quantization warnings on some fragmented fixtures; no
clean FFmpeg full-decode claim is made for those cases.

The [review disposition](review-findings.md) tracks accepted timing/journal fixes.
The [PCM report](pcm-report.md) records eight generated audio kill/finalize cases;
root reran all eight against the integrated worker and confirmed unchanged source
hashes (`pcm-integrated.json`). The worst sampled loss was 4.885333 seconds; this
is not a strict universal five-second bound.

Outstanding: accepted review fixes, reusable kill harness, physical audio capture/audition, kill during finalization, app/service relaunch and
catalog reconciliation. This report does not close slice 02.

The [performance audit](performance.md) records a measured gap-accumulation copying
problem and an isolated candidate fix; production integration remains pending.
