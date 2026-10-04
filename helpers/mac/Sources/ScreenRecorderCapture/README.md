# Capture sources and acquisition evidence

[Native capture](NativeCapture.swift) owns device state and source production.
Discovery preserves identities without selecting, opening or authorizing a device.
Input preparation opens only the requested selection under existing authorization;
missing inputs refuse rather than silently choosing another. An omitted camera
selection touches no camera boundary. Pending SDK starts remain owned until their
replies are joined and each attempted resource is stopped.

## One acquisition clock

Delivered tracks share the host timestamp domain. The first complete screen
sample establishes source zero; preceding samples are omitted. Pauses remove the
same elapsed interval from every track, including late callbacks after resume.
An audio buffer crossing a pause boundary is omitted so paused speech cannot leak
through. Intentional omission and writer backpressure are different observations.

Screen, microphone, system sound and camera retain their independent source media.
Whole-system sound does not become application-only sound when a window is chosen.
Capture does not mix or retime those inputs. Submitted buffers can extend beyond
the finished file; submission statistics are not decoded availability.

A healthy ending can hold proven last-picture support through stop. Interrupted
capture stops at available support instead of fabricating a tail. Hidden windows
may deliver blank frames; pixel color cannot distinguish that from source loss.
Only the platform's interruption signal supplies that lifecycle fact. Interruption
seals the native clock and writers, then the app uses the same joined stop/discard
path rather than creating a second teardown owner.

## Closure is separate from publication

Closed source descriptors retain physical media and journal authority after inputs
and encoders stop. Primary and camera publication can succeed independently; final
stop joins both before releasing authority. A ready sibling does not inherit the
other source's verification delay or failure.

The [source publisher](CaptureSourcePublication.swift) owns completion and recovery
authority. Camera verification can use private immutable checkpoints while capture
continues; encoded bytes or mapping metadata alone do not certify decoded pictures.
The closing checkpoint picture begins the next window. Physical
closure freezes final operands, and publication or discard joins remaining proof
work before releasing the journal. This does not establish a general Stop latency.

Admission binds complete frozen authority to the expected source and held canonical
members. A verified completion receipt and a recovered source have different
provenance. Neither a positive duration nor a copied locator can manufacture that
authority. A later journal append may preserve an earlier trusted prefix without
making its new payload part of the earlier proof.

## Journals and crash boundaries

[The journal](CaptureJournal.swift) owns record types, validation, ordering and
write durability. A torn final record is a crash boundary; malformed content or
broken sequence invalidates the following suffix. A clean ending alone does not
prove media completion. Streaming readers retain observations without materializing
an entire pointer history in memory.

Fragmented media can preserve a decodable process-crash prefix. A crash before the
opening fragment may leave none; these guarantees do not establish power-loss
durability. Keep raw journals and media distinct from normalized evidence and
publication receipts so recovery cannot overwrite its own source authority.

## Cursor and geometry clocks

[Cursor geometry](CursorGeometry.swift) projects observations through the geometry
in effect when sampled, not when later written. Frame callbacks can describe an
earlier placement than the current frame, while cursor sampling advances separately.
Each observation must retain its matching geometry epoch; missing support stays
explicit instead of being filled with an invented movement.

AppKit's global bottom-left origin uses the display at the global origin, which
need not be the key window's main screen. Retain that display height with each
relevant geometry epoch so replay does not use today's monitor arrangement.
ScreenCaptureKit's content rectangle and scaling describe letterboxing as well as
resizing; fixed output dimensions cannot determine the source transform alone.

Outside coordinates remain outside rather than being clamped into the capture.
Pointer eligibility states captured-content support, not whether macOS drew a
cursor. Bounded sampling reports missing observations instead of retaining an
unlimited backlog. Physical projection findings and remaining unmeasured source
modes belong to the [recording evidence](../../../../specs/recording-for-ai/README.md).
