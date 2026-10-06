# 01 · Original cut

57.1 s · hard cuts · no music · source: final edit only · user verdict: **"the cuts are good"**
(one note: Lily's "Welcome to SOTA TV" felt random mid-cut, so later versions drop it).

## Rebuild
```sh
python3 scripts/reproduce.py sota-graham-neubig-trailer/versions/01-original
```
`build.mjs` is a one-batch equivalent of the original three edits; verified to produce the same 16 clip
placements/source ranges and output processing as the delivered revision (`history/receipts/24-loudness.json`).

## Decisions, in order
1. **Brief:** ~1 min trailer for SOTA from the 33-min interview. Delegated editorial judgement.
2. **Find the takes:** whole-file transcription failed (screenrec "words must not overlap" bug), so audio
   was transcribed in 400/100/25 s extracts (`../../transcripts/`). The user's speaker-labelled transcript
   (`../../sources/`) confirmed who said what and that its timestamps match the video.
3. **Shape:** cold-open hook (a shocking stat) → show intro → research-flood problem → AI as a tool →
   human + AI → closing laugh line. Graham-led.
4. **Takes** (final-edit seconds, frame-snapped at 24 fps):
   | # | Line | Source s |
   |---|---|---|
   | 1 | "out of about 160 papers … written by agents, nine of them did not have an obvious mistake in them" | 671.88–681.20 |
   | 2 | Lily: "Welcome to SOTA TV. I'm Lily." | 0.10–2.88 |
   | 3 | "60,000 papers is just crazy. I don't think there's 60,000 interesting things we can say about AI." | 464.36–470.50 |
   | 4 | "LLM agents are really good at reviewing if you do them properly" | 1010.70–1014.90 |
   | 5 | "submitting a big set of slop is actually a disadvantage now…" | 179.04–185.28 |
   | 6 | "human AI teams are going to be better than just AI itself for a very long time" | 203.90–212.80 |
   | 7 | "I'm constantly trying to automate my job … fortunately for me, unfortunately for everybody else" | 543.20–563.30 |
5. **Cut padding:** start at the gap midpoint before the first word, end ~0.15 s after the last word.
   Verified by re-transcribing the edited audio (`history/notes/transcripts/v1-edited-audio.txt`).
6. **Stutter fix:** re-transcription revealed a "fortun-" false start (ASR missed it on the source). The
   waveform showed it at 559.84–560.26 s between silences; the closer is split into 07a (to 559.71 s) and
   07b (from 560.29 s).
7. **Loudness:** the source is quiet (−29.5 LUFS). Output dynamic normalisation to −14 LUFS / −1 dBTP / LRA 7
   (measured −14.2 LUFS).

`history/` holds every original request/receipt, the selection sheet and the review notes.
