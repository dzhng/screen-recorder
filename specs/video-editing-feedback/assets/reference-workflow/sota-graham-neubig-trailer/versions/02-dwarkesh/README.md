# 02 · Dwarkesh-style cold open

61.8 s · 9 rapid-fire takes · dips to black · "lift" music bed · title card · final edit as source.
Delivered as `dwarkesh-v9`.

## Rebuild
```sh
python3 scripts/reproduce.py sota-graham-neubig-trailer/versions/02-dwarkesh
```
Music: `synth-music.py lift --length 62.5 --hit-at 57.333`, then an `aecho … alimiter` pass (exact filter in
`reproduce.json`); its SHA-256 must equal the asset in the delivered edit. The build regenerates byte-identically
the edit request behind the delivered export (`history/requests/40-assemble-v9.json`).

## Decisions, in order
1. **Brief:** "Dwarkesh Patel podcast-inspired": he opens with a burst of spicy takes over music with nicer
   transitions. Analysis of real cold opens: [`../../references.md`](../../references.md).
2. **Takes** (final-edit s): 160 papers (671.88–681.20) → 60,000 papers (464.36–470.50) → slop (179.04–185.28)
   → open weights "…18 months now. So it just hasn't happened" (1305.75–1316.36; starts after a stray "and"
   found by re-transcription) → OpenClaw "too chaotic for me" (943.44–947.20) → "OpenClaw is already on a
   downward trend" (1570.48–1575.625; the end extended because ASR times ran ~0.3 s early and clipped
   "turn") → "constantly trying to automate my job" (543.20–546.04) → human-AI teams (203.90–212.80) →
   San Francisco joke (246.40–250.85). Lily's intro dropped (user feedback on 01).
3. **Transitions:** 4-frame dips to black; 12-frame fade-in; title card "SOTA / with Graham Neubig".
4. **Music:** v1–v7 used a minor-key piano bed; the user said "so depressing, way more exciting". After
   analysing real Dwarkesh cold-open audio (held bright chords, sparkly top line, no heavy drums), the bed
   became `lift`: 112 bpm D major IV–I–V–vi, pulsing arpeggio, bell melody, hats then kick/claps, lift on the
   card. Music ~13 dB under speech (0.28 gain), 0.9 on the card.
5. **Grade:** user rejected the dark grade + vignette ("way too dark, edges darkened way too much").
   Final: +0.3 EV, contrast 1.05, sat 1.05, 6900 K, no vignette. (Later versions use Vision-verified
   per-camera grades; this one predates that work.)
6. **Loudness:** output dynamic normalisation −14.5 LUFS (−14.0 failed screenrec's own 0.2 LU tolerance).
