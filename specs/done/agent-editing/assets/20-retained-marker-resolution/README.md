# Retained camera marker diagnostic

This pass uses the existing four-minute iPhone take. The original camera hash was
verified once; original media and the earlier physical analysis are unchanged.
The [summary](summary.json), [review](review.json) and [complete evidence](evidence.tar.xz)
retain the declared detector, failed attempts, telemetry and complete captured
inspection set. This is a measurement diagnostic, not synchronized-capture acceptance.

Full-resolution bottom-edge samples reveal candidate panel flashes beyond the
old coarse detector's strong interval. The inherited event-window associations
2–25 span about 115 seconds; isolated 29 and later 38–40 are also visible. Missing
intervals are not filled from cadence. The initial full frame visibly identifies
number 2, but later numbers are clipped. Their associations remain inherited,
without independent number recognition or a measured false-positive rate.

Independent inspection of all full frames and crops confirmed partial brightness
in several predecessor samples and camera/content motion in an earlier rejected
crossing. Detector thresholds therefore cannot bound physical flash onset. The
reported residual and sample brackets describe detector crossings only. Camera
exposure/readout and the required physical one-frame bound remain unverified;
there is no whole-take synchronization pass.

The separate [clock-coordinate result](mapping-result.json) and
[ordinal evidence](mapping.tar.xz) compare all represented native picture times
with the acquired journal and saved FFmpeg presentation order. They disclose a
piecewise camera coordinate displacement, not a fitted drift correction. Every
measured candidate lies in the same constant-displacement region, so translating
that coordinate changes none of the first-event-aligned threshold residuals.
Cross-decoder picture identity at each candidate and a complete screen decoder
correspondence remain unsupported. Mixed-coordinate absolute offsets are not physical
latency measurements.

The [screen metadata result](screen-mapping-result.json) and
[complete cursor evidence](screen-mapping.tar.xz) tie represented native timestamps
to acquired callbacks with one omitted callback near EOF. FFmpeg represents a
different frame count. Same-ordinal timestamp comparisons give only a conditional
coordinate diagnostic: they do not prove those positions contain the same
pictures or improve physical precision. No fitted drift or additional alignment
is used.

The [bounded first-picture comparison](../20-camera-picture-correspondence/README.md)
now selects one saved native sample but fails complete pixel equality to the
historical full-frame image. Its separate color paths and missing historical
per-picture clock remain unresolved; the second request was not dispatched.

Further threshold tuning cannot supply missing event identities or physical onset
evidence. The remaining concrete link is same-picture correspondence at marker
ordinals across decoders, alongside the unresolved physical onset bound. No
replacement recording, capture or playback is prescribed.
