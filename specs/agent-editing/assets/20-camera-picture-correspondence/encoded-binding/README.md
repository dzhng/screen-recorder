# Encoded camera sample binding

Status: the first selected native encoded sample is uniquely bound to a current
demux packet and an actual decoded YUV frame. Full RGB correspondence remains
unfinished; the original complete-pixel failure stays intact.

The existing native cursor and sample-generator owners supplied the target and
neighboring keyframe bytes. Packet position, size and complete payload hashes
join those bytes to the current demux output. The target frame has the same raw
PTS, packet position and size. These measured coordinates differ from native
asset time; neither a decoder ordinal nor output-triggering DTS is its identity.

The first fixed interval lacked the following keyframe and stopped before
decoding. A successor located all three packets and the target decoded frame,
but its PNG selection missed the target. Its filter-visible guard could not
prove a bound on hidden seek preroll. A separate finite packet view then retained
all 64 ordered payloads, sizes, durations and flags but shifted every PTS/DTS by
853 microseconds. That strict metadata gate stopped before any PNG decoding or
pixel comparison. No offset normalization, tolerance or settings sweep followed.

[Verification](verification.json) owns the exact scope, operand pins and limits.
[The initial archive](evidence.tar.xz) retains the first two attempts;
[the finite-view archive](finite-view-evidence.tar.xz) retains the distinct third
attempt and saved-only postmortem. Actual runtime stopped at the first clock gate;
later saved format checks are not runtime gate passes. Full media, encoded bytes,
executable and pixel operands remain private with complete manifest bindings.

Historical PNG producer identity is still missing. This diagnostic supplies no
physical onset, drift or synchronization verdict.

The saved view's movie header uses 1,000 ticks per second and an empty edit of
83,652 ticks. The [FFmpeg MOV writer](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n8.1.2/libavformat/movenc.c)
rounds the initial presentation delay down to that movie scale, explaining the
observed 853-microsecond shift. This is diagnostic container precision, with no
demonstrated production clock defect. Exact equality with a historical PNG was
a sufficient diagnostic witness, not a required release gate. Stop this optional
comparison; the required gaps are detector-picture binding and physical onset
uncertainty through the existing timing owner.
