# Public preview journey

The [harness](../../../../packages/test-harness/editing/first-preview.mjs) uses
actual CLI child processes and MCP stdio, an isolated real project service, and
the production native composition movie operation. No renderer or worker is
mocked. Build the native worker and service/CLI/core/composition/protocol packages
first, then run:

```sh
node packages/test-harness/editing/first-preview.mjs --transport both
node --test packages/test-harness/editing/first-preview.test.mjs
```

The [report](report.json) records delivered-media assertions and public calls.
All source counter frames are checked against independent corpus membership;
source hashes stay unchanged. Independent replacements preserve the protected
media, music preserves narration level, and a clip/track/two-group/output gain
chain produces the declared product. A newly inserted clip has an empty own
stack and is processed by its existing parent route. Both decoded stereo channels
are checked; replacement also proves the old source's tone is absent.

Range previews preserve exact project phase, retained impulses and the leading
partial picture. Independent AAC encodes use explicit RMS/gain tolerances;
picture membership and timestamps do not receive codec-timing slack. Actual
running-job cancellation and service SIGKILL produce no public artifact, then
explicit retry delivers the expected processed audio and pictures. CLI file
bytes equal MCP chunk delivery, closed tokens fail, and deletion revokes an open
project token. The fixture also exits cleanly on parent IPC disconnection,
recorded separately in [ipc-disconnect.json](ipc-disconnect.json).

This is preview acceptance, not completion of slice 09. Project exports and
publication recovery remain pending. Synthetic tone/impulse checks establish
membership and gain, not human narration or listening quality.

## Visual disposition

The judged variable is AV membership and preserved framing, not image style.
The full contact sheets and counter zooms are retained beside their MP4s. Final
raw captures are [byte-identical](visual-identity.json) to the reviewed images.

Earlier fresh reviewers reported a black video-replaced sheet or closing row
([first](visual-initial-cli.txt), [second](visual-single-cli.txt), and
[original-detail subagent](visual-original-detail.md)). Their actual image calls
were checked; CLI [tool events](visual-tool-events.json) are retained. These
observations contradict direct parent/implementer inspection and PNG identity:
that sheet has the same bytes as other sheets the reviewers read correctly.
The media oracle independently decoded all 30 pictures. No missing media is
supported by those reports; their presentation/observer cause remains unknown.

A final fresh subagent inspected the complete set with unique filename margins
([verdict](visual-labeled.md)). The margins change no original image pixels,
verified by [presentation-check.json](presentation-check.json). It read the full
B–B–A sequence and found no missing occupied frames, cropped labels or lost
markers. Mild enlarged-pixel edges and codec halos remain visible, with readable
counters. The earlier findings are preserved; this is not a claim of unanimous
review agreement. The raw report's visual-pending entry predates this external
review and is resolved by this disposition. Export remains pending.

Independent code review exposed false-pass cases for hidden original audio, a
broken right channel, missing range impulses, wrong retry audio, abnormal CLI
exits and subprocess cleanup. These were fixed; oracle tests include mixed-source,
channel and actual-child failure counterexamples. The final exact-executable live run passes the strengthened checks, including
the final service exit-status guard (code 0, no signal). Focused oracle/transport
tests remain green.
