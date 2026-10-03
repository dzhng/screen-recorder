# Project layer inspection

Inspected project `4f8a58c6-d0e7-46cf-b2ef-60be95dc9558` at pinned revision `97874861-1a0d-4961-9e88-9cb9c1b2346c` through the public CLI and isolated service socket.

- **Canvas and duration:** 96×160, 10 fps, opaque black background. The revision contains one second (0–1,000,000 µs) of video and audio.
- **Base video:** asset `66f88c284621ef2d552f0e13edd976ebfb1ad2b29c737829380a7358e4d6a776`, stream `track:1`, oriented source 64×48. Its authored geometry crops source pixels `(16,12)` with size 32×24, then covers the full canvas `(0,0,96,160)`. The clip maps project 0–1 s to source 0–1 s.
- **Presenter:** asset `28e5519b7cfae58e3fa9e0b46884188335fe3b9a6918cfe70d5d7e83b3097253`, stream `track:1`, source 24×40. It is on video track order 1, above the base track at order 0, and covers project 0–1 s. Its authored geometry uses `cover` in destination `(56,96,32,56)`; no source crop is authored.
- **Audio/narration binding:** the separate audio clip binds asset `130d3c741b520d9b8725e9ad8eb074b0fff2821e3201e99cb3eebf4d64e235c1`, stream `track:1`, a decodable 48 kHz stereo WAV, over project/source 0–1 s. The binding is verified; speech content was not transcribed or listened to.
- **Rendered picture:** the processed output frame at 500,000 µs is 96×160. Its provenance lists both expected video clips and source samples at 500,000 µs. The visible white presenter mark sits within the authored lower-right destination; its geometry is consistent with the authored placement. The base appears black in this frame. This checks one instant only.

The decoded presenter source is 24×40 (aspect 0.6), while its destination is 32×56 (aspect ≈0.571); `cover` therefore trims a small amount horizontally. The frame shows the presenter mark at the expected lower-right placement. No audio-content claim is made.

## Receipts

- `help.json`: CLI operation/schema discovery
- `project.json`, `revision.json`: project identity and pinned authored revision
- `video-base-asset.json`, `presenter-asset.json`, `audio-asset.json`: source stream metadata
- `base-processing.json`, `presenter-processing.json`: authored geometry stacks
- `picture.json`: processed output frame receipt and layer/source provenance
- `picture`: delivered processed PNG at 96×160
- `picture-upscaled.png`: enlarged viewing copy of the delivered PNG
