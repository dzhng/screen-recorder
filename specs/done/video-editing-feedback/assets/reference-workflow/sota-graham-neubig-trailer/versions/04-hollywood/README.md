# 04 · Hollywood (production value)

61.8 s · co-host raw cameras · face-centred · subtitles · name titles · promo music · title card.
Delivered as `hollywood-v10`.

## Rebuild
```sh
python3 scripts/reproduce.py sota-graham-neubig-trailer/versions/04-hollywood
```
Music: `synth-music.py promo --length 62.633 --hit-at 56.833` + promo filter (`reproduce.json`).

## Decisions, in order
1. **Brief:** subtitles, "feel like a Hollywood production"; the user then clarified: production value,
   **not** letterbox bars ("you're cutting off parts of the video"), and centre the faces.
2. **Story** (from the co-host brief, centred on "which agent will be around in 5 years?"):
   | # | Line | Source |
   |---|---|---|
   | 01 | Lily: "which agent do you think will be around in five years?" (over the 7-agent graphic) | final edit 1557.24–1562.45 |
   | 02 | Graham: "Arguably, OpenClaw is already on a downward trend." (tier board) | final 1570.48–1575.625 |
   | 03 | Graham: "And the reason why I don't have one, despite being very agent-forward, is privacy." | **Graham raw** 1856.25–1859.40 + 1859.86–1860.54 (punch-in; drops "uh, like"; edges tested by ASR) |
   | 04a/b | Madison: "I've just accepted it. Like, my whole life is in— is in Instinct right now." / "I just kind of gave up on privacy." | **Madison raw** 1868.20–1873.08 / 1877.42–1879.70 (1.2× punch-in hides the jump; 1877.68 dropped "I just") |
   | 05 | Lily: "What is your vision for open weights in a year or two?" | **Lily raw p2** 61.54–64.80 |
   | 06 | Graham: "People have been saying … closed in six months for 18 months now. So it just hasn't happened." | final 1305.75–1316.36 (session 2: no Graham raw) |
   | 07 | Graham: "Out of about 160 papers that were written | by agents, | nine of them did not have an obvious mistake in them." | **Graham raw** 887.20–890.44, 892.46–893.62 (punch), 894.48–898.24 (raw has "by… uh… by"; one clean "by agents") |
   | 08 | Graham: human-AI teams | Graham raw 274.34–283.30 |
   | 09 | Graham: San Francisco joke | Graham raw 321.30–325.80 |
   Raw ↔ final mapping: 1 ms audio cross-correlation (offsets in the build comments/history).
3. **Framing:** Vision face detection (`notes/faces.jsonl`, `scripts/sample-faces.sh`). Faces are centred
   horizontally and only moved vertically if outside 40–50 %; zoom cap 1.25 (most shots 1.01–1.07×).
   Screen shares are never zoomed. Push-in 1.03 toward the face.
4. **Grades** (measured on real exports via AVFoundation, `scripts/grade-sweep-export.py`):
   Graham +0.15 EV / 5600 K (face ~130, 0 % clipped; the old +0.45 EV clipped walls 12–22 %), Madison
   contrast 0.85 / 6000 K (face 109→127, window no longer clips), Lily 4900 K (cream wall → neutral).
5. **Packaging:** sentence subtitles (Avenir Next DemiBold 44) on a soft bottom gradient; lower-third name
   titles from the brief; 4-frame dips; tracked-out "S O T A / A CONVERSATION WITH GRAHAM NEUBIG" card.
6. **Sound:** per-clip dialogue gain to −20 LUFS (sources ranged −16 to −38 LUFS; user: "some clips are too
   quiet"), then compressor (−26 dBFS, 3:1) + makeup ×2.213, music 0.25 under / 0.9 on the card, master
   ×1.862 + limiter −1.2 dBFS → −14.5 LUFS. (screenrec's normaliser kept failing its own tolerance.)
7. **QA:** `scripts/qa-video.sh`: faces centred, walls neutral, no black edges except the 4-frame dips.
