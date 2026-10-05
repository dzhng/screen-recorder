# Isolated tool evidence

Observed 2026-10-04 on arm64 macOS. These probes establish local component
execution, not a released bundle, integrated operation or perceptual verdict.
No user recording was edited and no demo project was created.

## Existing contracts

- `bun run --cwd packages/composition test src/output-settings.test.ts`: 7 passed.
- `bun run --cwd packages/core test src/audio-wave.test.ts src/audio-spectrum.test.ts src/text-seeds.test.ts`: 21 passed.
- Composition build passed before these checks. Bun 1.4.2, Node 24.21.0.

These cover output validation, waveform/spectrum behavior and caption evidence
projection. They do not establish native media execution or future features.
No full suite was run for documentation changes.

## Reference binary and inputs

Homebrew FFmpeg/ffprobe 9.0.2, Apple clang 21.0.0; configuration includes GPL,
version3, x264/x265, shared libraries, VideoToolbox and AudioToolbox. This is
**not** the selected distribution build and must not be copied into the bundle.
Its inventory included ebur128, loudnorm, alimiter, sidechaincompress, tonemap,
lut3d, colorbalance and colorspace; zscale was absent. The pinned LGPL reproduction
must establish its own capabilities and license/dependency closure.

| Retained fixture | SHA-256 |
| --- | --- |
| narrated-workbench/video.mov | ade26eacf8dce118e4fe16dcf261e7d3445d115e2b92721f0a01b8a4511de17a |
| narrated-workbench/narration.mov | 2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c |

ffprobe reported H.264 video 3120×1970, duration 134.025574 s; mono float32
48 kHz narration, start 0.048667 s, duration 133.973333 s. Metadata is not proof
of project physical-support mapping. The camera fixture was an LFS pointer;
no large media was fetched.

## Bounded executions

All exited 0. [Raw logs](evidence/) preserve mappings and results. Audio trimming
precedes filters so measurement/state sees only the selected operand. Earlier
output-only time limits allowed extra filter context; those readings are superseded.

| Probe | Observation | Claim limit |
| --- | --- | --- |
| 5 s narration, ebur128 peak=true | −33.1 LUFS, LRA 9.2 LU, peak −12.5 dBFS | Executes true-peak measurement; short excerpt is not program evidence |
| 5 s narration, loudnorm I=−16 TP=−1.5 LRA=11, output 48 kHz | Dynamic mode; output I −16.00, TP −1.50 | Filter statistics, not independent delivery calibration |
| 2 s narration, alimiter limit=0.8 level=false latency=true | 2 s null-sink output at 48 kHz | Execution, not latency/state/ceiling preservation |
| Two 2 s sine sources, sidechaincompress | Bounded output | Filter/routing execution, no listening or dynamics oracle |
| One fixture frame, scale and colorbalance | One 624×394 RGB frame through null sink | Grade candidate executes; no appearance verdict |
| 1 s synthetic picture, h264_videotoolbox | ffprobe H.264, 320×180, 1.000000 s | Actual Apple encoder on this host, not released readiness |
| Same operand, hevc_videotoolbox | ffprobe HEVC, 320×180, 1.000000 s | Actual encoder execution, not managed HEVC delivery |

Audio command base:

```sh
ffmpeg -hide_banner -nostdin -i fixtures/narrated-workbench/narration.mov \
  -af '<filter>' -ar 48000 -f null -
```

Filters used:

- `atrim=duration=5,ebur128=peak=true`
- `atrim=duration=5,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json`
- `atrim=duration=2,alimiter=limit=0.8:level=false:latency=true`

Ducking used two lavfi sine operands, frequencies 220/440 Hz, duration 2 s;
`[0:a][1:a]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=200[out]`
and explicit `[out]` mapping to a null sink. Picture sampling used video.mov,
`-frames:v 1 -vf 'scale=624:-2,colorbalance=rs=0.02:bs=-0.02' -an -f null -`.
Encoding used lavfi `testsrc2=size=320x180:rate=30:duration=1`,
`-an -c:v <codec>_videotoolbox -pix_fmt yuv420p -n <new-output>.mp4`, then
ffprobe stream codec, width, height and duration. Outputs stayed in temporary
state. Source files were read only.

## Unfinished evidence

No native app/service media journey, relocated LGPL build, HDR transform, alpha
path, richer speech quality, visual/listening verdict or installed direct fallback
was verified. Each has a focused gate in the plan.

The native desktop inventory did not list Screen Recorder; selecting the name
returned “Invalid app: Screen Recorder.” This session could not reach the user's
reported running 0.1.0 app or new recording. Viewing its pitch remains unfulfilled;
absence from this connection is not absence from their computer.
