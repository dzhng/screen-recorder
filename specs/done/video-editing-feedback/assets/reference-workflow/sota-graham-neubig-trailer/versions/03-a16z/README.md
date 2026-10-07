# 03 · a16z "It's time to build" style

59.3 s · Graham's lines as narration over AI-generated cinematic B-roll · epic build · gold SOTA logo.
Delivered as `a16z-v2`.

## Rebuild
```sh
python3 scripts/reproduce.py sota-graham-neubig-trailer/versions/03-a16z
```
The 8 images are committed (`assets/images/`; generated once by Codex/GPT image from
`notes/image-brief.md` and not regenerable byte-for-byte). Music: `synth-music.py epic --length 60
--hit-at 53.75` + filter in `reproduce.json`.

## Decisions, in order
1. **Reference:** a16z's manifesto montage ([`../../references.md`](../../references.md)).
2. **Structure** (`build.mjs` SEGMENTS): music-only lead (2 s) → "60,000 papers…" over a paper-storm library →
   "160 papers … by agents" over a robot hand writing, cutting to Graham on camera at "nine of them…" →
   "LLM agents are really good at reviewing…" over a glowing lens on code → on camera "I'm constantly trying
   to automate my job…" → "the taste part…" over a da Vinci-style sketch → "human-AI teams…" over
   Creation-of-Adam hands → "I don't think we're going to run out of problems anytime soon" over Earth at
   dawn → rocket launch (music build) → **hit** on the gold SOTA logo + "with Graham Neubig" (New York font).
3. **Pictures lead the voice through music gaps**; images get a 1.07× push-in (geometry `fit: cover`).
4. **Grade (on-camera only):** −0.15 EV, contrast 1.05, sat 0.8, 7200 K + vignette (v1's −0.35 EV crushed
   the face). Images already carry the teal/gold look.
5. **Music:** `epic` (drone + rising strings, taiko pulses tightening, riser, hit + brass at 53.75 s). Gains:
   0.22 under speech, 0.45 in gaps, 0.8 on the hit.
6. **Loudness:** dynamic normalisation −14.5 LUFS.
