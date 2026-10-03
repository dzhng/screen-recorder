# Camera digest cost audit

Status: bounded diagnostics completed; no further production optimization selected.
The ten-second stop requirement and physical capture gates remain unverified.
This supplements the [controlled pointer-hashing pass](../20e-camera-picture-hashing/README.md).

Selected-camera stop closes the encoder, then the existing publisher verifies
all raw and canonical decoded pictures before committing. The retained take
requires 73.455 GB of visible BGRA hashing. This is required picture work that
grows with duration/resolution, not a retry loop. The receipt recovery path already
reuses verified publication after checking input and output identities.

## What the new evidence resolves

The prior digest timer included locking and metadata, and the earlier benchmark
used debug builds while the installer builds release. A bounded probe times the
first 128 original raw camera pictures in debug/release/release/debug order. It
uses the same ordered timestamp/dimension/pixel bytes as the digest owner. Each
run reads 1.062 GB and produces the same complete prefix SHA256. Actual sampled
buffers are already contiguous, using one pixel update per picture.

[Component measurements](components.json) show mean pixel hashing of about
0.3397 seconds in both modes, with lock/unlock and metadata below a millisecond
per run. The prefix identifies the cost; it does not establish full-take latency.
The synthetic in-memory control produces identical SHA256 with CryptoKit and
CommonCrypto, but does not show a faster provider. Keep the accepted CryptoKit
owner; no dependency, buffer-copy policy, digest representation or deadline changes.

[Two complete release publications](release-publication.json), using current
capture/media source owners plus only retained timing instrumentation, preserve
all 4,428 pictures, support, diagnostics and the expected full picture digest.
They take 75.487 and 81.020 seconds. The disk was observed nearly full after the
runs, so these are context-specific failure measurements, **not** evidence that
release causes slower publication or a fair comparison with the earlier debug
cohort. They do not pass the ten-second target or prove live shutdown.

[Complete canonical comparisons](canonical-normalization.json) match the frozen
canonical movie outside exactly six creation/modification date fields. The
[exact reconstruction records](canonical-reconstruction.json) retain those date
bytes and the observed full-file hashes; virtual reconstruction from the unchanged
retained base reproduces both hashes exactly. The two temporary movie trees and
all this turn's probe/build directories were removed after verification. Their
source recipes, receipts, logs and runtime hashes remain retained. Originals,
installed app and frozen workers remain unchanged; no capture or playback ran.

## Disposition

- More row coalescing cannot improve the sampled contiguous case.
- Decoder copying/locking is not supported as the dominant remaining fix.
- Identity/export/journal tuning cannot explain the prior digest cost; identity
  rereads also protect changed-input recovery.
- Independent parallel frame hashes would change the ordered digest. Whole-raw
  buffering to overlap later verification would approach 36.7 GB.
- Fewer pictures, changed clocks/digest, skipped checks or a larger deadline
  would weaken preservation and are excluded.

The [evidence archive](evidence.tar.xz) retains the root review of the independent
audit, full source/build recipes and measurements. [Root verification](root-verification.json)
rechecks source ownership and exact reconstruction. The [inventory](manifest.json) pins
its members. No installed or actual capture-to-stop result is inferred from this
isolated calibration. Further work needs a supported strategy that preserves full
picture verification; the remaining speech pickup still needs actual human marks.
