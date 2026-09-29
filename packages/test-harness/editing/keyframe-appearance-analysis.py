"""ICC-aware complete-frame animation diagnostics and neutral review presentation."""
import io
import json
import sys
import shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageCms, ImageDraw

root = Path(sys.argv[1])
review = root / "review"
review.mkdir(exist_ok=True)
srgb = ImageCms.createProfile("sRGB")
profile = ImageCms.ImageCmsProfile(srgb).tobytes()


def display(path):
    source = Image.open(path)
    image = source.convert("RGB")
    if source.info.get("icc_profile"):
        image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(source.info["icc_profile"])), srgb, outputMode="RGB")
    else:
        assert "srgb" in source.info, str(path)
    return image


def measure(left, right):
    delta = np.asarray(left, dtype=np.float64) - np.asarray(right, dtype=np.float64)
    return {"maximumRGB": int(np.abs(delta).max()), "meanRGB": float(np.abs(delta).mean()), "meanSquaredRGB": float((delta * delta).mean()), "originalFourCodePass": bool(np.abs(delta).max() <= 4)}


def decoded(movie, frame):
    return Path(movie["path"]).parent / "decoded" / frame["file"]


measurements = []
controls = []
for cohort_index, name in enumerate(["zoom", "pose", "geometry"], 1):
    evidence = json.loads((root / name / "appearance/report.json").read_text())
    assert evidence["passed"]
    positive, phase, geometry = evidence["cohorts"]
    views = [("A", positive["full"]), ("B", positive["clipped"]), ("C", phase["full"]), ("D", geometry["full"])]
    folder = review / str(cohort_index)
    folder.mkdir(exist_ok=True)
    for label, movie in views:
        target = folder / f"{label}-frames"
        target.mkdir(exist_ok=True)
        for path in (Path(movie["path"]).parent / "decoded").iterdir():
            if path.suffix in (".png", ".icc", ".json"):
                shutil.copy2(path, target / path.name)
        shutil.copy2(movie["path"], folder / f"{label}.mp4")
    # One complete strip per delivered stream includes leading gaps, not only active images.
    sheet = Image.new("RGB", (24 * 40, 4 * 90), "#ddd")
    pen = ImageDraw.Draw(sheet)
    for row, (label, movie) in enumerate(views):
        for i, frame in enumerate(movie["decoded"]["frames"]):
            pen.text((i * 40, row * 90), f"{label}{i}", fill="black")
            sheet.paste(display(decoded(movie, frame)), (i * 40, row * 90 + 20))
    sheet.save(folder / "all-frames.png", icc_profile=profile)
    rows = []
    for reference in evidence["references"]:
        images = [("R", display(reference["path"]))]
        per_label = {}
        for label, movie in views:
            i = next((i for i, f in enumerate(movie["frames"]) if f["sampleAtUs"] == reference["sampleAtUs"]), None)
            if i is None:
                continue
            frame = movie["decoded"]["frames"][i]
            actual = display(decoded(movie, frame))
            images.append((label, actual))
            result = measure(images[0][1], actual)
            measurements.append({"cohort": name, "label": label, "referenceIndex": reference["index"], "sampleAtUs": reference["sampleAtUs"], "pts": frame["pts"], **result})
            per_label[label] = result
        for label, image in images:
            # Explicit-sRGB RGB presentation copies avoid scratch conversion ambiguity.
            image.save(folder / f"{label}-{reference['index']}-display.png", icc_profile=profile)
        # Fixed early/middle/late active samples have visibly changing authored poses.
        if reference["index"] in (2, 4, 6):
            for label in ("C", "D"):
                passed = per_label[label]["meanSquaredRGB"] > per_label["A"]["meanSquaredRGB"]
                controls.append({"cohort": name, "index": reference["index"], "label": label, "positiveMSE": per_label["A"]["meanSquaredRGB"], "negativeMSE": per_label[label]["meanSquaredRGB"], "discriminated": passed})
        rows.append(images)
    for scale, leaf in [(1, "matched-native.png"), (4, "matched-4x.png")]:
        width, height = 40 * scale, 64 * scale
        sheet = Image.new("RGB", (5 * width, 8 * (height + 20)), "#ddd")
        pen = ImageDraw.Draw(sheet)
        for row, images in enumerate(rows):
            for label, image in images:
                column = ["R", "A", "B", "C", "D"].index(label)
                pen.text((column * width, row * (height + 20)), f"{label} {row}", fill="black")
                sheet.paste(image.resize((width, height), Image.Resampling.NEAREST), (column * width, row * (height + 20) + 20))
        sheet.save(folder / leaf, icc_profile=profile)
    for rf, rd in zip(positive["clipped"]["frames"], positive["clipped"]["decoded"]["frames"]):
        i = next(i for i, f in enumerate(positive["full"]["frames"]) if f["sampleAtUs"] == rf["sampleAtUs"])
        measurements.append({"cohort": name, "label": "full-range", "sampleAtUs": rf["sampleAtUs"], **measure(display(decoded(positive["full"], positive["full"]["decoded"]["frames"][i])), display(decoded(positive["clipped"], rd)))})
(root / "appearance-measurements.json").write_text(json.dumps({"normalization": "Explicit sRGB tags or embedded ICC converted to sRGB, no masks", "measurements": measurements, "controls": controls}, indent=2) + "\n")
(review / "brief.txt").write_text("Fresh still-image critique of three frozen animation cohorts, neutral directories1–3. In each, inspect matched-native.png, matched-4x.png and all-frames.png. R is the pre-encode reference at global movie frames16–23 (2.0–2.875 seconds); A–D are encoded variants at matching sample instants, B is a shorter range so some comparisons are absent. Describe trajectory, geometry, small edge/color differences, and distinguish native-size from4x effects without assuming a variant is correct. Every native decoded PNG, actual timestamp receipt and complete movie is included under each directory; optional *-display.png copies explicitly convert into embedded sRGB. The sheets already share this display space. Inspect all occupied thumbnails and inspect any anomaly at full resolution. Do not read parent reports, implementation or measurements. State actual coverage and uncertainty. No whole-slice acceptance, preset decision, listening or motion-playback inference from stills.\n")
(review / "playback.html").write_text('<!doctype html><meta charset="utf-8"><title>Animation media</title><p>Complete media; continuous playback remains unverified.</p>' + ''.join(f'<h2>{case} {label}</h2><video controls loop src="{case}/{label}.mp4"></video>' for case in (1, 2, 3) for label in "ABCD"))
assert all(control["discriminated"] for control in controls), "Wrong-phase/geometry movie is not distinguished from matching output; all diagnostics retained"
print(json.dumps({"comparisons": len(measurements), "negativeControls": len(controls), "decodedFrames": sum(len(list(p.glob("*.png"))) for p in review.glob("*/*-frames"))}))
