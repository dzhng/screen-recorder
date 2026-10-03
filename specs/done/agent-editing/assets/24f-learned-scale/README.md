# Successful two-hour learned preparation

A public 10,000-occurrence project successfully prepared 345,600,000 stereo Float32
frames at 48 kHz. Every channel sample matched the separately executed frozen C
reference, using the accepted scaling, frame size, two flush frames and 960-frame
compensation. The complete delivered WAV is retained. This is a shallow, repeated
synthetic-source scale proof, not listening quality or complete slice24 acceptance.

| Observation | Result |
| --- | ---: |
| Public project setup | 2.720 s |
| Successful preparation | 501.443 s |
| Independent reference runs and complete comparison | 58.751 s |
| Native peak resident bytes | 347,996,160 |
| Sampled service / harness peaks | 758,743,040 / 814,186,496 bytes |
| Sampled render workspace peak | 8,312,573,179 bytes |
| Delivered WAV | 2,764,804,096 bytes |
| Late one-second cold / warm delivery | 459 / 98 ms |

These wall times include concurrent development work: an overlapping 74.67-second
acquisition run and smaller regression checks. They are observations, not isolated
benchmarks or newly chosen budgets. Sampled peaks are not hard resource ceilings.
The native receipt's peak includes complete execution; the bounded 8,192-frame
processing block is not a claim about whole-process RSS. General query memory,
internal recipe/index growth, deep routing and overlapping high-track scale remain
unverified by this fixture.

The final second matches the corresponding full-output bytes after restart with
`media.audioCapabilities` and `media.mixCompositionAudio` unavailable. Source decoding
still executes: 48,002 frames decoded for 48,000 delivered. This is retained delivery
without those preparation operations, not operation without all native processing.
The harness verifies empty `library/render` after preparation and late delivery.
Successful home removal is separately observed; failure/cancellation cleanup is not
retested here. Repeat identity means equal preparation receipts, not a second DSP run.
All 10,000 source unavailable-range entries are empty, independently inspected after
completion. Other missing-support, partial-frame and routing cases stay with their
existing focused gates.

## Complete evidence without duplicate PCM storage

`manifest.json` pins the original invocation, production/worker/reference identities,
all stored volumes and metadata. Concatenating the numbered WAV volumes yields one
XZ stream containing the exact delivered WAV. Metadata includes source and late WAVs,
original passing report, pre-reconstruction hashes, C reference/source fixture,
reference executable, reconstruction diagnostics and independent reviews. Notices
and model provenance accompany the retained local reference; external distribution
readiness remains the existing unresolved model-provenance gate.

The four original multi-gigabyte oracle/input files are losslessly reconstructible:
input files repeat their exact retained period; raw reference output prepends its
retained unmatched 960-frame prefix to the appropriate byte-preserving WAV channel.
Original independent files were hashed **before** reconstruction. All four were then
materialized from the completed archive and independently rehashed equal to those
original hashes. Full archive decompression also matched the original WAV hash.
This is evidence compression after the independent DSP comparison. Comparing a
restored oracle to its reconstruction source would add no independent DSP evidence.

Verify retained integrity without writing multi-gigabyte outputs:

```sh
python3 specs/agent-editing/assets/24f-learned-scale/restore.py
```

Use `--wav /tmp/new.wav` to restore the delivered WAV, or `--oracles /tmp/new-directory`
to restore the four original reference files. Paths must be new; accept output only
after successful completion. Failed extraction can leave partial files. Optimized
Python mode is refused because verification assertions must remain enabled.
The compressed WAV is 303,508,376 bytes; volume splitting only bounds individual Git
blobs. No samples are curated or omitted. The independent reviews found no numerical
or retention defect and their scope limitations are reflected above.

The existing `packages/test-harness/editing/denoise-scale.mjs` owns fresh reproduction;
use the manifest's exact command after composition/core/protocol/service/CLI builds
and the pinned native worker. Earlier structural-bound, edit-timeout, duplicate-edit
receipt and oversized-job failures remain in their prerequisite evidence. No failed
measurement was replaced by this later pass, and no deadline or codec was changed.

[Root archive verification](root-verification.json) streams the entire retained WAV after integration and confirms its original digest. This is evidence-integrity verification, not a repeated DSP experiment.
