"""Fixture-specific payload extraction; this is not a general MOV decoder.

The frozen input has only mono float32 little-endian PCM. Every mdat byte is
sample data, as checked against the real append journal's physical frame count.
A zero-size final mdat extends to EOF, including bytes beyond admitted duration.
"""
import json
import struct
import sys
from pathlib import Path

root, out = map(Path, sys.argv[1:])
rows = [json.loads(line) for line in (root / 'screen/capture.journal.jsonl').read_text().splitlines()]
track = next(row['data'] for row in rows if row['event'] == 'pcmTrack')
assert (track['channels'], track['rate'], track['format']) == (1, 48000, 'pcm-f32le-interleaved')
appends = [row['data'] for row in rows if row['event'] == 'pcmAppend']
frames = 0
for row in appends:
    assert int(row['physicalFirstFrame']) == frames
    assert int(row['declaredFirstFrame']) == frames
    frames += int(row['frameCount'])
source = root / 'screen/narration.packed.mov'
size = source.stat().st_size
written = 0
with source.open('rb') as incoming, (out / 'microphone-packed.f32').open('wb') as pcm:
    while incoming.tell() < size:
        start = incoming.tell()
        length, kind = struct.unpack('>I4s', incoming.read(8))
        header = 8
        if length == 1:
            length = struct.unpack('>Q', incoming.read(8))[0]
            header = 16
        if length == 0:
            length = size - start
        assert length >= header and start + length <= size
        if kind == b'mdat':
            remaining = length - header
            while remaining:
                chunk = incoming.read(min(remaining, 65536))
                assert chunk
                pcm.write(chunk)
                remaining -= len(chunk)
                written += len(chunk)
        else:
            incoming.seek(start + length)
assert written == frames * 4
print(json.dumps({'physicalFrames': frames, 'payloadBytes': written, 'physicalSeconds': frames / 48000}))
