# Native clean visual observations

## Verification

- Native worker build passed.
- Two `visual-samples.test.mjs` tests passed: exact request/actual timestamp and
  pixel-byte contracts; bounds and strict fields; nearest earlier tie; kept-span
  exclusion; source immutability and absence of derivative files.
- A real 52-observation batch over 10.2 seconds took 1.39 seconds, peaked at
  28,983,296 bytes RSS and returned 484,915 bytes for a 160×90 generated clip.
  These are measured fixture results, not universal latency guarantees.
- `ScreenRecorderFrameTests` passed its existing full suite plus analysis-selection
  parity, sparse held-pixel equality and rotated top-left RGB checks against its
  independent AVAssetImageGenerator oracle.
- Existing wire, frame-worker and parent-lifetime tests passed all eight tests.
- Independent `codex review --uncommitted` found no actionable defects. Its build
  passed; its codec/runtime checks were sandbox-limited. The checks above ran
  outside that sandbox.

## Review

One decoder, sample selector and oriented-image owner serve both rendered images
and clean observations. Production additions introduce no scene detector, native
cadence, timestamp conversion, edited-time mapping or cache beside those owners.
Core still must implement scene analysis and decide overlay timing for held frames;
this seam does not settle that question.

The generated orientation test caught an initial extra vertical flip: Core Image's
bitmap output already has top-left row order. The corrected production path passed
asymmetric corner checks. A second assertion initially sampled scaled interior text
against an unscaled corner; matching the compared areas fixed that test oracle.

## Decision handoff

**Sound, high confidence:** analysis pixels are aspect-preserving, capped at a
64-pixel long edge, sRGB RGB8, and have top-left row order. A small colored panel
therefore stays colored evidence, while its recorded orientation agrees with public
screenshots. Thresholds belong to core and must be validated against these actual
bytes; the native code does not decide whether a visual change is meaningful.

**Sound, high confidence:** only consecutive repeated actual timestamps reuse the
last decoded pixel string. For example, sparse video can map many nearby requests
to one image. Their distances remain distinct; the operation does not turn them
into fabricated new captured frames. This bounds decoding without a persistent
native cache or changing selection.
