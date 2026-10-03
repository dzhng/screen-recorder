# Ordered camera acquisition and native presentation

The camera admission rule compares exact acquired timestamps. A callback's nominal
endpoint is provenance, not a reason to discard the next ordered picture or invent
an unavailable interval. Canonical closure retains native presentation between
pictures and ends at the earlier of the final physically decoded sample's native
support and its nominal endpoint. A required `native-bounded` receipt policy
prevents an older gap-based publication from silently replaying under this contract.

[The verified archive](verification.json) indexes every retained member through
[the manifest](manifest.json). It contains the exact changed sources, toolchain and
source/binary identities, focused/default test outputs, recovery requests/receipts,
public CLI responses, small media and all rendered pictures. Large real-take
candidates are identified in `external-media.json`, not duplicated in this archive;
the immutable original take remains in `fixtures/screen-camera-timing` through Git LFS.

## Earned checks

- The initial real-ingress cadence test failed because forward callbacks with
  overlapping nominal duration were discarded. The final distinguishable fixture
  covers every retained overlap magnitude against its own evolving accepted PTS,
  as well as duplicate/backward refusal. Nineteen acquired pictures survive once.
- Actual `PresentationSource` selection checks every acquired point and held
  interior against complete raw BGRA and exact acquired PTS. Positive start and
  before/at/after terminal boundaries are exercised. The added check found a real
  compact-fixture discrepancy: native support ended at 565044µs while the nominal
  endpoint rounded to 565047µs. Exact intersection fixes it; no tolerance changed.
- The final uninstrumented recovery preserves all 4428 physically represented
  pictures, with complete PTS/BGRA digest
  `66f1c50c6ba4536b3c1c5caccb5c1d213b0bb802b115777eb18da61f5260d86a`.
  Its span is 4147523–250114773µs. It retains `unsealedRaw` and
  `acceptedBeyondPhysicalEOF`; all seven original input identities are unchanged.
  The measured run took 28.143s with sampled RSS peak 161185792 bytes. These are
  diagnostics, not a new latency or memory acceptance budget.
- Frozen native worker `8a0c7732…` selects the preceding acquired picture inside
  both former failure neighborhoods, with byte-identical raw/canonical PNGs.
  Actual CLI import, project stills and six-frame previews cross both neighborhoods.
  Final regeneration changes container creation time; all 4428 compressed-packet
  hashes, PTS/DTS/durations/flags and remaining stream metadata match the publicly
  consumed candidate exactly. The archive retains both complete demux reports.
- Current receipts replay; absent/unsupported policies refuse without replacing
  canonical or input bytes. Existing pause, sealing, interruption, cancellation,
  torn/truncated input, publication retry, no-overwrite and graceful-stop tests pass.

## Scope and retained failures

The historical rejected pictures are unrecoverable; this does not claim corrected
acquisition of the saved take. Physical synchronization, a new live take, and
installed-app activation are not verified. Recovery exceeds the app's existing
10-second quit fallback, so these results do not close physical graceful-quit
acceptance. The [stop contract](../20e-selected-device-probe/graceful-stop/README.md)
intentionally permits interrupted, recoverable originals at that deadline. The
28-second observation measures offline recovery, not live closure; it does not
justify increasing the timeout. The service's recovery budget covers a different
operation and media set, so it is not a reusable live-camera shutdown bound.
A subsequent [prerecorded stop measurement](../20e-selected-device-probe/stop-scale/README.md)
now measures the selected-probe stop path itself. It confirms legitimate
accumulated-media closure can exceed the fallback, while retaining the separate
physical/AppKit limitations and unchanged shutdown policy. No generic reader, codec/color admission, audio owner or production
camera API changed. The abandoned sparse-edit experiments remain historical evidence.

The first consumer script incorrectly asserted absolute timestamps against a
normalized source clock; the corrected script explicitly subtracts the actual
4147523µs origin. A policy-refusal harness incorrectly expected the internal field
name in a generic error message; final checking uses the actual error envelope and
unchanged byte identities. Initial full JSON demux equality failed solely on
container `creation_time`; that difference is disclosed, not ignored as media drift.
These setup failures and the genuine cadence/terminal failures remain in the archive.

Independent visual review found no blank/corrupt frame or unexplained geometry/color
jump in the complete supplied window captures. The second window's blur is present
in its raw reference. Tiny windows do not prove synchronization or full-take visual
quality. Independent code review caught unbounded external-fixture decoding; the
fixture now reads one external frame and a bounded generated set. Final review found
no actionable issue. Local `codex review --uncommitted` was attempted with unchanged
defaults but the account rejected its configured model; the fresh collaboration
review supplied the independent review instead.

## Reproduction

Use the binary paths and complete hashes in archived `identities.json`. Both builds
use their existing isolated scratch directories with `--skip-update --jobs 2`.
Never overwrite the frozen app or native worker.

For `ScreenRecorderCaptureTests`, set a **fresh** output directory for each selector:
`SCREENREC_SELECTED_FRAME_OUTPUT` (cadence and held-picture consumer),
`SCREENREC_SELECTED_PROBE_OUTPUT` plus `SCREENREC_CAPTURE_GAP_CORPUS` pointing to
`specs/agent-editing/assets/00-corpus` (shared media/lifecycle),
`SCREENREC_PROBE_REPLAY_INPUT` pointing to that media output's `take` and
`SCREENREC_PROBE_REPLAY_OUTPUT` (receipt/recovery), and
`SCREENREC_SELECTED_STOP_OUTPUT` (stop ordering). With no selector, the executable runs the complete
existing offline capture suite. Archived scripts retain the actual immutable-input
recovery and public consumer commands; no device enumeration or capture is involved.
