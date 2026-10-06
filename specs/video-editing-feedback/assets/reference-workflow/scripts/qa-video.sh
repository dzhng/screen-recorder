#!/usr/bin/env bash
# Vision QA over a rendered video: sample every 0.25 s, analyze faces / exposure / bars, summarize per take.
#   scripts/qa-video.sh <video.mp4> <timing.json from build stderr> <outdir>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
vid="$1" timing="$2" out="$3"
rm -rf "$out"; mkdir -p "$out"
# AVFoundation decode = what QuickTime shows (ffmpeg RGB conversion reads warmer; see FEEDBACK #28).
swift "$here/grab-frames.swift" "$vid" "$out" --fps 4 2>/dev/null
swift "$here/analyze-frames.swift" "$out"/f*.png > "$out/frames.jsonl"
python3 "$here/qa-summarize.py" "$out/frames.jsonl" "$timing" 4
