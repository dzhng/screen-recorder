# 14d3b — Complete package assembly through the shared export owner

Status: planned. Depends on the verified ZIP producer and canonical timeline-event
serialization. This pass lifts the unsupported-package gate only after a real
complete no-narration package can be reopened. Acquired narration remains an explicit
transcript prerequisite; an absent engine never becomes no narration.

## One consumed lifecycle

Use RecordingExports and its existing intent, deferred admission, recovery,
cancellation, storage, abandonment and recording-deletion contracts. Pin source,
scene and screenshot-index generations before dependent work can change the latest
selection. Give IndexProcessing explicit pinned inputs and connect retention to the
existing cleanup owners. No separate preparation API or package scheduler is needed.
The selected revision/history and source acquisition determine the manifest; callers
cannot declare evidence ready or claim narration was not acquired.

## Register scratch before bytes

Assembly workspace locators and their parent's identity must be durable before
creation, then their creation identities must be durable before any payload writer
runs. A lost creation receipt permits only the existing empty-child recovery rule.
Known identities use identity-checked removal. A failed cleanup retains the intent,
its owned paths and its pending capacity until explicit retry establishes removal.
Scratch lives within recording-managed storage so the existing storage scan counts
its bytes; external publication staging continues through its existing measurement.

Every directory that startup cleanup can recursively remove must be protected by a
lock inherited by a surviving writer. The existing PackageWorkspace removal locks
its root; recursive ManagedFiles removal does not consult nested directory locks.
Use separately registered input and ZIP workspaces so archive.write inherits their
actual removal locks, or explicitly forward an enclosing root's lock through the
native lifetime. Merely holding an enclosing directory descriptor in Node is
insufficient: killing Node drops that descriptor while a native child can survive.
Do not add another recovery daemon or broaden arbitrary directory deletion.

The member plan can live under the registered input workspace, outside its selected
inventory. File identities and hashes come from bounded copies of actual inputs.
Retain opened source files through copying and detect source changes; do not use
whole-media buffers or trust paths after an identity check. The manifest inventory
is the exact selected portable payload, not whatever a recursive source walk finds.

## Assembly and publication

Use the existing source/scene/index portable writers and canonical event writer.
Preserve original media, raw journal, acquired audio, pinned history and retained
images. Read the resulting semantic payloads against their pinned inputs before
creating a ready manifest. The ZIP writer then receives the explicit inventory and
manifest; Publication remains the sole destination commit owner.

Scratch cleanup, publication acknowledgement and history are different facts. A
committed external ZIP remains successful if private cleanup fails. Retain enough
intent metadata to retry only that cleanup and never overwrite or delete the ZIP.
Cancellation drains both assembly work and native writing before releasing pins or
removing inputs. A process crash must not leave bytes outside any known cleanup or
storage owner.

## Verification ladder

1. Request a package, edit to a later revision while dependencies wait, regenerate
   source/scene evidence and run cleanup. Verify the pinned source/scene/index and
   revision survive through export. Failed dependencies remain explicit failures.
2. Export actual generated media with pauses, nonempty cursor/geometry/scene events,
   cuts, acquired system audio and retained screenshots. Compare complete semantic
   evidence, media hashes and history to independent source expectations.
3. Remove the original library, move the ZIP, open it through the public package
   reader and inspect retained images. Arbitrary frame/audio public parity uses the
   shared inspection work, not a private replacement reader.
4. Kill during workspace creation before its receipt, copying, ZIP writing and
   publication. Prove surviving-child fencing, correct retry, private-byte storage,
   abandonment and recording deletion without touching external files.
5. Missing/wrong-generation pages, a changed source, truncated bytes, bounded-space
   failure and narrated input without transcript must fail before claiming a
   complete package. A generated silent fixture never closes the speech gate.
