# Selected-source WAV delivery

Selected asset audio uses the existing audio operations, shared jobs/cache and
artifact leases. The service validates the native receipt and stored WAV before
publishing. CLI writes through the existing exclusive streaming sink. MCP embeds
bounded audio; large audio keeps its renewable artifact delivery for explicit reads.
No whole-file buffer is needed for extraction or file delivery.

## Verification

The focused CLI suites pass 23 tests; source/project service and delivery suites
pass 25; integrated core cache, audio and preview suites pass 45. Workspace type
checks and the CLI dependency build pass. Source routing's socket regression
publishes one known float sample through a boundary-fixture native response and
checks the actual delivered WAV bytes. It is transport/ownership proof, not native
extraction evidence.

The [large-file regression](large-wave-red.txt) fails on the old shared WAV limit;
streamed audio and video above that limit now pass with exact bytes and exclusive
destination preservation. MCP leaves large audio unread/unclosed for the caller.
The [renewal mutation](renewal-mutation.txt) removes active lease renewal and fails
with ARTIFACT_EXPIRED. Its passing regression advances a controlled clock during
real socket reads; it does not claim an actual long native transfer.

Independent Codex review found no actionable regressions. Its own integration
tests/build encountered sandbox socket/cache permissions and native toolchain
errors; unrestricted root verification above passed. Shape review retains one
shared delivery consumer and keeps memory limits at the buffering boundary.
Changed-file lint/format and diff checks pass.

Actual native CLI/MCP source extraction, capture masks and >1 GiB delivery are
being verified by the audio-extraction journey. Project taps remain unimplemented;
this pass does not close slice 11a.
