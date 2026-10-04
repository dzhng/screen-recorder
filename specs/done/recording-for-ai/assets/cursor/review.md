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

## Independent review dispositions

[Opus inspected all 29 images](independent-visual-review.md). Its tool permissions
allowed full-image reads but not enlarged crops, so root produced and inspected
seven targeted crops under `/tmp/screenrec-cursor-visual-crops` before triage.

- Missing pointer in the first three paired captures is expected: those samples
  are outside the window. The pointer-free recorded images are the required clean
  source, independently confirmed by pixel comparison. These are passing properties.
- The start frame's bottom white border and rounded corners are visible in the
  enlarged strip; all five fiducials are complete. The proposed clipping defect is
  not supported. Start uses a 552-point window frame including its title bar; the
  later 520-point frame is a real size change, retained in measurement metadata.
- Resized and second-display color patches differ slightly. The compared flat
  fill's per-channel standard deviation is below 0.49 of 255 levels, with at most
  two levels of mean color shift ([metrics](flat-fill-metrics.json)). That supports
  small native color/dither variation, not the claimed heavy corruption. Exact
  color preservation across physical display profiles was not proved by this gate.
- The enlarged cyan glyph is an ordinary squared-off digit 3 (right vertical
  strokes), not a mirrored numeral. Marker numbers and target locations are legible.
- Different system cursor bitmap shapes, padding and representation sizes are
  diagnostic native observations, not product cursor assets. Their hotspots and
  pixel-to-point scale are included in the calibration; no production glyph design
  is accepted from those files. The placement verdict uses measured image deltas.

The [code review](independent-code-review.md) identified useful stream status,
display-space exposure and sampler coverage gaps now assigned to the correction.
Its dismissal of the empty-batch ordering issue is rejected: timestamp acquisition
precedes enqueue on the separate sampler producer, and the controlled red/green
regression demonstrates the lost geometry. An asserted single-queue proof does not
order those independent producer timestamps. No extra unreachable-call guard or
unmeasured display/region claim is being adopted.

## Corrected integration

Cursor correction `9c1f7e2` retains geometry by delivered-reading watermark, bounds
placement history, returns journal stream status and exposes recorded display-space
changes. Real sampler pause/resume and blocked-queue tests pass. Independent review
of that commit found no actionable regressions; its native execution was restricted,
so acceptance uses root's native run. Root additionally reproduced a frame whose
metadata has no source location yet incorrectly lending a real epoch to an
`unknownGeometry` sample; that regression now passes with epoch zero.

The corrected app builds and the own-window fixture completed again; see
[the corrected measurements](corrected-window-measurements.json). This confirms the
ordinary placement path after reader changes. Deliberate gestures, display/region
capture and display reconfiguration remain open; no new visual styling was added.
