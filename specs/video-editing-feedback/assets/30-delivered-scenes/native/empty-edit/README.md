# Physical empty-edit delivery

This receipt closes the physical empty-edit-list evidence gap for slice 30. The
runner [`empty-edit-delivery.mjs`](../../../../../../packages/test-harness/editing/empty-edit-delivery.mjs)
uses the frozen AVFoundation source fixture from
`specs/done/agent-editing/assets/10d-source-frames/visual/source.mov`, imports
the exact bytes through the public CLI and MCP service, reads source coverage,
places the video in a project, delivers neighbor/gap frames, and commits a
video export. It never mutates the source or a personal library.

Run it in a clean evidence directory with a built CLI/service and pinned native
worker:

```text
YAP_NATIVE=/absolute/path/to/yap-native \
  node packages/test-harness/editing/empty-edit-delivery.mjs \
  --out specs/video-editing-feedback/assets/30-delivered-scenes/native/empty-edit
```

The retained source SHA-256 is `42f5673bebaa1faedf0f22da32445f4f9626222190b47d1db54a0714d4b490fc`
(3,880 bytes). Native source coverage reports `[400000,600000)` microseconds
as `unavailable` with `basis: support`; a direct source frame request at
450,000 microseconds returns `state: unavailable, reason: physical_gap`.

The project delivery receipt preserves the same unavailable layer at the gap
frame. The delivered neighbors at 300,000 and 700,000 microseconds decode to
non-black pixels, while the 400,000–500,000 microsecond frame is opaque black.
The committed export contains ten video frames and has SHA-256
`b9edddd133369739d17c2ef2c8ab0c6dcd8fce6881d77cc6180f24ced501e1cc`.

This is physical support evidence, separate from a declared acquisition hole or
an authored black card. A black delivered frame alone is not treated as proof;
the source coverage and refused direct source read establish the empty edit.
The full receipt is [`report.json`](report.json); the exact request is
[`request.json`](request.json); retained neighbor/gap stills and the export are
next to this file.
