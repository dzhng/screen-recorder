# Prerecorded selected-probe stop at camera scale

The existing selected-probe stop operation takes **26.915 seconds** from stop intent
to its durable result for the retained camera movie replayed at native timestamps.
This is a direct measurement of `SelectedCaptureProbe.record` through
`NativeCapture.stop`, real screen encoder closure and real camera publication.
It establishes that legitimate offline finalization can exceed the app's current
ten-second quit fallback. It does not choose a replacement timeout or change that
intentional interrupted-recovery fallback.

The [verification](verification.json) pins the tested executable, immutable source,
measurement and [archive](evidence.tar.gz); the [manifest](manifest.json) hashes every
archive member. The corrected run delivers all **4,428** physically available source
pictures at 1920×1080. Camera publication verifies their exact acquired timestamps
and complete decoded BGRA from its newly encoded raw movie to canonical output.
The resulting picture digest is retained in the measurement. The original fixture
hash is unchanged. Sampled peak RSS was 154,746,880 bytes; the launcher enforces a
420-second whole-process deadline and a 4-GiB sampled memory guard. These are
experiment guards, not product latency or memory limits.

## Evidence boundaries

Prerecorded frames are delivered during the injected input's startup; the probe
requests stop once NativeCapture reaches recording. Thus the measurement covers
accumulated-media closure/publication and stop polling, with an immediate simulated
input drain. It does not prove stop during live callback delivery, physical device
drain, microphone publication, AppKit termination, or recovery after actual forced
quit. Source pixels are re-encoded by the real capture writers; exact identity is
claimed for newly encoded camera raw-to-canonical publication, not lossy
fixture-to-encoder equality. The camera retains the fixture's deliberate 200-ms
placement offset and shared host origin.

The first full run retained 4,429 samples and took 26.896 seconds. Independent
inventory comparison found its screen timestamps were exactly one sample at zero
followed by the 4,428 original acquired timestamps. AVAssetReader had emitted a
sample for the leading empty edit. The prerecorded fixture now uses the existing
occupied-media `SourceSegment`/`assetEnd` policy, also used by the publisher, before
counting or delivering pictures. The corrected count agrees with independent
FFmpeg decoding and the earlier mapped recovery receipt. The first run and this
diagnosis remain in the archive; two early stopped setup runs retain execution
summaries and unchanged source identities.

## Verification and review

The default offline suite, existing graceful-stop checks, and compact opt-in
measurement pass. A compact mutation removing NativeCapture's companion finalization
fails on the missing durable camera result; restoring the original source passes.
A separate initial test expectation incorrectly rejected the fixture's intentional
pre-origin omission. The corrected check requires precisely that omission, all
intended acquired pictures, and the post-seal rejection. Both setup failures are
retained rather than reclassified as product bugs.

The final measured binary and production sources are unchanged after measurement.
Shape, diff, docs and independent read-only review found no remaining actionable
issue in this evidence pass. The configured Codex CLI review model was rejected
before its review started; no model configuration changed. Root and fresh
collaboration reviews supplied independent coverage. No physical capture,
permissions, installation, signing, playback or downloads occurred. All experiment
children were reaped. Large generated movies remain at the paths and hashes in the
archive's external-media inventory; compact media, logs, sources and the bounded
reproduction launcher are retained in the archive.

[Root integration](root-verification.json) verifies every archive member, all
retained source snapshots against the merged tree, original and generated media
identities, and the final executable. Default offline and graceful-stop checks
pass again; the unchanged long measurement is reused rather than rerendered.
