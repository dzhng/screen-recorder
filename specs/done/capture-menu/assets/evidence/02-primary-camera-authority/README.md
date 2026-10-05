# Primary camera authority proof

**Pass, October 5, 2026.** Allocation role and device kind are independent under
existing persisted formats. Primary camera uses the ordinary primary source,
layout-2 journal snapshot and primary receipt, without companion binding or proof
members. Bound companion camera retains layout 1 and its independent clock.

The [native fixture](../../../../../../helpers/mac/Tests/ScreenRecorderCaptureTests/PrimaryCameraPublicationTests.swift)
drives authored asymmetric prerecorded pictures through the production primary
writer and NativeCapture finish. It never fabricates screen completeness
attachments, opens a device or requests permission. The
[core admission probe](../../../../../../helpers/mac/Tests/fixtures/primary-camera-admission.mjs)
consumes the actual publication and normalized evidence and reopens their catalog.
The [manifest](manifest.json) freezes every retained operand and report; raw runner
logs are losslessly gzip-compressed, with both compressed and original identities. Finished
and unfinished source directories contain original media, journals and receipts.

The normal finish preserves authored picture starts and the existing healthy stop
tail. Its clock endpoint varies with invocation time. Recovery of unfinished,
torn and malformed suffixes retains whole original journals and video bytes,
while publishing only trusted support. Wrong allocation role, source ID, layout,
companion binding and foreign expected authority refuse. Staged evidence export
verifies the held original video descriptor against frozen primary authority.

Red evidence demonstrates the original camera-kind publication refusal, original
screen-attachment ingress refusal, and core companion-binding refusal. The
independent review found an overbroad core layout exemption; the additional
layout-red case reproduced it and the final check rejects missing/unsupported
camera layouts. Its sandboxed native fixture stopped before exercising the change
because the fixture encoder could not start. The direct reviewed native rerun and
actual-output core admission both passed; that environment failure is not counted
as native verification.

Preservation reports cover IndependentCameraClockTests, IndependentPublicationTests
and SourcePublicationRecoveryTests. The focused core evidence, capture-store and
capture-acquisition files passed **60 tests**. Native product build, core build and
type checking, scoped lint/format and diff whitespace checks passed. The full suite
remains the feature completion gate.

Reproduce from the repository root after satisfying the native build prerequisites:

```sh
swift build --build-system native --jobs 2 --package-path helpers/mac --product ScreenRecorderCaptureTests
SCREENREC_PRIMARY_CAMERA_PUBLICATION_OUTPUT=/tmp/new-primary-camera-proof helpers/mac/.build/debug/ScreenRecorderCaptureTests
bun run --cwd packages/core build
node helpers/mac/Tests/fixtures/primary-camera-admission.mjs /tmp/new-primary-camera-proof
```

This proves publication architecture, not a physical camera, selected-device
admission, narration or system sound. Public `{kind:"camera",deviceId}` and actual
device-clock ingress remain their later slice gates. No schema, table, migration,
compatibility shim or source-media rewrite was added. No visual artifact or claim
is part of this gate.
