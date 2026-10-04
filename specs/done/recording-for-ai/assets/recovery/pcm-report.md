## Answer: yes — native float PCM fragmentation really does preserve a prefix, above a 1-second cliff

All evidence in `/tmp/screenrec-pcm-evidence`. Worktree `71ca941` is untouched (`git status` clean, no commits).

### Commands

```bash
cd /private/tmp/screenrec-claude-pcm/helpers/mac && swift build -c release --product screenrec-native
cd /tmp/screenrec-pcm-evidence/probe && swift build -c release
cd /tmp/screenrec-pcm-evidence && python3 driver.py && python3 report.py
cd /tmp/screenrec-pcm-evidence && python3 atoms.py runs/*/narration.mov
```

### Artifacts

| Path | What |
|---|---|
| `probe/Sources/PCMProbe/main.swift` | Scratch writer: CaptureWriter's exact PCM settings (`kAudioFormatLinearPCM`, 32-bit float, interleaved, LE), `initialMovieFragmentInterval` 1s / `movieFragmentInterval` 5s, `expectsMediaDataInRealTime`, non-interleaved float32 `sourceFormatHint`, same retime-copy-then-append order, same journal event order. Depends on the repo package read-only so the journal is the **real** `CaptureJournal`. |
| `probe/Sources/PCMAnalyze/main.swift` | Independent decoder — does not use `MediaRecovery` |
| `driver.py` / `recover.py` / `report.py` / `atoms.py` | SIGKILL driver, real `screenrec-native media.recover` client, cross-check, atom walk |
| `runs/<scenario>/` | `narration.mov`, `capture.journal.jsonl`, `media.recover.json`, `decode.json` |
| `results/report.json`, `results/atoms.txt`, `results/*.recovered.wav` | Cross-checked results, structure dump, auditable audio |

### Observed results (48 kHz stereo, 1024-frame chunks, real-time paced)

| Run | kill @s | journal accepted (µs) | `media.recover` end (µs) | **loss (µs)** | decoded frames | top-level atoms |
|---|---|---|---|---|---|---|
| before-first-fragment | 0.606 | 597 333 | 0 | **597 333** | 0 | ftyp,wide,mdat |
| just-before-first-fragment | 0.955 | 938 666 | 0 | **938 666** | 0 | ftyp,wide,mdat |
| just-after-first-fragment | 1.154 | 1 152 000 | 1 002 667 | **149 333** | 48 128 | …,moov,wide,mdat |
| after-first-fragment | 3.006 | 2 986 666 | 1 002 667 | **1 983 999** | 48 128 | …,moov,wide,mdat |
| just-before-second-fragment | 5.905 | 5 888 000 | 1 002 667 | **4 885 333** | 48 128 | …,moov,wide,mdat |
| just-after-second-fragment | 6.307 | 6 272 000 | 6 016 000 | **256 000** | 288 768 | …,moov,…,moof,wide,mdat |
| after-multiple-fragments | 13.005 | 12 992 000 | 11 008 000 | **1 984 000** | 528 384 | …,moov,…,moof,…,moof,wide,mdat |
| **normal finalization** | — | 8 000 000 | 8 000 000 | **0** | 384 000 | ftyp,wide,mdat,moov |

### Mechanism (from `results/atoms.txt`)

AVAssetWriter MOV fragmentation is not moof-only: it streams `mdat` continuously, writes a full `moov` at the **1s initial** interval, then one `moof` per **5s subsequent** interval. Decodable end == end of the last completed checkpoint. Checkpoints landed at 1.002667 s, 6.016 s, 11.008 s.

**Observed loss follows time since the last completed checkpoint, with audio-buffer quantization around the configured 5s interval.** The two ~1.984 s figures are not a PCM property — they are an artifact of my kill times landing ~2 s past a boundary. The boundary-straddling runs pin the real shape: 0.149 s just after a checkpoint, 4.885 s just before one. The sampled worst case is 4.885333 s; this does not establish a strict 5.000000 s upper bound. Checkpoint spacing can exceed five seconds by an audio-buffer quantum.

### Failure classification

- **Pre-first-checkpoint kill: total prefix loss, but honest.** The file is `ftyp+wide+mdat` with no `moov`; `media.recover` returns `DECODE_FAILED "Cannot Open"`, zero intervals, zero samples. The PCM bytes *are* on disk (mdat length matched accepted frames exactly — 32 776 B for 85 333 µs) but nothing indexes them. This is slice 02's "a zero-prefix early kill is honest" case, not a corruption case.
- **Post-checkpoint kills: clean truncation.** Every recovered file decoded to `readerCompleted`, one contiguous interval from 0, no failure, no empty track segments, trailing unreferenced `mdat` silently ignored.
- **No case advertised a corrupt tail as ready.**

### Verification quality

- `decodedFrames / 48000` agrees with recovered duration to microsecond rounding in all 8 runs; `media.recover`'s interval == the independent decoder's, byte-for-byte on timing.
- Recovered media is provably the *real* prefix, not plausible garbage: the source is a 200 Hz → +390 Hz/s linear chirp. Head frequency is 231 Hz in every run; tail frequency tracks the expected value for its position (574/558, 2531/2513, 4477/4460, 3299/3287 Hz measured/expected — within the zero-crossing estimator's bias). Peak 0.5, RMS 0.35355 (= 0.5/√2) throughout.
- Journal cross-check: `acquisitionVerified` true, `incompleteTail` false, and recovered ⊆ acquired in **every** run. The journal never inflated the advertised interval; the `MediaRecovery` acquisition intersection was a no-op in the safe direction.
- Normal finalization is exact: loss 0, 384 000 frames for 8.000 s, round-trip identical to the journal.

### Caveats

- Process-kill evidence only. SIGKILL preserves the page cache, so this measures **fragmentation granularity, not durability** — it is not sudden-power-loss proof, as slice 02 states.
- Audio-only probe, so `video.mov` and `system.mov` report `MISSING_MEDIA` and `RecoveredCapture.durationUs` is 0 (it derives from video). That is the probe's scope, not a defect.
- Nothing here speaks to physical device capture or A/V synchronization.

### Smallest evidence-based next experiment

Fragmentation did not fail, so no fallback is warranted. The one unmeasured variable that actually governs the product's loss target is the interval itself: re-run this same probe with `movieFragmentInterval` swept across {5s, 2s, 1s, 0.5s} and measure (a) the resulting worst-case loss window and (b) the per-checkpoint byte and CPU cost, plus whether the pre-first-checkpoint cliff shrinks proportionally with `initialMovieFragmentInterval`. That is a parameter change to the existing probe — no new mechanism, no untested recovery claim.
