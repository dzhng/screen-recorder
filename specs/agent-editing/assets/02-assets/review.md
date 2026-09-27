# Immutable asset admission evidence

Asset admission snapshots bytes before probing. SHA-256 identifies the snapshot;
immutable stream metadata preserves the native shared origin and occupied edit
segments. Project, revision and job owners retain explicit references in the same
catalog, so releasing a donor reference does not release another owner's media.

The core publication tests cover external-file removal, concurrent deduplication,
source changes during copying, frozen-input retry refusal, canceled probing,
transaction rollback and startup orphan cleanup. A deliberately randomized asset
identity made the concurrent-deduplication test fail; restoring content identity
made it pass. Catalog extraction preserves the prior transaction and lock-wait
behavior: all 67 focused library/job tests passed before queue generalization.

The native harness imports MOV (including rotated and variable-PTS fixtures),
PNG/JPEG, H.264/HEVC MP4, and WAV/AIFF/M4A/MP3. It removes or renames the external
source, reads the owned bytes, and actually decodes video or PCM through existing
native workers. Probe metadata alone is not the decode proof. The image probe
uses ImageIO decoding. Original bytes are never normalized or re-encoded. An actual FFV1 AVI stream is
reported as undecodable with its codec metadata and is not published.

## Locator constraint

AVFoundation returned `NATIVE_DECODE_FAILED: Cannot Open` for extensionless owned
MOV/WAV/MP4 files. Admission therefore retains a bounded, safe source extension
in staging and the immutable managed filename. The hash remains identity and
native probing remains the codec authority. Extensionless or mislabeled inputs
may still fail with the native decoder error; that is not evidence of an
unsupported codec. No FFmpeg dependency was added to production.

## Visual boundary

Both orientation PNGs come from native `media.frame`, one using the renamed
external original and one using the managed snapshot. Their identical bytes prove
admission parity, not an independent renderer oracle. The harness additionally
checks the asymmetric corpus's expected rotated landmarks: red at bottom-left,
green at top-right in a 96×160 frame. See `visual-review/` for independent critique,
metrics and disposition. The final image hashes match that review's metrics.

Native RGB at the lower-left landmark is `[246,36,0]`, while the corpus's FFmpeg
color oracle is `[255,0,0]` within four levels. The native upper-right marker is
`[64,250,88]`. This slice checks landmark identity and position; it does not claim
cross-decoder color parity or weaken the existing corpus color test. Renderer
reproduction owns that explicit color question.

## Reproduction

Build core, protocol, service and CLI before running the harnesses. Point
`SCREENREC_NATIVE` at a native worker containing `media.probe`. During these runs
it was `/Users/david/dev/screen-recorder/helpers/mac/.build/debug/screenrec-native`.

- `bun run --cwd packages/core test src/assets.test.ts`
- `node --test packages/test-harness/editing/assets-native.test.mjs`
- `bun run --cwd apps/service test src/project-service.test.ts`
- `node packages/test-harness/editing/assets.mjs --fixture imports`

The last two commands require the shared job-target prerequisite and are not yet
claimed passed here. Final service evidence will replace this limitation once
public import, cancellation, process-death recovery and CLI/MCP checks run.
