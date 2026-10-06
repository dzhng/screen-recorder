"""Inference-free replay of retained bridge operands, not the external full-domain search."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).parents[4]
BANK = ROOT / 'specs/video-editing-feedback/assets/20-synchronization/bridge'
FIXTURES = ROOT / 'fixtures/video-editing-feedback/synchronization/bridge'

def load_module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def digest(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()

def same(actual, expected, message):
    if actual != expected: raise ValueError(message)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bank', type=Path, default=BANK)
    parser.add_argument('--fixtures', type=Path, default=FIXTURES)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    bundle = json.loads((BANK / 'bundle.json').read_text())
    for row in bundle['files']:
        path = (args.bank if row['owner'] == 'assets' else args.fixtures) / row['path']
        same(path.stat().st_size, row['bytes'], 'Frozen retained byte count changed: ' + row['path'])
        same(digest(path), row['sha256'], 'Frozen retained identity changed: ' + row['path'])
    args.output.mkdir(parents=True, exist_ok=False)
    manifest = json.loads((args.fixtures / 'manifest.json').read_text())
    scout = json.loads((args.bank / 'scout.json').read_text())
    local = json.loads((args.bank / 'local.json').read_text())
    same(scout['protocolSha256'], digest(args.bank / 'protocol.json'), 'Parent protocol identity changed')
    same(local['protocolSha256'], digest(args.bank / 'local-protocol.json'), 'Local protocol identity changed')
    same(local['parentScoutSha256'], digest(args.bank / 'scout.json'), 'Local parent identity changed')
    offset, estimator = load_module('offset'), load_module('local')
    def operand(segment, row, side):
        path = args.fixtures / segment / row[side]['path']
        identity = next(entry for entry in manifest['operands'] if entry['path'] == str(path.relative_to(args.fixtures)))
        origin = row['sourceOriginUs'] if side == 'raw' else row['referenceOriginUs']
        same(origin, identity['originUs'], 'Exact source clock changed')
        same(digest(path), row[side]['sha256'], 'Operand WAV identity changed')
        rate, samples = wavfile.read(path)
        same(rate, 16000, 'Operand sample rate changed')
        same(samples.dtype.str, '<f4', 'Operand sample format changed')
        same(len(samples), identity['durationUs'] * rate // 1000000, 'Complete sample support changed')
        same(hashlib.sha256(samples.tobytes()).hexdigest(), row[side]['pcmSha256'], 'Operand PCM identity changed')
        return samples
    for row in scout['windows']:
        left = operand('scout', row, 'raw')
        if 'reference' in row:
            right = operand('scout', row, 'reference')
            same(offset.estimate(left, right, 16000), row['refined'], 'Strict20s refined result changed: ' + row['name'])
    for row in local['windows']:
        parent = next(entry for entry in scout['windows'] if entry['name'] == row['name'])
        same(row['parent20sState'], parent['state'], 'Parent refusal changed')
        for side, clock in [('raw','sourceOriginUs'), ('reference','referenceOriginUs')]:
            same(row[clock], parent[clock] + 8000000, 'Exact local origin changed')
        left, right = [operand('local', row, side) for side in ['raw', 'reference']]
        for side, samples in [('raw',left), ('reference',right)]:
            if not np.array_equal(samples, operand('scout', parent, side)[128000:192000]):
                raise ValueError('Local PCM is not the exact frozen parent middle')
        result = estimator.estimate(left, right, 16000)
        same(result, row['acoustic'], 'Local numerical result changed: ' + row['name'])
        if result['state'] == 'local-acoustic-candidate':
            exact = (row['referenceOriginUs'] - row['sourceOriginUs']) * 16000 // 1000000 + result['offsetFrames']
            same(exact, row['referenceMinusSourceSamples16k'], 'Signed exact original clock changed')
    local_input = args.output / 'local'
    local_input.mkdir()
    shutil.copyfile(args.bank / 'local.json', local_input / 'local.json')
    for row in local['windows']:
        for side in ['raw','reference']:
            shutil.copyfile(args.fixtures / 'local' / row[side]['path'], local_input / row[side]['path'])
    result = subprocess.run(['node', str(Path(__file__).with_name('local-recognition.mjs')), '--local', str(local_input),
        '--capture', str(args.bank), '--out', str(args.output / 'recognition')], capture_output=True, text=True, timeout=30)
    if result.returncode: raise RuntimeError(result.stderr)
    recognition = json.loads((args.output / 'recognition/recognition.json').read_text())
    report = {'verifiedBundleFiles': len(bundle['files']),
        'scoutStates': [row['state'] for row in scout['windows']],
        'strict20sStates': [row['refined']['state'] for row in scout['windows'] if 'refined' in row],
        'coarseRefusedNames': [row['name'] for row in scout['windows'] if 'reference' not in row],
        'localStates': [row['acoustic']['state'] for row in local['windows']],
        'recognizedStates': [row['state'] for row in recognition['windows']],
        'globalStates': [row['state'] for row in recognition['globals']],
        'scope': 'retained strict20s and local operands plus captured literal recognition only; full-domain selection/coarse competitors need original acquisition',
        'nativeDecodes': 0, 'recognitionCalls': 0}
    (args.output / 'replay.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))

if __name__ == '__main__': main()
