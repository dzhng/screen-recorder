# Exact selected original samples and explicit projection; no model invocation.
import array
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import wave
import zlib

root = Path(__file__).resolve().parent
owner_path = root.parents[3] / 'packages/test-harness/speech/feasibility/voxconverse.py'
spec = importlib.util.spec_from_file_location('range_owner', owner_path)
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)
protocol = json.loads((root / 'frozen-protocol.json').read_text())
selection = json.loads((root / 'selection.json').read_text())
cache = Path('/tmp/screenrec-speech-research-cache/starss23')
assert owner.digest((root / 'selection.json').read_bytes()) == protocol['selectionSha256']
assert owner.digest(Path(protocol['sourceClock']['ffmpeg']).read_bytes()) == protocol['sourceClock']['ffmpegSha256']
archive = owner.archive_index(selection['archive']['url'])
assert {key: value for key, value in archive.items() if key != 'entries'} == selection['archive']
receipts = []
for case in selection['cases']:
    print('ACQUIRE', case['role'], case['id'], flush=True)
    member = next(row for row in archive['entries'] if row['name'] == case['member']['name'])
    assert member == case['member']
    source_path = cache / (case['id'] + '-original.wav')
    if source_path.exists():
        original = source_path.read_bytes()
        assert len(original) == member['bytes'] and zlib.crc32(original) == member['crc32']
    else:
        original = owner.member_bytes(archive, member)
        owner.retain(source_path, original)
    with wave.open(io.BytesIO(original), 'rb') as source:
        assert (source.getframerate(), source.getnchannels(), source.getsampwidth(), source.getcomptype()) == (24000, 4, 2, 'NONE')
        original_frames = source.getnframes()
        assert case['sourceStartFrame'] + case['sourceFrames'] <= original_frames
        source.setpos(case['sourceStartFrame'])
        pcm4 = source.readframes(case['sourceFrames'])
    assert len(pcm4) == case['sourceFrames'] * 8
    samples = array.array('h', pcm4)
    if sys.byteorder != 'little':
        samples.byteswap()
    channel = samples[case['channelIndex']::4]
    pcm = array.array('h', channel)
    floats = array.array('f', (value / 32768 for value in channel))
    if sys.byteorder != 'little':
        pcm.byteswap()
        floats.byteswap()
    wave_bytes = io.BytesIO()
    with wave.open(wave_bytes, 'wb') as projected:
        projected.setnchannels(1)
        projected.setsampwidth(2)
        projected.setframerate(24000)
        projected.writeframes(pcm.tobytes())
    original_window = cache / (case['id'] + '-24k.wav')
    direct_float = cache / (case['id'] + '-24k.f32')
    converted = cache / (case['id'] + '.f32')
    owner.retain(original_window, wave_bytes.getvalue())
    owner.retain(direct_float, floats.tobytes())
    assert not converted.exists(), 'Fresh conversion output required'
    command = [protocol['sourceClock']['ffmpeg'], '-nostdin', '-hide_banner', '-loglevel', 'error', '-n', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', str(direct_float), '-af', 'aresample=16000:resampler=swr:filter_size=32:phase_shift=10:exact_rational=1:async=0:first_pts=0', '-f', 'f32le', str(converted)]
    run = subprocess.run(command, capture_output=True, timeout=30)
    assert run.returncode == 0, run.stderr.decode(errors='replace')
    assert converted.stat().st_size == 320000 * 4
    # Independent scalar check of original interleaved bytes, not float preparation.
    import struct
    for frame in range(case['sourceFrames']):
        assert struct.unpack_from('<h', pcm4, frame * 8)[0] == channel[frame]
    labels = (root / 'labels' / (case['id'] + '.csv')).read_bytes()
    assert owner.digest(labels) == case['metadataMemberSha256']
    original_occupancy = {name: set() for name in protocol['categories']}
    for line in labels.decode().splitlines():
        row = list(map(int, line.split(',')))
        if case['startBin'] <= row[0] < case['startBin'] + case['bins']:
            for name, definition in protocol['categories'].items():
                if row[1] == definition['referenceClassIndex']:
                    original_occupancy[name].add(row[0] - case['startBin'])
    assert {name: sorted(bins) for name, bins in original_occupancy.items()} == case['referenceOccupancy']
    receipts.append({'id': case['id'], 'role': case['role'], 'originalSha256': owner.digest(original), 'originalFrames': original_frames, 'member': member, 'sourceStartFrame': case['sourceStartFrame'], 'sourceFrames': case['sourceFrames'], 'sampleRate': 24000, 'channels': 4, 'channelIndex': 0, 'windowInterleavedSha256': owner.digest(pcm4), 'windowChannelPCM16Sha256': owner.digest(pcm.tobytes()), 'projectedWave': str(original_window), 'projectedWaveSha256': owner.digest(wave_bytes.getvalue()), 'directFloatSha256': owner.digest(floats.tobytes()), 'prepared': str(converted), 'preparedSha256': owner.digest(converted.read_bytes()), 'preparedFrames': 320000, 'preparedSampleRate': 16000, 'command': command, 'exitCode': run.returncode, 'stderr': run.stderr.decode(errors='replace'), 'labelAuthorityAndIntegerClockReconstructed': True})
report = {'protocolSha256': owner.digest((root / 'frozen-protocol.json').read_bytes()), 'selectionSha256': protocol['selectionSha256'], 'archive': selection['archive'], 'cases': receipts, 'scope': 'Original source/projection/resampling/complete label admission only; no inference or audible-quality claim'}
owner.retain(root / 'input-admission.json', (json.dumps(report, indent=2) + '\n').encode())
