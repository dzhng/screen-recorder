# 05 · Spicy (TikTok energy)

61.8 s · same story, framing, grades and levels as 04 · word-pop captions · stat slams · emojis ·
crash/flash transitions + SFX · music drop-out. Delivered as `spicy-v4`.

## Rebuild
```sh
python3 scripts/reproduce.py sota-graham-neubig-trailer/versions/05-spicy
```
**Verified:** a from-scratch rebuild matched the delivered video on all 1,485 decoded frames and the audio
MD5; music, overlay and SFX regenerate byte-identically (hashes in `reproduce.json`).

Pipeline: `notes/words.json` (word times on the project clock, from `scripts/project-words.py`; committed,
so ASR is not re-run) → `overlay-spec.py` → `scripts/render-overlay.swift` (PNG frames) → ProRes 4444 alpha
→ overlay track; `sfx.py` → SFX track; promo music → `build.mjs`.

## Decisions, in order
1. **Brief:** "TikTok-style subtitles that animate in and highlight exactly the word being said; more
   exciting and spicier; spicier transitions; surprise me", as a branch, keeping Hollywood intact.
2. **Captions:** ≤3-word groups, Avenir Next Heavy 96 uppercase with black stroke, pop-in overshoot; the
   spoken word turns yellow and bumps ×1.1. Display text is the curated cue text; timing comes from ASR of
   the edit's own dialogue, aligned with difflib. Moved to ~60 px bottom margin (user: "way too high").
3. **Surprises:** stat slams with shake (18 MONTHS / 160 PAPERS / ONLY 9), emoji pops (⏳ 📉 🔒 🤷‍♀️ 🤝 🌉,
   300 px, spring + wobble; user: "lean into it") clamped to their take, sliding red name tags, a title
   slam.
4. **Transitions:** flash cuts and crash zooms (1.12→1) on cuts, bumps on internal punch cuts. Whips were
   removed because they exposed black. Screen shares never zoom.
5. **SFX** (synthesized): whooshes into crashes, impacts on flashes and stat slams, pops on emojis, riser and
   boom into the title.
6. **Music:** promo (`synth-music.py promo`, modelled on the user's jevgrep video), 0.33 under speech; cut to
   silence for "nine of them did not have an obvious mistake in them" and slammed back on the next flash.
7. **Master:** same dialogue chain as 04; master ×1.82 → −14.6 LUFS.
