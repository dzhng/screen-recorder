# Exact container capacity before prospective PCM acceptance

`PCMContainerTime` is the shared Capture owner for the fixed phase/native-rate container timescale and exact frame coordinates. CaptureClock checks the proposed first and end coordinates before changing accepted phase state; materialization and canonical verification use the same arithmetic. The nearest-native-address and fixed-phase policies are unchanged.

A 47999Hz candidate with 100001µs phase was previously accepted even though the canonical materializer could not represent it. It now returns `INVALID_AUDIO_TIMING` before acceptance. A subsequent valid 100000µs phase establishes frame zero, proving the refused plan left no state behind. A later endpoint outside container capacity similarly leaves an established phase unchanged. The existing materializer refusal test confirms working payload preservation.

The common 44.1/48/192kHz admission checks pass. Frozen old/new admission and non-grid full/late window controls at 44.1/48kHz produce byte-identical PCM and identical semantic receipts; only output paths and process RSS are normalized. The old code failed the new before-acceptance refusal assertion, the corrected code passes the default capture suite, and independent read-only review found no issue. Exact comparison files, requests, outputs, source controls and logs are retained in the archive.

This removes prospective acceptance of a candidate the current canonical representation cannot publish. It does not reverse the raw-host timing policy, introduce a fitted offset, or prove every integral rate/phase representable. The production packed callback/layout switch remains disabled and coupled to 20d; future writer wiring still commits only a successful append's prospective clock.
