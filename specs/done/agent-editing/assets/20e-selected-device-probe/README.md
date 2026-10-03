# Selected-device probe: offline preparation

The feature-owned app probe now has a concrete selected-device request and an
explicit activation boundary. Offline tests exercise its shared native lifecycle,
clock conversion, separate camera publication and recovery. No device enumeration,
permission read/prompt, capture, playback, explicit signing, installation or download
was performed. Parent20's physical measurements and parent21 remain open.

[Archive](captures.tar.xz) and [complete member identities](archive.json) retain the verification packet.

## What the evidence establishes

Prerecorded callbacks traverse NativeCapture and the same queue-owned probe ingress.
The canonical microphone matches the independently offered PCM, including omitted
pause crossings. Camera media retains its positive first offset, actual gaps and
shared pause/origin. Stop while paused, post-seal callbacks, failed startup, discard,
row-limit interruption and cached companion failure across audio-publication retry
preserve the authoritative screen/microphone result.

The camera closes raw encoding, pins a closed marker and replays its streamed
accepted-frame mapping. Passthrough edit lists materialize only acquired support;
complete occupied timestamps and BGRA pixels must match raw pictures before a
no-replacement publication. Verification stores only coalesced segment boundaries
and reopens the pinned mapping for its second pass. NativeCapture remains the sole
termination owner, and existing journal lease, identity and NewFile primitives own
recovery fencing. No production camera role or audio writer was added.

Saved-file controls verify repeated publication and resumption after the durable
receipt but before the final link. Changed raw/mapping/marker bytes and conflicting
canonical output refuse without replacement. Canceled work publishes nothing.
Torn mapping and raw pictures without a mapping publish only verified prefixes with
explicit diagnostics. Missing closure proof remains `unsealedRaw`; a truncated
nonfragmented MOV with no readable track refuses and retains its bytes. This does
not claim recovery of every crash-truncated container.

A synthetic2x clock checks every timing-entry PTS/DTS and duration endpoint. The
contiguous60fps control accepts all three frames, refuses an actual duplicate and
ends at exactly50000µs. The initial arithmetic assertion used1/60seconds without
accounting for host-clock quantization; its failure is retained. The revised clock
conversion control uses exactly representable25ms host intervals; the separate
rational60fps regression is unchanged.

## Public source support and color boundary

A separate retained baseline709/sRGB sample was injected without metadata changes.
The produced raw/canonical files retain those tags. Actual frozen-worker `media.probe`
segments supply availability to `sourceVisualSamples` and `sourceFrame`; every
acquired picture matches the raw PNG exactly, and gap/end requests refuse without
publishing a PNG. This is an offline source-consumer gate, not a physical camera or
universal color-support claim. The original SMPTE-C candidate's NOT_READY response
and unfiltered decoder black-buffer result remain in the
[unchanged earlier archive](../20e1-camera-gap-materialization/README.md).

The first consumer harness accepted only one gap-error spelling and stopped on the
correct `UNAVAILABLE` response. Its script/log remain; the continuation reused exact
saved responses and issued only remaining requests. It did not rerender a candidate
or modify source availability to pass.

## Build, review and limitations

The archive retains complete media/results, requests/responses, build/test logs,
source identities and the probe-only scratch app inventory. The app was assembled
at `/tmp/screenrec-20e-reviewed-app/ScreenRecorder.app` with the existing
`com.david.screenrec` identifier. It was never launched and has no normal service
resources. No explicit signing operation was performed; Swift linking can apply an
ad-hoc signature. Read-only signature display confirms the linker ad-hoc signature, no team, unbound
Info.plist and no sealed resources. TCC identity/grants remain unverified and are
not inherited from an installed app. Frozen native worker8a0c7732 remained unchanged.
The exact identity and uninvoked next commands are in [physical follow-up](follow-up.md).

The existing default capture suite and original offline camera harness pass. The
latter still reports its inherited simulated microphone delivery discrepancy; its
clock-plumbing result is not promoted into exact audio proof. Exact audio here is
earned by the actual canonical writer route above. App compilation initially used a
stale SwiftPM dependency source list; documented build-manifest-cache disabling
replanned it successfully, with no package/source workaround.

Shape/diff/docs review keeps one lifecycle and one durable camera publication owner.
The initial independent review was clean. Final review found that dropped-frame
callbacks could still write after evidence failure; the shared stopped guard repairs
that path. Removing the guard fails the real delegate-callback regression; restoring
it passes. Its failure trigger is synthetic clock loss followed by an externally
written tail, so it proves no further modification, not an actual partial-disk-write
fault. Separate replay controls establish partial-journal recovery. Independent
follow-up confirmed the repair with no remaining scoped finding and executed no
media. Reviews and exact invocation receipts are retained in the archive.

## Decisions carried forward

- **Sound, medium confidence:** the probe's5-million-row guard stops with an explicit
  interrupted result instead of dropping evidence. It is an operational probe bound,
  not a production camera setting or performance promise; the forced-limit test
  verifies that distinction.
- **Sound, high confidence:** canonical replay checks content identity and never
  replaces a conflicting file. It does not promise inode identity across relocation.
- **Sound, high confidence:** raw media, mapping, failed candidates and publication
  receipts remain recoverable. They are probe evidence owned by the caller, with no
  new cleanup service, generic recovery framework or hidden camera API.
- **Sound, high confidence:** actual physical drift, permissions and interruption
  behavior still require explicit user-authorized selected-device measurements.
  Compilation and simulated clocks supply no consent and no physical timing claim.

[Graceful-stop correction](graceful-stop/README.md) follows the real selected take:
app quit now reaches shared finalization, with offline regression evidence and
physical/AppKit limitations explicit. Camera decoder recovery is separate.

[Saved candidate diagnostic](candidate-reader/README.md) completes in isolation
but reveals a mapped-timestamp mismatch; it neither explains the original hang
nor earns camera publication. Original inputs and refusal remain retained.

[Prerecorded stop at camera scale](stop-scale/README.md) measures the actual
selected-probe stop-to-durable-result path with the retained movie. It verifies
full camera publication and keeps physical drain, microphone and AppKit quit
acceptance separate.
