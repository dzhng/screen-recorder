# 14c2 — Retained archive inspection lifetime

Status: implemented internal context; [verification](../assets/portable-inspection/retained-context.md). The verdict is actual retained
ZIP → shared frame/trail/audio/index parity, followed by drained cleanup. No public
handle, scheduler identity, library import or transcript readiness is added.

## Seam and ownership

Promote the same extraction/manifest-verification flow into an internal retained
context. The receipt-only verifier and retained context share one extraction transaction;
there is no second ZIP or manifest validator. The caller still provides an open private
workspace directory, its locator and exclusive lifetime. Workspace locks and final
cleanup use 14c1's inherited FD and shared ManagedFiles owner.

Native extraction records local file identities separately from portable inventory:
exact device/inode, size and change/modification times. These are runtime admission
receipts, never serialized into the portable manifest. The read resolver opens a
regular leaf without following any ancestor symlink, then compares its full identity
**before reading bytes**. A replaced ordinary ancestor cannot substitute a new leaf.
An unavailable/renamed locator fails explicitly; no invented library path or root
stat check substitutes for the opened file check. Original admitted files remain
private and immutable. Arbitrary same-UID in-place mutation between every syscall
is outside the ownership model; controlled replacements must fail or retain the
original opened object, and never read an external sentinel.

The common file-access seam opens a closeable descriptor lease. Existing ordered
page codecs and retained-PNG validation consume it; trusted internal directory
fixtures use the same readers with ordinary file access. No shadow database,
second page decoder, timeline arithmetic or index selection is introduced.

Context close first stops admission, cancels and awaits native operations, revokes
held synchronous read leases, then calls descriptor-relative cleanup. Closed readers
fail; repeated close joins one terminal promise. Cap simultaneously opened files,
active native requests and retained derivative bytes. Failed output attempts retain
their reservation until close, so partial files cannot evade the limit. Full public job/cache/delivery
ownership and cold-start reclamation remain 14c3 work.

## Native media input and output

Darwin cannot traverse `/dev/fd/<directory>/member`, and AVURLAsset cannot directly
open `/dev/fd/<file>` media in the tested runtime. A tiny real probe confirmed that
Apple's [resource loader](https://developer.apple.com/documentation/avfoundation/avassetresourceloader)
can serve `pread` from an admitted FD while preserving sample cursors and actual
AVAssetReader decoding. Put this input owner beside the shared media-time helpers;
FrameSource and AudioSource retain it for their complete asset/reader lifetimes.
Serve fixed-size chunks, handle short reads/errors/cancellation, and keep no cache
of whole ranges. This changes file access, not decoding, sample selection or mixing.

Outputs are also admitted FDs: create an exclusive leaf through the owned workspace
FD, open its locator without truncation, verify identity, then inherit that handle.
PNG writes use the existing encoded bytes. AVAudioFile writing directly to an
inherited FD works when the WAVE file-type hint is supplied; retain the same PCM
stream and sink rather than introducing a second encoder. Outputs stay private
until the native operation is terminal. All native calls also inherit the locked workspace descriptor, appended after media
slots, so parent death cannot expose a live child’s files to orphan cleanup.
Close drains workers before deleting files;
a replacement locator cannot redirect a write through an already-admitted FD.

## Verification

Build a generated **no-narration** ZIP from actual source, scene and index owners,
with system audio and acquisition gaps. Keep 14a's narrated-manifest refusal intact.
Use existing timeline/history projection for the chosen old revision and admitted
later revisions. This is a generated fixture, not ASR or real capture acceptance.

Compare library inspection against retained ZIP inspection after removing the
original catalog/media and moving the ZIP: new annotated/clean frames near scene,
pause, geometry and cut boundaries, exact requested/actual times and pixels; audio
PCM/container bytes and missing-role/gap reports; retained index images, coverage,
scene/source pages and historical revision mapping. No analysis cache is available.

At controlled barriers replace an ancestor/member with a foreign regular file or
symlink; its contents must never be consumed or modified. Replace a pathname after
media admission and prove the native worker uses the original FD. Hold an image
read and a confirmed native operation while closing; close must revoke/drain both
before workspace cleanup. Test resource caps and repeat close. Mutation-check an
identity/no-follow guard and the close/drain order. Keep existing readers, native
frame/audio, archive and ManagedFiles tests green.

Use compare-screenshots for generated parity, then independent screenshot-critique
last on any new visual evidence. Follow the non-blocking review window in the parent
verification plan. No user approval is required for these reversible internal choices.

The next scheduling prerequisite is [14c3a — transient context jobs](14c3a-transient-context-jobs.md).
It supplies shared execution capacity; package storage admission, delivery ownership
and restart recovery must still be bound by the later service registry.
