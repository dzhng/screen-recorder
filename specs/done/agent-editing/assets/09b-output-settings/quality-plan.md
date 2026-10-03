# Balanced preset experiment

The user requested a balance of sharpness and file size, with all controls exposed.
This is an open-ended tradeoff study, not a request to minimize one hidden score.
The unchanged pre-encode public PNG is the reference; compare3/8/20Mbps while all
other resolved settings, source selection, canvas and frame rate remain fixed.

Start with one second of the real narrated-workbench screen at1920x1080/30fps,
source0. Capture full-resolution public PNGs at four exact frame timestamps and
compare matching decoded encoded frames. Report file bytes, mean/RMS/max RGB error,
and changed-channel share above the existing four-level diagnostic. No edge/text
exclusion, blur, rescaling or new error tolerance. File hashes and exact requests
must be retained. PNG ICC conversion to sRGB is explicit; the initial decoder is
FFmpeg RGB, which is a named measurement path rather than proof of source color
intent. Confirm the eventual decision with the existing Apple decoder control.

Hypothesis:8Mbps yields a useful error reduction versus3Mbps, while20Mbps offers
less improvement per added byte. A null result or a dominated8Mbps point rejects
that rationale; it does not license choosing8by name. This first task cannot select
a general preset. Expand to a moving-text window and actual recorded pointer
history, then inspect full frames and enlarged text/edge crops independently.
Retain all outcomes and select from the observed size/legibility tradeoff; preserve
codec-loss failures separately from a balanced-default recommendation.

Each public job uses the existing worker deadline. Only one cohort is active;
no exhaustive bitrate grid or repeated broad regressions. No installed app, live
capture or speakers are used. The first checkpoint emits measurements and samples;
no preset promotion is claimed without the expanded comparison and review.

Opening cohort: the Apple decoder preserves the FFmpeg ranking, with smaller
absolute error. Candidate8Mbps dominates3Mbps on this one static second (smaller
file and lower mean/RMS error);20Mbps lowers error further for more bytes. This
supports expanding the comparison, not preset promotion. A source-only1fps scan
of the real134-second recording finds its largest adjacent image change near41s.
The next fixed cohort is source[40.5,41.5)s, chosen for movement before examining
any encoder output. Screening downscales are never used for fidelity metrics.

The completed four-cohort comparison and independent 64-image review support
the balanced default described in [the decision](../09b-output-quality/README.md).
The ten-second interval confirms the tradeoff beyond the short static case.
Reversing encode order preserves the opening decoded hashes and file sizes.
Original strict pixel diagnostics remain failures; no acceptance threshold was
changed. The evaluator and retained hash/timestamp provenance passed independent
code review without actionable findings.
