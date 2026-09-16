# Clean frame batches — verification

Date: 2026-09-16. Personal macOS development build; generated source media only.
No screen or microphone capture was started for this pass.

## Behavior proved

The shared frame owner validates all batch times before admission, pins a single
revision, preserves order and duplicate timestamps, and reuses individual durable
jobs. A full queue refuses only new items while cached duplicates remain readable.
A concurrent edit does not move admitted work. Failed frames still need explicit
single-frame retry; a batch is an observation/admission operation.

The real packaged app served eight sparse-source frames across an edit. CLI PNGs
preserved the independently numbered source pixels; MCP SDK image blocks matched
each CLI file byte for byte through their returned content indices. The existing
sparse test also preserved cut timing, historical cache regeneration after restart,
full resolution, and the original source hash. This proves SDK receipt, not an AI
model's visual understanding, and adds no new rendering or default-trail claim.

The socket-level adapter regression forces the first transfer to fail, then proves
the later image arrives and both leases close. Existing output directories remain
untouched. A separate file collision introduced after directory creation refuses
only that image, preserves the competing file, writes the following image, and
closes all three leases. Zero/nine timestamps and omitted clean mode fail before
service discovery.

## Checks and review

- Own app bundle rebuilt; generated sparse public test passed after the final core
  admission change (2.47 seconds). No permission/capture dependency.
- Core/service/protocol/CLI suite: 181 tests passed before the added unreadable-file
  regression. Final affected frame/CLI suites: 21 tests passed, including that
  regression and the competing-file case.
- Eight build/typecheck tasks passed. Changed-file lint and diff whitespace checks
  passed.
- Shape review retained the existing queue, frame planner/decoder, transfer reader,
  and output adapters. Added one public operation, no new worker or storage owner.
- Independent Codex review found that native filesystem errors escaped per-item
  admission. An actual unreadable cache file reproduced EACCES and prevented a
  later timestamp from being admitted. The regression failed before correction;
  admission and delivery now report unexpected failures per item. Second review
  found no actionable defects and independently passed seven core frame tests.
  Its CLI/native attempts were restricted by sandbox permissions; the app and
  socket checks above were run outside that review sandbox.
- Local review also narrowed output-directory failure sharing: an individual file
  write failure must not prevent later files. The CLI regression failed against
  the earlier built adapter with [success, failure, failure], then passed with
  [success, failure, success] after rebuilding the corrected adapter.

## Remaining gates

Default cursor/trail frames, shared boundary production, selected screenshot index,
and model-level recorded-image interpretation remain open. Maximum-size eight-image
MCP messages have not been tested against every host; each image still observes the
existing encoded-byte cap. This pass does not claim host-universal message support.

Root integration at 473852f passed the rebuilt app/type checks, 105 core, 56
service, 13 CLI and 9 protocol tests. The generated sparse-frame/batch test passes
alongside all three public audio tests and the native/core scene timing test on
the integrated tree. Sources remain synthetic; no wider visual gate is inferred.
