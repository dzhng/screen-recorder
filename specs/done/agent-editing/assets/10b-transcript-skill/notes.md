# Transcript CLI evaluation

- The task's initial path `/tmp/source-transcript-live-2/selected.mov` did not exist. Task owner corrected it to `/tmp/source-transcript-live-2/multi.mov`; that file existed (4,609,714 bytes).
- Used `screenrec --help` output saved as `cli-help.json` and the connected isolated service socket. `model.status` reported `ready` (`model-status.json`).
- `asset.import` succeeded; imported asset ID: `871dbad881ef285aa7f6a29dbaf134ebdc233e405c160c50cf4202d0681c3241`. `asset.get` advertised two decodable mono LPCM audio streams, `track:1` and `track:2`, both 48 kHz and 12.5 s. Each had a 0.5 s `not_acquired` gap at source 6.0–6.5 s.
- Transcript jobs completed successfully. First five recognized words:
  - `track:1`: “Okay, so this is the” (25 words total; 2 segments).
  - `track:2`: “So let's do the first” (28 words total; 2 segments).
- Searched `track:1` for the observed phrase `draw a circle`. Search returned one match, word IDs `w11`–`w13`, source range 7,860,000–8,900,000 µs; no next cursor.
- Raw operation receipts are saved in this folder: `asset-import.json`, `import-job.json`, `asset.json`, both `transcript-track*.json` files, both `transcript-job-track*.json` files, `search-track1.json`, and `model-status.json`.
- Limitation: no audio playback/listening was performed; results are the CLI's transcript output. No model downloads or application launch occurred.
