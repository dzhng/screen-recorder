# Acquisition research only. No provider invocation, playback or product state.
import array
import hashlib
import io
import json
import math
from pathlib import Path
import re
import struct
import sys
import wave
import zlib

import urllib.request


def fetch_range(url, start, end, total, etag):
    request = urllib.request.Request(url, headers={'Range': f'bytes={start}-{end}'})
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{total}':
            raise ValueError('Content-Range differs from requested original archive bytes')
        if response.headers.get('ETag') != etag:
            raise ValueError('Original archive ETag changed during acquisition')
        body = response.read(end - start + 2)
        if len(body) != end - start + 1:
            raise ValueError('Original archive range body length differs')
        return body


def archive_index(url):
    with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30) as reply:
        total = int(reply.headers['Content-Length'])
        etag = reply.headers['ETag']
    tail = fetch_range(url, total - min(total, 65557), total - 1, total, etag)
    position = tail.rfind(b'PK\x05\x06')
    fields = struct.unpack_from('<4s4H2IH', tail, position)
    _, disk, directory_disk, disk_count, count, size, offset, comment = fields
    if disk or directory_disk or disk_count != count or not 0 < count < 1000 or size > 4 * 1024**2:
        raise ValueError('Unsupported or unbounded original ZIP directory')
    if position + 22 + comment != len(tail):
        raise ValueError('Original ZIP trailer differs')
    directory = fetch_range(url, offset, offset + size - 1, total, etag)
    cursor = 0
    entries = []
    for _ in range(count):
        row = struct.unpack_from('<4s6H3I5H2I', directory, cursor)
        if row[0] != b'PK\x01\x02' or row[3] & 1 or row[13] != 0:
            raise ValueError('Unsupported original ZIP entry')
        name_bytes = directory[cursor + 46:cursor + 46 + row[10]]
        name = name_bytes.decode('utf8' if row[3] & 2048 else 'cp437')
        entries.append({'name': name, 'method': row[4], 'crc32': row[7], 'compressedBytes': row[8], 'bytes': row[9], 'offset': row[16]})
        cursor += 46 + row[10] + row[11] + row[12]
    if cursor != len(directory):
        raise ValueError('Original ZIP directory membership differs')
    return {'url': url, 'totalBytes': total, 'etag': etag, 'directorySha256': digest(directory), 'entries': entries}


def member_bytes(archive, member):
    if member['method'] not in [0, 8] or not 0 < member['bytes'] <= 32 * 1024**2 or member['compressedBytes'] > 32 * 1024**2:
        raise ValueError('Selected source member exceeds bounded acquisition')
    offset = member['offset']
    header = fetch_range(archive['url'], offset, offset + 29, archive['totalBytes'], archive['etag'])
    fields = struct.unpack('<4s5H3I2H', header)
    if fields[0] != b'PK\x03\x04' or fields[3] != member['method'] or fields[2] & 1:
        raise ValueError('Selected source local header differs')
    start = offset + 30 + fields[9] + fields[10]
    compressed = fetch_range(archive['url'], start, start + member['compressedBytes'] - 1, archive['totalBytes'], archive['etag'])
    if member['method'] == 0:
        original = compressed
    else:
        decoder = zlib.decompressobj(-15)
        original = decoder.decompress(compressed, member['bytes'] + 1)
        if not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
            raise ValueError('Selected source compressed closure differs')
    if len(original) != member['bytes'] or zlib.crc32(original) != member['crc32']:
        raise ValueError('Selected source size/CRC differs')
    return original


def digest(value):
    return hashlib.sha256(value).hexdigest()


def retain(path, value):
    if path.exists():
        if path.read_bytes() != value:
            raise ValueError('Retained source differs: ' + str(path))
    else:
        with path.open('xb') as output:
            output.write(value)


def prepare(selection_path, cache, output):
    selection = json.loads(selection_path.read_text())
    cases = selection['cases']
    if len(cases) != 6 or any(not re.fullmatch('[a-z]{5}', row['id']) for row in cases):
        raise ValueError('Expected the frozen six source selections')
    cache.mkdir(parents=True, exist_ok=True)
    archives = {}
    receipts = []
    for case in cases:
        split = case['split']
        if split not in archives:
            archives[split] = archive_index('https://www.robots.ox.ac.uk/~vgg/data/voxconverse/data/voxconverse_' + split + '_wav.zip')
        archive = archives[split]
        matches = [row for row in archive['entries'] if Path(row['name']).name == case['id'] + '.wav']
        if len(matches) != 1:
            raise ValueError('Source member is not uniquely bound')
        member = matches[0]
        source_path = cache / (case['id'] + '-original.wav')
        if source_path.exists():
            original = source_path.read_bytes()
            if len(original) != member['bytes'] or zlib.crc32(original) != member['crc32']:
                raise ValueError('Cached original source differs')
        else:
            original = member_bytes(archive, member)
            retain(source_path, original)
        with wave.open(io.BytesIO(original), 'rb') as source:
            rate, channels, width, count = source.getframerate(), source.getnchannels(), source.getsampwidth(), source.getnframes()
            if (rate, channels, width, source.getcomptype()) != (16000, 1, 2, 'NONE'):
                raise ValueError('Original source is not exact mono16k PCM16')
            start = case['startSeconds'] * rate
            frames = case['durationSeconds'] * rate
            if not isinstance(start, int) or not isinstance(frames, int) or start + frames > count:
                raise ValueError('Selected source clock is outside original frames')
            source.setpos(start)
            pcm = source.readframes(frames)
        if len(pcm) != frames * 2:
            raise ValueError('Selected source PCM is truncated')
        samples = array.array('h', pcm)
        if sys.byteorder != 'little':
            samples.byteswap()
        floats = array.array('f', (value / 32768 for value in samples))
        if sys.byteorder != 'little':
            floats.byteswap()
        encoded = io.BytesIO()
        with wave.open(encoded, 'wb') as window:
            window.setnchannels(1)
            window.setsampwidth(2)
            window.setframerate(rate)
            window.writeframes(pcm)
        wav_path, float_path = cache / (case['id'] + '.wav'), cache / (case['id'] + '.f32')
        retain(wav_path, encoded.getvalue())
        retain(float_path, floats.tobytes())
        receipts.append({'id': case['id'], 'role': case['role'], 'split': split, 'archive': {k: v for k, v in archive.items() if k != 'entries'}, 'member': member, 'sourceSha256': digest(original), 'originalFrames': count, 'sampleRate': rate, 'channels': channels, 'sampleWidthBytes': width, 'sourceStartFrame': start, 'frames': frames, 'durationSeconds': frames / rate, 'pcmSha256': digest(pcm), 'windowSha256': digest(encoded.getvalue()), 'preparedFloatSha256': digest(floats.tobytes()), 'conversion': 'exact PCM16 /32768 to Float32, no resampling/channel mixture/time shift', 'peakAbsolutePCM16': max(abs(value) for value in samples), 'rmsPCM16': math.sqrt(sum(value * value for value in samples) / frames), 'wav': str(wav_path), 'prepared': str(float_path)})
        print('AUDITED', case['role'], case['id'], frames, flush=True)
    report = {'selectionSha256': digest(selection_path.read_bytes()), 'scope': 'Bounded original ZIP member extraction, size/CRC/hash, RIFF/sampleclock and exact selected PCM conversion; no inference/quality acceptance', 'cases': receipts}
    retain(output, (json.dumps(report, indent=2) + '\n').encode())


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('Usage: python voxconverse.py FROZEN_SELECTION_JSON SHARED_CACHE NEW_AUDIT_JSON')
    prepare(*(Path(value) for value in sys.argv[1:]))
