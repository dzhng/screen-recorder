#!/usr/bin/env python3
"""Grade sweep measured on real exports (H.264, decoded with AVFoundation like QuickTime), so the numbers
match what viewers see. Places 1 s of a source, applies each grade, exports, grabs the middle frame, and
reports wall RGB (blue-red), face luma and clipping.
   python3 scripts/grade-sweep-export.py <workdir> <name> <assetId> <atSeconds> <wallCrop w:h:x:y> '<grades json>'"""
import json, subprocess, sys, time, os, uuid
wd, name, asset, at, wall, grades = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5], json.loads(sys.argv[6])
here = os.path.dirname(os.path.abspath(__file__)); sr = os.path.join(here, "sr")
outdir = f"/tmp/gsx-{name}"; os.makedirs(outdir, exist_ok=True)
def call(step, op, body):
    json.dump(body, open(f"{wd}/requests/{step}.json", "w"))
    return json.loads(subprocess.run([sr, wd, step, op], capture_output=True, text=True).stdout)
def rgb(p, crop):
    return tuple(subprocess.run(["screenrec", "ffmpeg", "-v", "error", "-i", p, "-vf", f"crop={crop},scale=1:1:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout)
pc = call(f"gsx-{name}-project", "project.create", {"requestId": f"gsx-{name}", "title": f"export sweep {name}", "canvas": {"width": 1920, "height": 1080, "fps": {"numerator": 24, "denominator": 1}, "background": "#000000ff"}})
P, R = pc["data"]["project"]["projectId"], pc["data"]["project"]["currentRevisionId"]
us = round(at * 1e6)
rec = call(f"gsx-{name}-place", "edit.apply", {"projectId": P, "requestId": f"gsx-{name}-place", "expectedRevisionId": R, "operations": [
    {"operation": "track.add", "track": {"kind": "video", "order": 0}, "label": "V1"},
    {"operation": "place", "label": "c", "clip": {"trackId": {"label": "V1"}, "placement": {"kind": "project", "range": {"startUs": 0, "endUs": 1000000}}, "assetId": asset, "streamId": "track:1", "source": {"kind": "range", "range": {"startUs": us, "endUs": us + 1000000}}}}]})
R = rec["data"]["revision"]["id"]; T = rec["data"]["revision"]["document"]["tracks"][0]["id"]
for i, g in enumerate([None] + grades):
    if g is not None:
        rec = call(f"gsx-{name}-{i}", "edit.apply", {"projectId": P, "requestId": f"gsx-{name}-{i}", "expectedRevisionId": R, "operations": [
            {"operation": "processing.set", "target": {"kind": "track", "id": T}, "steps": [{"processor": {"type": "sdr-correction", **g}}]}]})
        R = rec["data"]["revision"]["id"]
    leaf = f"{name}-{i}-{uuid.uuid4().hex[:6]}.mp4"
    ex = call(f"gsx-{name}-{i}-export", "export.create", {"projectId": P, "exportId": str(uuid.uuid4()), "revisionId": R, "directory": outdir, "leaf": leaf, "kind": "video", "settings": {"preset": "sharp", "container": "mp4", "video": {"codec": "h264"}}})
    E = ex["data"]["exportId"]
    for _ in range(120):
        st = json.loads(subprocess.run(["screenrec", "export.status", "--params", json.dumps({"exportId": E})], capture_output=True, text=True).stdout)["data"]["state"]
        if st in ("committed", "failed"): break
        time.sleep(1)
    subprocess.run(["swift", os.path.join(here, "grab-frames.swift"), f"{outdir}/{leaf}", outdir, "0.5"], capture_output=True)
    png = f"{outdir}/t0.5.png"
    w = rgb(png, wall)
    a = json.loads(subprocess.run(["swift", os.path.join(here, "analyze-frames.swift"), png], capture_output=True, text=True).stdout)
    print(f"wall {w} B-R {w[2]-w[0]:+4d}  face {a.get('faceLuma') or 0:6.1f}  clip {a['clipHi']:4.1f}%  {json.dumps(g) if g else 'ungraded'}")
    os.remove(png)
