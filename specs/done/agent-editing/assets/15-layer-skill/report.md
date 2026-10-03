# Screenrec layer edit report

Project: `4f8a58c6-d0e7-46cf-b2ef-60be95dc9558`

Final revision: `97874861-1a0d-4961-9e88-9cb9c1b2346c` (ordinal 4)

The one-second project now uses a 96×160 portrait canvas at 10 fps. The screen clip keeps its full 0–1,000,000 µs duration and uses source crop `{x:16,y:12,width:32,height:24}` with `cover` fit across the canvas. The original audio clip remains on its separate audio track, with the same asset, stream, source range, and timing. The imported presenter asset `28e5519b7cfae58e3fa9e0b46884188335fe3b9a6918cfe70d5d7e83b3097253`, stream `track:1`, is on a new top video track for the full second, with `cover` fit in `{x:56,y:96,width:32,height:56}`.

## Delivered artifacts

- Movie: `screenrec-layer-final-r4.mp4` — committed export, 24,538 bytes, SHA-256 `beca2d6adb38e35c371271d1e0e7e32afc4709c4663b22250e93b901ee9105ad`.
- Project WAV excerpt: `narration-excerpt-final.wav` — 0–1 s, 48 kHz stereo, 48,000 frames.
- Inspected output frame: `final-frame.png` — 96×160 at project time 500,000 µs.

## Verification and limits

The final frame receipt records both source clips as available at 500,000 µs and shows both layers in the composed output. Pixel inspection of the delivered PNG found the visible presenter content at x=60–83, y=101–146, inside the requested destination rectangle. The narration excerpt is byte-for-byte identical to the WAV extracted from the original narration asset over the same one-second range (both SHA-256 `53c6ea94c89ea1567e864cd98b9587391e231a378cf2ed2f103f0b4a78ccb9bb`). No speaker playback was performed.

The frame receipt's `visual` coverage points report presenter y coordinates 8–64 while the delivered PNG's presenter pixels are at rows 101–146. I treated the delivered raster as authoritative for visible placement and kept the requested `y=96` parameter. The frame and audio rendering jobs and final video export completed successfully.

Public CLI help and operation receipts are saved beside the artifacts, including initial/final revisions, asset metadata, processing capabilities, edit requests/results, frame receipts, WAV receipts, and export receipts. An earlier export attempt for an intermediate revision encountered a destination collision; the committed final export uses its own leaf name.
