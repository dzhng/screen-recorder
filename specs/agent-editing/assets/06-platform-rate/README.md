# Platform-selected encoding rate

The existing production `VideoRenderer` leaves bitrate selection to AVFoundation.
This comparison changes only the research probe's compression settings to that
same rate policy, retaining explicit Rec.709 conversion and tags. The frozen
[Swift source](RenderReproduction.swift) compiles alongside the repository's
`SampleTiming.swift`; run its `bounded` command with either retained request and
a fresh output directory. Requests retain the original observed paths.

[Measurements and file hashes](summary.json) show the first native-decoded frame
has identical pixels to the explicit 40Mbps case, with all fixed patches within
four levels. The whole-image four-level diagnostic still fails because of codec
loss. The three-second fixture produced 60 scheduled frames in roughly 0.88
seconds with bounded retained buffers; these are single observations, not a
latency guarantee or complete decoded frame-membership verification.

This is pending research evidence. It supports evaluating the existing platform
policy before introducing a fixed bitrate, but broader quality, frame checks and
[independent audit follow-ups](review.md) remain open. The audit verifies the
retained hashes, one-frame pixel equality and three-second decoded timing; it
does not accept general encoding quality. No production encoding setting changed.
