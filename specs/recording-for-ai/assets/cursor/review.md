# Cursor geometry integration checkpoint

Root built the integrated app and ran `bun run lab:cursor-geometry --out
/tmp/screenrec-cursor-integrated-run` on 2026-09-15. It captured only the recorder's
own fixture window, with both audio inputs disabled. The native capture suite,
frame suite, and seven native worker process tests passed on the integrated tree.

The [measurement report](window-measurements.json) retains raw predictions and
pixel locations. Five placements include moving, resizing into a letterbox and
moving onto a second display whose global y origin is negative. Maximum landmark
error was 0.77 pixels in decoded video and 1.10 across uncompressed captures;
maximum still-pointer error was 0.994 pixels. Three outside predictions drew no
pointer. At two inside calibrations, recorded video and clean capture matched
exactly in the pointer box while the paired cursor-enabled capture differed.
These are window-capture measurements, not display/region evidence.

The 22.61-second source had 1358 cursor samples, median interval 16665 microseconds,
zero reported skipped/refused/post-seal samples, and a 1.399-second omitted pause.
The source recording and complete image set remain under the run directory above.
The [resized overlay](resized-overlay.png) shows the measurement framing; numbers
mark target locations, not a production cursor-trail design.

## Remaining review

Root reproduced a delayed-reading bug with a controlled producer ordering: after
flushing a batch, a new geometry discarded the earlier placement before an already
taken cursor reading arrived. The retained regression fails before the correction
and passes when geometry cleanup uses delivered reading timestamps. Final review
of that correction is pending. The raw run above predates this correction and
remains evidence of its measured ordinary path only.

Fresh visual and independent Opus code review are pending. Computer-use access to
the app timed out by path and bundle identifier, so root did not drive corners,
circles, or an off-center region. Do not infer that evidence from the stationary
pointer measurements. Display/region capture, display reconfiguration and deliberate
gestures remain open gates. No physical audio was recorded or verified.
