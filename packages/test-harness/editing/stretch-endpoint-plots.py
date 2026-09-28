"""Hash-checked scientific endpoint plots; uv --with matplotlib==3.10.8 --with numpy==2.3.5."""
import hashlib
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

source = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=False)
evidence = json.loads(source.read_text())
trusted = {}
for row in evidence["loaded"]:
    assert row["path"] not in trusted or trusted[row["path"]] == row["sha256"], "Conflicting PCM identities"
    trusted[row["path"]] = row["sha256"]
loaded = {}

def pcm(path):
    if path not in loaded:
        data = Path(path).read_bytes()
        assert hashlib.sha256(data).hexdigest() == trusted[path], path
        samples = np.frombuffer(data, dtype="<f4")
        assert np.isfinite(samples).all(), path
        loaded[path] = samples
    return loaded[path]

# Validate the complete set before drawing any frame, including sources not plotted.
for path in trusted:
    pcm(path)

# Each envelope retains the maximum absolute sample in each bin, so sparse impulses
# cannot disappear through point decimation. Log floor is visible below threshold.
def envelope(ax, samples, offset, origin, label, color, window=None):
    x = (np.arange(len(samples)) - offset - origin) / 48
    keep = np.ones(len(x), dtype=bool) if window is None else (x >= window[0]) & (x <= window[1])
    x, y = x[keep], np.abs(samples[keep])
    if len(x) > 1400:
        bins = np.array_split(np.arange(len(x)), 1400)
        x = np.array([x[b[len(b)//2]] for b in bins])
        y = np.array([y[b].max() for b in bins])
    ax.plot(x, np.maximum(y, 1e-9), color=color, linewidth=.8, label=label, linestyle="--" if label == "tail" else "-")

paths = []
for phase in sorted({r["phase"] for r in evidence["endpoints"]}):
    fig, axes = plt.subplots(4, 4, figsize=(19, 12), constrained_layout=True)
    for i, speed in enumerate([.8, .9, 1, 1.25]):
        for side_index, side in enumerate(["leading", "trailing"]):
            row = next(r for r in evidence["endpoints"] if r["phase"] == phase and r["speed"] == speed and r["side"] == side)
            origin = 0 if side == "leading" else row["wanted"]
            for zoom in range(2):
                ax = axes[i, side_index*2+zoom]
                window = (-100, 100) if zoom else None
                for mode, color in [("tail", "#dd7722"), ("exact", "#2154ad")]:
                    support = row[mode+"Support"]
                    offset = -support["scannedRange"]["startFrame"]
                    envelope(ax, pcm(row[mode]), offset, origin, mode, color, window)
                ax.axhline(1e-7, color="gray", linestyle=":", linewidth=.7)
                ax.axvline(0, color="black", linewidth=.6, zorder=0)
                ax.set_yscale("log"); ax.set_ylim(1e-9, 2)
                if zoom: ax.set_xlim(-100, 100)
                else: ax.set_xlim((-2880-origin)/48, (row["wanted"]+2880-origin)/48)
                support = row["exactSupport"]
                ax.set_title(f'{speed}× {side} — {"±100 ms" if zoom else "entire admitted output"}\nexact support [{support["firstAboveThreshold"]}, {support["lastAboveThreshold"]}] frames', fontsize=9)
                ax.set_xlabel("ms relative to output boundary", fontsize=8)
                ax.set_ylabel("absolute peak envelope", fontsize=8)
                ax.tick_params(labelsize=7)
    axes[0,0].legend(fontsize=8)
    fig.suptitle(f"Isolated impulses, phase {phase} source frames — threshold 1e−7; shared amplitude scale\nTail is a separate diagnostic recipe, shifted by its 2880-frame latency; each trace stops at its own file boundary; no padding.", fontsize=12)
    path = out/f"endpoint-phase-{phase}.png"; fig.savefig(path,dpi=135); plt.close(fig); paths.append(path)

rows = [("Source 440 Hz", evidence["tones"][0]["input"])] + [(f'Exact {r["speed"]}×',r["exact"]) for r in evidence["tones"]]
amplitude_limit = max(float(np.abs(pcm(path)).max()) for _, path in rows) * 1.08
fig, axes = plt.subplots(5,2,figsize=(12,13), constrained_layout=True)
for (label,path),(wave,spectrum) in zip(rows,axes):
    samples = pcm(path)
    wave.plot(np.arange(len(samples))/48000,samples,linewidth=.35)
    wave.set_ylim(-amplitude_limit,amplitude_limit); wave.set_xlim(0,3.85); wave.set_title(label); wave.set_xlabel("seconds"); wave.set_ylabel("amplitude")
    # Identical center-window count and Hann normalization avoid duration-dependent scales.
    count=65536; start=(len(samples)-count)//2; window=np.hanning(count)
    magnitude=np.abs(np.fft.rfft(samples[start:start+count]*window))*2/window.sum()
    spectrum.plot(np.fft.rfftfreq(count,1/48000),20*np.log10(np.maximum(magnitude,1e-9)),linewidth=.8)
    spectrum.axvline(440,color="gray",linestyle=":"); spectrum.set_xlim(300,600); spectrum.set_ylim(-100,0)
    spectrum.set_xlabel("Hz"); spectrum.set_ylabel("dBFS amplitude"); spectrum.set_title("Same 65536-sample center window / Hann / amplitude scale")
fig.suptitle("Frozen tone: full waveform and shared-scale frequency evidence (no per-panel normalization)")
path=out/"tone-shared-scale.png"; fig.savefig(path,dpi=135); plt.close(fig); paths.append(path)
# Optional real-speech join panels keep source and output on one signed amplitude scale.
if len(sys.argv) == 4:
    join_report_path = Path(sys.argv[3])
    joins = json.loads(join_report_path.read_text())
    sources = {}
    for row in joins["sources"]:
        data = (join_report_path.parent / (row["id"] + "-source.f32")).read_bytes()
        assert hashlib.sha256(data).hexdigest() == row["pcmSha256"]
        sources[row["id"]] = np.frombuffer(data, dtype="<f4")
    for selection in joins["selections"]:
        start, end = selection["frames"]
        source_pcm = sources[selection["source"]]
        first, last = max(0, start-12000), min(len(source_pcm), end+12000)
        rows = [("Reference", source_pcm[first:last], [start-first, end-first])]
        for row in joins["results"]:
            if row["id"] != selection["id"]:
                continue
            data = Path(row["file"]).read_bytes()
            assert hashlib.sha256(data).hexdigest() == row["wavSha256"]
            assert data[:4] == b"RIFF" and data[36:40] == b"data"
            samples = np.frombuffer(data[44:], dtype="<f4")
            assert hashlib.sha256(data[44:]).hexdigest() == row["contextSha256"]
            rows.append((str(row["speed"])+"×", samples, row["joins"]))
        amplitude_limit = max(float(np.abs(samples[max(0,b-4800):min(len(samples),b+4801)]).max()) for _, samples, boundaries in rows for b in boundaries)*1.08
        fig, axes = plt.subplots(len(rows), 2, figsize=(12, 10), constrained_layout=True)
        for (label, samples, boundaries), axes_row in zip(rows, axes):
            for side, boundary, ax in zip(["leading", "trailing"], boundaries, axes_row):
                indices = np.arange(max(0,boundary-4800), min(len(samples),boundary+4801))
                ax.plot((indices-boundary)/48, samples[indices], linewidth=.5)
                ax.axvline(0,color="gray",linewidth=.5,linestyle=":",zorder=0)
                ax.set_xlim(-100,100); ax.set_ylim(-amplitude_limit,amplitude_limit)
                ax.set_title(label+" / "+side); ax.set_xlabel("ms relative to selection boundary"); ax.set_ylabel("amplitude")
        description = "Whole-file boundaries, no external neighbors or word times" if selection["source"] == "clean" else "Outer phrase marks + explicitly selected 25ms guards; no complete word-span labels"
        fig.suptitle(selection["id"]+" — shared amplitude scale within this sheet\n"+description+". Listening UNVERIFIED.")
        path=out/(selection["id"]+"-joins.png"); fig.savefig(path,dpi=135); plt.close(fig); paths.append(path)
manifest={"evidenceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),"plotterSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"matplotlib":matplotlib.__version__,"numpy":np.__version__,"verifiedPCM":len(loaded),"joinReportSha256":hashlib.sha256(Path(sys.argv[3]).read_bytes()).hexdigest() if len(sys.argv)==4 else None,"plots":[{"path":p.name,"sha256":hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]}
(out/"plots.json").write_text(json.dumps(manifest,indent=2)+"\n")
print(json.dumps(manifest))
