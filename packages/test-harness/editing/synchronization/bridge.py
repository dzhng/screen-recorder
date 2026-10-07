"""Read-only mixed-reference bridge research; candidates never declare angle clocks."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import time

import numpy as np
from scipy.signal import resample_poly
from scipy.io import wavfile

spec = importlib.util.spec_from_file_location('offset', Path(__file__).with_name('offset.py'))
offset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offset)

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def save(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')

def acquire(args, protocol):
    report = {'protocolSha256': digest(args.protocol), 'nativeSha256': digest(args.native), 'sources': {}}
    for key, source in protocol['sources'].items():
        path = args.originals / source['file']
        if digest(path) != source['sha256']:
            raise ValueError('Original source hash changed: ' + key)
        print(key + ': full original hash verified', flush=True)
        native_output = args.output / (key + '-native.wav')
        output = args.output / (key + '.f32')
        start, end = source['rangeSeconds']
        request = {'id': key, 'operation': 'media.sourceAudio', 'params': {
            'source': {'source': str(path), 'streamId': 'track:2', 'sourceOffsetUs': 0,
                'available': [{'startUs': start * 1000000, 'endUs': end * 1000000}]},
            'range': {'startUs': start * 1000000, 'endUs': end * 1000000},
            'output': str(native_output)}}
        before = time.monotonic()
        request_path, response_path = args.output / (key + '-request.json'), args.output / (key + '-response.json')
        save(request_path, request)
        result = subprocess.run(['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network*)', str(args.native)],
            input=json.dumps(request) + '\n', capture_output=True, text=True, timeout=protocol['budget']['secondsPerDecode'])
        response_path.write_text(result.stdout)
        (args.output / (key + '.stderr.log')).write_text(result.stderr)
        response = json.loads(result.stdout)
        if result.returncode:
            raise RuntimeError(str(response))
        if not response.get('ok'): raise RuntimeError(str(response))
        receipt = response['data']
        channels = 2 if key == 'main' else 1
        if (receipt['sampleRate'], receipt['frames'], receipt['channels']) != (44100, (end - start) * 44100, channels):
            raise ValueError('Incomplete native selected source-rate PCM')
        if receipt['bytes'] > protocol['budget']['maximumTemporaryNativeWAVBytes'] or native_output.stat().st_size != receipt['bytes']:
            raise ValueError('Native source-rate PCM work envelope changed')
        native_hash = digest(native_output)
        rate, samples = wavfile.read(native_output, mmap=True)
        if rate != 44100 or samples.dtype != np.dtype('<f4'):
            raise ValueError('Native acquisition must retain Float32 source-rate operands')
        channel = samples[:, 0] if channels == 2 else samples
        converted = resample_poly(channel, 160, 441)
        if len(converted) != (end - start) * 16000 or not np.isfinite(converted).all():
            raise ValueError('Source-rate conversion changed complete selected sample support')
        converted.astype('<f4').tofile(output)
        pcm = {'sampleRate': 16000, 'frames': len(converted), 'bytes': output.stat().st_size,
            'sha256': digest(output), 'channels': 1}
        report['sources'][key] = {'source': source, 'originUs': start * 1000000,
            'path': output.name, 'nativeWavSha256': native_hash, 'nativeReceipt': receipt, 'receipt': pcm, 'elapsedSeconds': time.monotonic() - before}
        del samples, channel, converted
        native_output.unlink()
        save(args.output / 'acquisition.json', report)
        print(key + ': complete bounded PCM retained', flush=True)

def scout(args, protocol):
    acquisition = json.loads((args.acquisition / 'acquisition.json').read_text())
    if acquisition['protocolSha256'] != digest(args.protocol) or set(acquisition['sources']) != set(protocol['sources']):
        raise ValueError('Use complete acquisition from this frozen bridge protocol')
    arrays = {}
    for key, entry in acquisition['sources'].items():
        path = args.acquisition / entry['path']
        if digest(path) != entry['receipt']['sha256'] or path.stat().st_size != entry['receipt']['bytes']:
            raise ValueError('Complete acquisition identity changed: ' + key)
        arrays[key] = np.memmap(path, dtype='<f4', mode='r')
    master = resample_poly(arrays['main'], 1, 16)
    report = {'protocolSha256': digest(args.protocol), 'acquisitionSha256': digest(args.acquisition / 'acquisition.json'),
        'nativeSha256': acquisition['nativeSha256'], 'windows': [], 'globals': [],
        'scope': 'local acoustic candidates only; lexical admission still required; no clock declaration'}
    for key in [key for key in protocol['sources'] if key != 'main']:
        coarse = resample_poly(arrays[key], 1, 16)
        squares = np.concatenate(([0.], np.cumsum(coarse.astype(np.float64) ** 2)))
        for third in range(3):
            starts = np.arange(third * 780, (third + 1) * 780 - 20 + 1)
            energy = np.stack([(squares[(starts + center + 2) * 1000] - squares[(starts + center - 2) * 1000]) / 4000
                for center in offset.POLICY['centersSeconds']])
            selected = int(starts[int(np.argmax(energy.min(axis=0)))])
            left = arrays[key][selected * 16000:(selected + 20) * 16000]
            name = key + '-' + str(selected)
            raw_path = args.output / (name + '.wav')
            wavfile.write(raw_path, 16000, np.asarray(left))
            candidates = offset.peaks(coarse[(selected + 8) * 1000:(selected + 12) * 1000], master, 1000, -8000)
            row = {'name': name, 'source': key, 'sourceOriginUs': selected * 1000000,
                'raw': {'path': raw_path.name, 'sha256': digest(raw_path), 'pcmSha256': hashlib.sha256(left.tobytes()).hexdigest()},
                'selection': {'third': third, 'minimumAnchorMeanSquare': float(energy[:, int(np.argmax(energy.min(axis=0)))].min())},
                'candidates': candidates, 'state': 'refused', 'reason': 'insufficient-or-ambiguous-coarse-waveform'}
            ratio = candidates[1]['absoluteCorrelation'] / candidates[0]['absoluteCorrelation'] if len(candidates) > 1 else None
            row['alternativeRatio'] = ratio
            if candidates and candidates[0]['absoluteCorrelation'] >= offset.POLICY['minimumCorrelation'] and (ratio is None or ratio <= offset.POLICY['maximumAlternativeRatio']):
                master_start = candidates[0]['offsetFrames']
                if 0 <= master_start and master_start + 20000 <= len(master):
                    right = arrays['main'][master_start * 16:(master_start + 20000) * 16]
                    master_path = args.output / (name + '-reference.wav')
                    wavfile.write(master_path, 16000, np.asarray(right))
                    refined = offset.estimate(left, right, 16000)
                    row.update({'referenceOriginUs': master_start * 1000,
                        'reference': {'path': master_path.name, 'sha256': digest(master_path), 'pcmSha256': hashlib.sha256(right.tobytes()).hexdigest()},
                        'refined': refined, 'reason': refined['reason']})
                    if refined['state'] == 'constant-offset':
                        row.update({'state': 'acoustic-candidate', 'reason': 'independent-lexical-admission-required',
                            'referenceMinusSourceSamples16k': master_start * 16 - selected * 16000 + refined['offsetFrames']})
                else:
                    row['reason'] = 'incomplete-reference-support'
            report['windows'].append(row)
            save(args.output / 'scout.json', report)
            print(name + ': ' + row['state'] + ' (' + row['reason'] + ')', flush=True)
        admitted = [row for row in report['windows'] if row['source'] == key and row['state'] == 'acoustic-candidate']
        spread = max(row['referenceMinusSourceSamples16k'] for row in admitted) - min(row['referenceMinusSourceSamples16k'] for row in admitted) if len(admitted) == 3 else None
        report['globals'].append({'source': key, 'admittedCheckpoints': len(admitted), 'spreadSamples16k': spread,
            'state': 'unverified-lexical-prerequisite' if spread is not None and spread <= 32 else 'refused-global-clock'})
    save(args.output / 'scout.json', report)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('mode', choices=['acquire', 'scout'])
parser.add_argument('--protocol', type=Path, default=Path(__file__).parents[4] / 'specs/done/video-editing-feedback/assets/20-synchronization/bridge/protocol.json')
parser.add_argument('--native', type=Path)
parser.add_argument('--originals', type=Path)
parser.add_argument('--acquisition', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
protocol = json.loads(args.protocol.read_text())
sources = protocol['sources']
if set(sources) != {'main', 'grahamRaw', 'madisonRaw', 'lilyRawP1'} or len(sources) > protocol['budget']['maximumNativeDecodes']:
    parser.error('Frozen bridge acquisition requires exactly four identified sources')
if any(entry['rangeSeconds'] != [0, 1960 if key == 'main' else 2340] for key, entry in sources.items()):
    parser.error('Frozen bridge source ranges changed')
frames = sum((entry['rangeSeconds'][1] - entry['rangeSeconds'][0]) * 16000 for entry in sources.values())
if frames > protocol['budget']['maximumSelectedPCMFrames'] or frames * 4 > protocol['budget']['maximumTemporaryPCMBytes']:
    parser.error('Acquisition exceeds frozen selected-PCM work envelope')
if args.mode == 'acquire' and (not args.native or not args.originals): parser.error('acquire requires --native and --originals')
if args.mode == 'scout' and not args.acquisition: parser.error('scout requires --acquisition')
args.output = args.output.resolve()
args.output.mkdir(exist_ok=False, parents=True)
save(args.output / 'protocol.json', protocol)
if args.mode == 'acquire': acquire(args, protocol)
else: scout(args, protocol)
