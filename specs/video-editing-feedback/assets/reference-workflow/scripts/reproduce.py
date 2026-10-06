#!/usr/bin/env python3
"""Rebuild one video version from the raw recordings, exactly.
   python3 scripts/reproduce.py <project>/versions/<NN-name> [--raw ~/Downloads] [--skip-import]
Steps: import + verify sources (scripts/import-sources.py) -> regenerate music / caption overlay / SFX
from the committed scripts and check each file's SHA-256 against the original asset ID -> build the
edit (build.mjs) -> export to <project>/exports/<name>. Reads <version>/reproduce.json."""
import argparse, hashlib, json, os, subprocess, sys, time, uuid
ap = argparse.ArgumentParser(); ap.add_argument("version"); ap.add_argument("--raw", default="~/Downloads"); ap.add_argument("--skip-import", action="store_true")
a = ap.parse_args()
here = os.path.dirname(os.path.abspath(__file__))
vdir = os.path.abspath(a.version); proj = os.path.dirname(os.path.dirname(vdir)); name = os.path.basename(vdir)
cfg = json.load(open(os.path.join(vdir, "reproduce.json")))
work = os.path.join(proj, "exports", "_work", name); os.makedirs(work, exist_ok=True)
def run(*cmd, env=None, **kw):
    r = subprocess.run(list(cmd), capture_output=True, text=True, env=env, **kw)
    if r.returncode: sys.exit(f"FAILED: {' '.join(map(str, cmd))}\n{r.stderr[-1500:]}")
    return r.stdout
def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""): h.update(b)
    return h.hexdigest()
def sr(op, body): return json.loads(subprocess.run(["screenrec", op, "--params", json.dumps(body)], capture_output=True, text=True).stdout)
def import_file(path):
    d = sha(path); rid = f"import-{d[:16]}-{hashlib.sha256(path.encode()).hexdigest()[:8]}"  # same bytes at another path = new request
    r = sr("asset.import", {"requestId": rid, "path": path})
    if not r.get("ok"): sys.exit(f"import failed for {path}: {json.dumps(r)[:400]}")
    job = r["data"]["jobId"]
    while (j := sr("job.get", {"jobId": job})["data"])["state"] not in ("ready", "failed"): time.sleep(2)
    return j["result"]["assetId"]
def check(label, path, expect):
    got = sha(path); ok = got == expect
    print(f"  {label:8s} sha256 {got[:16]}…  {'matches the original' if ok else 'DIFFERS from original ' + expect[:16] + '…'}")
    return ok

if not a.skip_import:
    print("1. Importing and verifying sources"); print(run("python3", os.path.join(here, "import-sources.py"), proj, a.raw))
env = dict(os.environ); exact = True
m = cfg.get("music")
if m:
    print("2. Music")
    dry = os.path.join(work, f"{m['mode']}-dry.wav"); wav = os.path.join(work, f"{m['mode']}.wav")
    run("python3", os.path.join(here, "synth-music.py"), m["mode"], dry, "--length", m["length"], "--hit-at", m["hit"])
    run("screenrec", "ffmpeg", "-v", "error", "-i", dry, "-af", m["filter"], "-ar", "48000", "-y", wav)
    exact &= check("music", wav, m["expect"]); music = import_file(wav)
if "overlay" in cfg:
    print("3. Caption/graphics overlay + SFX")
    spec = os.path.join(vdir, "notes", "overlay-spec.json")
    with open(spec, "w") as f: f.write(run("python3", os.path.join(vdir, "overlay-spec.py"), os.path.join(vdir, "notes", "words.json")))
    frames = os.path.join(work, "frames"); subprocess.run(["rm", "-rf", frames])
    run("swift", os.path.join(here, "render-overlay.swift"), spec, frames)
    mov = os.path.join(work, "overlay.mov")
    run("screenrec", "ffmpeg", "-v", "error", "-framerate", "24", "-i", os.path.join(frames, "%05d.png"), "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-vendor", "apl0", "-y", mov)
    exact &= check("overlay", mov, cfg["overlay"]["expect"]); env["OVERLAY"] = import_file(mov)
    s32 = os.path.join(work, "sfx-32k.wav"); sfx = os.path.join(work, "sfx.wav")
    run("python3", os.path.join(vdir, "sfx.py"), os.path.join(vdir, "notes", "words.json"), spec, s32, env=dict(os.environ, SFX_SCALE=cfg["sfx"]["scale"]))
    run("screenrec", "ffmpeg", "-v", "error", "-i", s32, "-ar", "48000", "-y", sfx)
    exact &= check("sfx", sfx, cfg["sfx"]["expect"]); env["SFX"] = import_file(sfx)
print("4. Build + export")
# Run logs (requests/receipts) go to the work dir, not the repo.
for d in ("requests", "receipts"): os.makedirs(os.path.join(work, d), exist_ok=True)
args = ["python3", os.path.join(here, "build-export.py"), work, f"repro-{uuid.uuid4().hex[:6]}", os.path.join(vdir, "build.mjs")]
args += [music] if m else ["-"]
out = run(*args, f"{name} (reproduced)", os.path.join(proj, "exports"), cfg["export"], env=env)
print(" ", out.strip()[:160])
print(f"\nDone: {os.path.join(proj, 'exports', cfg['export'])}" + ("" if exact else "\nNote: some generated inputs differ from the originals (see above)."))
