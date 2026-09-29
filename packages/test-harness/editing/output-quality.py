"""Measure the named PNG/FFmpeg-RGB paths without masking text or edges."""
import io
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageCms

root = Path(sys.argv[1])
report = json.loads((root / 'report.json').read_text())
assert report['passed']
srgb = ImageCms.createProfile('sRGB')
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def rgb(path):
    image = Image.open(path)
    assert image.size == (1920, 1080), (path, image.size)
    profile = image.info.get('icc_profile')
    result = image.convert('RGB')
    if profile:
        result = ImageCms.profileToProfile(result, ImageCms.ImageCmsProfile(io.BytesIO(profile)), srgb, outputMode='RGB')
    return np.array(result, dtype=np.int16)

decoder = sys.argv[2] if len(sys.argv) > 2 else 'ffmpeg'
assert decoder in ('ffmpeg', 'apple')
measurements = []
for variant in report['variants']:
    assert sha(root / f"{variant['preset']}.mp4") == variant['sha256']
    frames = []
    for ordinal, reference in enumerate(report['references'], 1):
        assert sha(root / f"reference-{reference['index']}.png") == reference["sha256"]
        before = rgb(root / f"reference-{reference['index']}.png")
        if decoder == 'ffmpeg':
            after = rgb(root / f"{variant['preset']}-{ordinal:02d}.png")
        else:
            directory = root / f"{variant['preset']}-apple"
            metadata = json.loads((directory / 'frames.json').read_text())
            assert metadata['movieSHA256'] == variant['sha256']
            entry = next(x for x in metadata['frames'] if x['index'] == reference['index'])
            assert sha(directory / f"frame-{reference['index']}.bgra") == entry['bgraSHA256']
            assert sha(directory / f"frame-{reference['index']}.icc") == entry['iccSHA256']
            assert entry['ptsValue'] * 1000000 == reference['atUs'] * entry['ptsTimescale']
            assert (entry['width'], entry['height']) == (1920, 1080)
            image = Image.frombytes('RGBA', (1920, 1080), (directory / f"frame-{reference['index']}.bgra").read_bytes(), 'raw', 'BGRA').convert('RGB')
            profile = ImageCms.ImageCmsProfile(str(directory / f"frame-{reference['index']}.icc"))
            image = ImageCms.profileToProfile(image, profile, srgb, outputMode='RGB')
            image.save(directory / f"frame-{reference['index']}.png")
            after = np.array(image, dtype=np.int16)
        error = np.abs(before - after)
        frames.append({'index': reference['index'], 'meanRGB': float(error.mean()),
                       'rmsRGB': float(np.sqrt(np.mean(error.astype(np.float64) ** 2))),
                       'maxRGB': int(error.max()), 'shareAbove4': float((error > 4).mean())})
    measurements.append({'preset': variant['preset'], 'bytes': variant['bytes'], 'frames': frames})
result = {'decoder': decoder + '; embedded ICC converted to sRGB',
          'wholeImageNoMask': True, 'presetPromoted': False, 'measurements': measurements}
(root / f'measurements-{decoder}.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
