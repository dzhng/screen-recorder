"""Verify retained evidence; optionally restore exact original oracle files or the WAV.

This is lossless artifact extraction, not a fresh independent DSP comparison.
"""
from array import array
import argparse
import hashlib
import io
import json
import lzma
from pathlib import Path
import tarfile

if not __debug__:
    raise RuntimeError('Evidence verification requires Python assertions; omit -O/PYTHONOPTIMIZE')

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--oracles', type=Path, help='new directory for four restored original files')
parser.add_argument('--wav', type=Path, help='new file for the complete delivered WAV')
args = parser.parse_args()
root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while b := f.read(1024 * 1024):
            h.update(b)
    return h.hexdigest()


for item in manifest['stored']:
    path = root / item['path']
    assert path.stat().st_size == item['bytes'], item['path']
    assert digest(path) == item['sha256'], item['path']
with tarfile.open(root / 'metadata.tar.xz') as archive:
    members = {m['path']: archive.extractfile(m['path']).read() for m in manifest['metadata']}
for item in manifest['metadata']:
    assert len(members[item['path']]) == item['bytes']
    assert hashlib.sha256(members[item['path']]).hexdigest() == item['sha256']
original = json.loads(members['original-hashes.json'])
if args.oracles:
    args.oracles.mkdir()


class Volumes(io.RawIOBase):
    def __init__(self):
        self.paths = iter(manifest['wav']['volumes'])
        self.current = None

    def read(self, size=-1):
        assert size >= 0
        while True:
            if self.current is None:
                path = next(self.paths, None)
                if path is None:
                    return b''
                self.current = (root / path).open('rb')
            chunk = self.current.read(size)
            if chunk:
                return chunk
            self.current.close()
            self.current = None

    def close(self):
        if self.current:
            self.current.close()
        super().close()


for channel in range(2):
    name = f'reference-{channel}-input.f32'
    period = members[f'input-{channel}-period.f32']
    h = hashlib.sha256()
    output = (args.oracles / name).open('xb') if args.oracles else None
    try:
        for _ in range(10000):
            h.update(period)
            if output:
                output.write(period)
    finally:
        if output:
            output.close()
    assert len(period) * 10000 == original[name]['bytes']
    assert h.hexdigest() == original[name]['sha256'], name

hashes = [hashlib.sha256(members[f'output-{c}-prefix.f32']) for c in range(2)]
outputs = [(args.oracles / f'reference-{c}-raw.f32').open('xb') if args.oracles else None for c in range(2)]
wav = args.wav.open('xb') if args.wav else None
full_hash = hashlib.sha256()
full_bytes = 0
try:
    for c, output in enumerate(outputs):
        if output:
            output.write(members[f'output-{c}-prefix.f32'])
    with Volumes() as volumes, lzma.LZMAFile(volumes) as decoded:
        header = decoded.read(4096)
        assert header[:4] == b'RIFF' and header[-8:-4] == b'data'
        assert int.from_bytes(header[-4:], 'little') == 345600000 * 8
        full_hash.update(header)
        full_bytes += len(header)
        if wav:
            wav.write(header)
        while chunk := decoded.read(8 * 1024 * 1024):
            assert len(chunk) % 8 == 0
            full_hash.update(chunk)
            full_bytes += len(chunk)
            if wav:
                wav.write(chunk)
            words = array('I')
            words.frombytes(chunk)
            assert words.itemsize == 4
            for c, output in enumerate(outputs):
                lane = words[c::2].tobytes()  # Preserve four-byte words; no float conversion.
                hashes[c].update(lane)
                if output:
                    output.write(lane)
finally:
    if wav:
        wav.close()
    for output in outputs:
        if output:
            output.close()
assert full_bytes == original['prepared.wav']['bytes']
assert full_hash.hexdigest() == original['prepared.wav']['sha256']
for c in range(2):
    name = f'reference-{c}-raw.f32'
    assert 3840 + (full_bytes - 4096) // 2 == original[name]['bytes']
    assert hashes[c].hexdigest() == original[name]['sha256'], name
if args.oracles:
    for path in args.oracles.iterdir():
        assert path.stat().st_size == original[path.name]['bytes']
        assert digest(path) == original[path.name]['sha256'], path.name
print(json.dumps({'passed': True, 'wavBytes': full_bytes, 'wavSha256': full_hash.hexdigest(),
                  'restoredOracleFiles': 4 if args.oracles else 0,
                  'scope': 'Retained evidence integrity; no new DSP oracle comparison'}))
