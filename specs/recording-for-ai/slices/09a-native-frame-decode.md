# 09a — Native frame decoding within a kept interval

Status: complete. Native execution, integrated worker and visual evidence verified;
the non-blocking visual checkpoint proceeds on recorded review.
Independent prerequisite: native workspace (00). This extracts
09's decoding seam so existing generated and own-window media can verify it while
service/recovery integration proceeds. It does not close 09, caching or audio.

## Contract

A Swift frame decoder accepts immutable source video, a requested source time,
and a half-open kept-source interval already resolved by the TypeScript timeline.
It selects the closest actual presentation timestamp inside that interval (earlier
wins ties), decodes that sample, and returns its actual timestamp plus image path,
dimensions and crop. It never interprets edits or chooses a frame outside the interval.
If there is no frame in the interval, report unavailable. Sparse/static media may
hold a frame only when its actual sample belongs to the same kept interval; report
the actual distance. Do not label a requested timestamp as the sample's timestamp.

Input times are safe integer microseconds. Crop coordinates are source-image pixels,
validated against the oriented image. Scale after cropping, preserve aspect ratio,
default max long edge 1600, explicit maximum 8192 and encoded output 32 MiB. PNG is
sufficient for this pass. Reject invalid times/crops/limits without overwriting source
media. Output is a caller-allocated derivative path, distinct from the source.

## Implementation evidence and verification

Inspect the installed AVAssetTrack/AVSampleCursor APIs: precise-timing assets can
seek to the last sample at or before a time, then inspect the next presentation
sample. This is a candidate for selecting actual samples without whole-video decode;
confirm it through real files before adoption. Decode the selected CMTime without
rounding it through microseconds first. Do not repeatedly scan from source zero.

Generate numbered/timestamped H.264 fixtures with independently expected images.
Verify nearest/tie, start/end bounds, a cut boundary excluding the preceding frame,
no frame inside a narrow interval, sparse samples, cropping/orientation, downscale,
and long-file random access. Retain decoded images and actual timing evidence.
Use compare-screenshots against fixture references and unprimed screenshot-critique
last before accepting visual results. This generated-media test needs no screen or
microphone access. Root integration binds the decoder to the existing native worker;
09 then supplies revision lookup, bounded workers, cache and audio excerpts.

Decoder internals and image-encoding details are delegated within these invariants.
No alternate timeline, cursor overlay, semantic analysis or standalone media service.

## Current checkpoint

[Evidence and review](../assets/frames/review.md) cover generated H.264 selection,
real worker requests, and beginning/middle/end frames from the existing five-minute
own-window recording. Cursor media timestamps are mapped through the track's edit
list into recording time before selection; decoding retains exact native time.
Two independent-review defects (crop arithmetic overflow and source aliases) are
fixed with red/green regressions. The full 09 slice remains open.
