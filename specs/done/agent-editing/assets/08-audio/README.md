# Native composition audio execution

Status: first native execution pass, not slice acceptance or public rendering readiness.
The [production-entry harness](../../../../../packages/test-harness/editing/audio-mix.mjs)
compiles actual compositions and sends their unchanged audio schedules/processing
instructions to `media.mixCompositionAudio`. It reads the resulting float WAVE samples.
It does not exercise CLI/MCP render jobs, which belong to the first-preview integration.

Run from the repository root after building composition and the native worker:

```sh
SCREENREC_NATIVE="$PWD/helpers/mac/.build/debug/screenrec-native" \
  node packages/test-harness/editing/audio-mix.mjs --case music-and-replacement
swift run --package-path helpers/mac ScreenRecorderAudioTests
```

[Report](report.json) records exact-sample gain/overlap/silence/split/window checks,
real native probing, replacement with an unchanged video schedule, explicit gap
reporting, clipping without limiting, exact long output counts and cancellation
before publication. Fixtures are deterministic PCM16 tones/impulses generated in a
scratch directory; no user audio is played or modified. The reference for mixing
is the source PCM, and the reference for resampled windows/cuts is the same native
full-source output. [Recording preservation](recording-preservation.txt) exercises
the existing audio implementation after sharing its source opening/conversion seam.
[Missing-operation red](missing-operation-red.txt) proves the harness detects the
absent production dispatch; [gain-disabled red](gain-disabled-red.txt) falsifies
the actual output-stage gain path. [Context-disabled red](context-disabled-red.txt)
fails on the excluded impulse when the production reader uses asset-wide support.

## Resampling context and selection isolation

[Interval-reset red](interval-reset-red.json) preserves the failed late-window
experiment: independently starting the 44.1 kHz converter changed samples by up to
0.0102111101. [Asset-context rejection](asset-context-rejected.json) preserves the
next failed alternative: immutable-source preroll restored parity but let an
excluded 0.75 impulse produce a 0.0885651633 peak inside the selection. That broader
context is not the production rule.

The compiler supplies current retained source domains. Adjacent pieces on one
track share a domain only when source identity, source/project timing and pitch
policy continue. True cuts and unavailable acquisition or anchor intervals bound
it. The native converter intersects that domain with occupied container segments,
keeps one phase relative to its start and reads only bounded preroll/tail inside
it. Thus a pure split keeps its filter input, while a real removal changes that
input. Gain stacks run afterward and do not redefine the raw source domain.

The receipt reports actual maximum preroll/tail work in output samples. Tests
compare full output with multiple late windows and a pure split, and independently
place poison impulses outside selections and inside acquisition/anchor gaps.
Those excluded impulses must produce exactly zero throughout selected PCM.
The first and final selected impulse checks detect hidden endpoint ramps, and a
rational-time true cut preserves the 48 kHz source samples without extra frames.

## Remaining gates

Fractional source/project microseconds now use the existing decoder's nearest
source start and ceil source end, paired with the compiler's absolute output-floor
origin. Each split/window uses that same full retained run origin. The production
harness compares half-sample threshold cases against `media.audio`, checks 44.1/48 kHz
split/window equality, and poisons fully excluded native samples. A quantization
shortage at the run end receives bounded synthetic zero extension only after the
decoder reaches its declared selection end; this is endpoint padding, not acquired
silence, and never reads the next excluded source frame. [Origin red](origin-red.txt)
records the earlier failure that led to this reconciliation.

Rate changes still require prepared retiming. Broader codec/rate/segment-origin
conformance, memory scaling acceptance, actual job cancellation cleanup, public
live media journeys, and real-narration listening remain unverified. The long run
includes fractional microsecond offsets, while a separate rational edit sequence
produces exactly 6,144,128 frames. Its measured peak resident set stays near the
short run; these measurements are not the full scale gate. The initial request
bounds limit scheduled clips and processing metadata explicitly; the scale slice
must validate or improve those bounds.
