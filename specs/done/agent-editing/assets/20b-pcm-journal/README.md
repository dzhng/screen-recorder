# Typed accepted-PCM journal checkpoint

Schema2 describes packed working bytes through exact accepted frame addresses.
It does not describe committed canonical media. One bounded record decoder and
loop own both layouts; the explicit PCM consumer streams validated mappings with
at most two role states. Existing inspection/source export refuses schema2 until
canonical publication and represented-prefix admission are connected.

Raw timestamps and exact integer addresses use canonical decimal strings through
native and JavaScript JSON. Flags and epoch are preserved as provenance; retaining
an epoch does not mean CaptureClock accepts it. Phase belongs to the first accepted
buffer, whose declared frame address is zero. Physical addresses must form a
contiguous accepted prefix; declared addresses may skip, but cannot overlap.
Neither a header nor a phase establishes acquired audio. Unknown schema2 events
are corruption rather than schema1's permissive unknown-event handling.

The default native capture suite now checks exact roundtrips, two independent
roles, phase/format prerequisites, missing/corrupt/torn mappings, invalid first
address, overlap, and old inspection refusal. A negative control removed only
that refusal: the test failed at the header2 isolation assertion. Restored code
passes the unchanged default capture suite alongside the new tests.

Reproduce from repository root, choosing a fresh output directory:

```sh
swift build --package-path helpers/mac --product ScreenRecorderCaptureTests
SCREENREC_PCM_JOURNAL_OUTPUT=/tmp/pcm-journal-check helpers/mac/.build/debug/ScreenRecorderCaptureTests
node specs/agent-editing/assets/20b-pcm-journal/roundtrip.mjs /tmp/pcm-journal-check
```

This checkpoint does not wire real accepted appends into schema2, enable a writer
layout, establish committed media support, or prove crash/power-loss publication.
Those remain20b/20c/20d gates. Ordinary CaptureWriter still emits schema1. Physical
capture20/21 and the common reader's non-grid resampling/window gate remain separate.

Independent read-only Codex review found no actionable defect. Shape review keeps
serialization and bounded mapping state with CaptureJournal, with no second clock,
parser or acquisition owner.
