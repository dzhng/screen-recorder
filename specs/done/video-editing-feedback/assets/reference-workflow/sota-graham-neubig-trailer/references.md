# References and what we took from them

Reference media lives in `references/` locally (gitignored, third-party). Re-fetch commands are noted.

## Dwarkesh Podcast cold opens (for 02-dwarkesh)
Fetched with `yt-dlp --download-sections "*0-150"` from the Adam Brown (XhB3qH_TFds) and Grant Sanderson
(oDyviiN4NVo) episodes. The podcast RSS audio has *no* cold open (it starts at "Today I'm chatting with…").
- ~11 clips in ~45 s, cut back to back (pauses < 0.5 s), then a hard cut to the intro. No title card.
- Continuous music bed: held bright chords changing every ~2 s, sparse high melodic notes, no heavy drums;
  floor ~16–22 dB under speech peaks (we use ~13–15 dB).
- Picture: warm, well-lit faces on dark book-lined sets. A heavy low-key grade on our white-wall footage
  made faces muddy, so we matched warmth/brightness, not darkness (user: "way too dark").

## a16z "It's time to build" (for 03-a16z)
https://x.com/a16z/status/2009633915292856374 (105 s, 4:3). Narrated manifesto (VO + archival soundbites)
over cinematic archival/AI B-roll cut every ~1–2 s, teal/gold grade with grain and vignette, epic score,
gold A16Z logo, ending on "It is time to build."

## jevgrep launch video (music reference for 04/05/06)
https://x.com/dzhng/status/2103920741481848861 (the user's own). Modern tech-launch cue at **120 bpm**:
sub swell + riser intro (0–4.5 s), drop into four-on-the-floor kick with plucky synth hook and held leads,
whoosh sweeps every few bars, breakdown at ~20 s, riser into a second drop, held outro. −11 LUFS music-only.
`scripts/synth-music.py promo` is modelled on this structure.
