# Long-project audio/video timing

The [public journey](../../../../../packages/test-harness/editing/audio-video-drift.mjs)
exports a thirty-minute project through actual CLI/MCP and the isolated service.
Repeated source segments have fractional-microsecond edit lengths; their cumulative
fraction exceeds one output picture. Each segment carries an audio impulse at the
center of a video flash. Decoder timestamps and measured impulse locations test
alignment at every edit, rather than inferring synchronization from total duration.

[Initial report](initial-report.json) retains all measured markers and the delivered
export receipt. All 120 markers stay within the predeclared one-output-frame gate
at 30000/1001fps; maximum observed displacement is 33.304ms against 33.367ms allowed.
This is timing evidence, not picture quality, natural speech or broad scale acceptance.
The original source remains unchanged. Independent review found no actionable
harness defect; its runtime attempt failed in sandbox service startup/cleanup,
so root execution supplies the live evidence.

A [negative control](negative-control.json) shifts only the delivered movie's video
track by 100 ms. Independent decoding confirms unchanged picture pixels and audio
bytes; every marker fails the same timing bound. The control distinguishes timestamp
checking from a test that merely recognizes the original media. Reproduce with the
journey output directory:

```sh
ffmpeg -v error -nostdin -itsoffset 0.1 -i OUTPUT/long.mp4 -i OUTPUT/long.mp4 -map 0:v:0 -map 1:a:0 -c copy OUTPUT/shifted.mp4
python3 specs/agent-editing/assets/08-av-drift/verify-shift.py OUTPUT
```

Run the public journey after targeted CLI/service builds, with a frozen worker and
a fresh output directory:

```sh
SCREENREC_NATIVE=/path/to/screenrec-native node packages/test-harness/editing/audio-video-drift.mjs /tmp/av-drift-fresh
```

The initial fixture used libx264's lossless High 4:4:4 Predictive profile and was
[refused by native decoding](unsupported-fixture.json). The timing fixture uses
standard H.264 instead; that refusal is retained as an open codec observation,
not treated as broad format support. The first harness omitted unavailable from
its terminal-state check; its isolated processes were stopped and scratch home
removed. The corrected harness fails immediately on unavailable output.

[Confirmation](confirmation-report.json) reruns the final harness with explicit
container-duration and decoder-padding checks. The audio track declares exactly
86,402,136 samples; decoded AAC includes 872 additional tail samples, below one
1024-sample packet. Both tracks start at zero and the video declares exactly the
authored 1,800,044,520 microseconds. All 120 timing measurements reproduce the initial
run exactly. Final independent review found no actionable defects and did not rerun
the native journey. Shape/diff/docs review keeps this as one public journey plus a
reproducible timestamp-only negative control; no product API or encoding defaults
changed. Choice audit adds no product policy: fixture scale and markers are delegated
verification choices. Broader codecs, quality and scale remain separate gates.
