#!/usr/bin/env python3
"""Summarize analyze-frames output per take: face centring, head cut-off, exposure, bars."""
import json, statistics as st, sys
rows = [json.loads(l) for l in open(sys.argv[1])]
T = json.loads(open(sys.argv[2]).read().strip().splitlines()[-1]); fps_s = float(sys.argv[3]); FPS = T["fps"]
spans = [(k["label"], k["start"] / FPS, k["end"] / FPS) for k in T["takes"]] + [("card", T["speechEnd"] / FPS, T["total"] / FPS)]
for lab, a, b in spans:
    rs = [r for r in rows if a + 0.15 <= int(r["file"][1:6]) / fps_s < b - 0.15]  # skip transition frames
    if not rs: continue
    fr = [r for r in rs if r.get("face")]
    luma = st.median(r["luma"] for r in rs); hi = max(r["clipHi"] for r in rs); lo = max(r["crushLo"] for r in rs)
    bars = max(max(r["bars"].values()) for r in rs)
    line = f"{lab:28s} n={len(rs):3d} luma {luma:5.1f} clipHi≤{hi:4.1f}% crush≤{lo:4.1f}% bars≤{bars:4.1f}%"
    if fr:
        cx = st.median(r["face"]["cx"] for r in fr); cy = st.median(r["face"]["cy"] for r in fr)
        top = min(r["face"]["top"] for r in fr); fl = st.median(r["faceLuma"] for r in fr if r.get("faceLuma") is not None)
        line += f" | face {len(fr)}/{len(rs)} cx {cx:.3f} cy {cy:.3f} minTop {top:.3f} faceLuma {fl:5.1f}"
    print(line)
