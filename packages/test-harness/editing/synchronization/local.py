"""Three local disjoint waveform anchors; never a global clock or edit declaration."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
from scipy.io import wavfile

spec = importlib.util.spec_from_file_location('offset', Path(__file__).with_name('offset.py'))
offset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offset)

def estimate(left, right, rate):
    left, right = np.asarray(left), np.asarray(right)
    if type(rate) is not int or not 0 < rate <= 16000 or len(left) != 4 * rate or len(right) != len(left):
        raise ValueError('Supply complete4s mono windows')
    lag, width = rate // 8, rate * 3 // 4
    anchors = []
    for center in [.5, 2, 3.5]:
        start = int((center - .375) * rate)
        candidates = offset.peaks(left[start:start + width], right[start - lag:start + width + lag], rate, -lag)
        ratio = candidates[1]['absoluteCorrelation'] / candidates[0]['absoluteCorrelation'] if len(candidates) > 1 else None
        admitted = bool(candidates and candidates[0]['absoluteCorrelation'] >= offset.POLICY['minimumCorrelation'] and
            (ratio is None or ratio <= offset.POLICY['maximumAlternativeRatio']))
        anchors.append({'rangeFrames': [start, start + width], 'selectedFrames': candidates[0]['offsetFrames'] if admitted else None,
            'alternatives': candidates, 'alternativeRatio': ratio})
    complete = all(row['selectedFrames'] is not None for row in anchors)
    spread = max(row['selectedFrames'] for row in anchors) - min(row['selectedFrames'] for row in anchors) if complete else None
    stable = complete and spread <= rate * offset.POLICY['maximumSpreadMs'] / 1000
    return {'state': 'local-acoustic-candidate' if stable else 'refused', 'sampleRate': rate,
        'offsetFrames': sorted(row['selectedFrames'] for row in anchors)[1] if stable else None,
        'spreadFrames': spread, 'anchors': anchors,
        'reason': 'independent-lexical-admission-required' if stable else 'nonconstant-local-offset' if complete else 'insufficient-or-ambiguous-local-waveform'}

def digest(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scout', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    protocol = Path(__file__).parents[4] / 'specs/video-editing-feedback/assets/20-synchronization/bridge/local-protocol.json'
    policy = json.loads(protocol.read_text())
    prior = json.loads((args.scout / 'scout.json').read_text())
    selected = [row for row in prior['windows'] if 'reference' in row]
    if len(selected) > policy['budget']['maximumLocalCases']: parser.error('Local cases exceed frozen budget')
    args.output.mkdir(exist_ok=False, parents=True)
    report = {'protocolSha256': digest(protocol), 'parentScoutSha256': digest(args.scout / 'scout.json'), 'windows': [],
        'scope': 'local sampled acoustic operands only; independent recognition pending; parent20s/global refusals unchanged'}
    for row in selected:
        operands = []
        for side in ['raw', 'reference']:
            path = args.scout / row[side]['path']
            if digest(path) != row[side]['sha256']: raise ValueError('Parent selected operand identity changed')
            rate, samples = wavfile.read(path)
            if rate != 16000 or len(samples) != 320000 or samples.dtype != np.dtype('<f4'):
                raise ValueError('Use complete frozen20s mono16k Float32 parent operand')
            operands.append(samples[128000:192000])
        result = estimate(*operands, 16000)
        entry = {'name': row['name'], 'source': row['source'], 'parent20sState': row['state'],
            'sourceOriginUs': row['sourceOriginUs'] + 8000000, 'referenceOriginUs': row['referenceOriginUs'] + 8000000,
            'acoustic': result}
        for side, samples in zip(['raw', 'reference'], operands):
            path = args.output / (row['name'] + '-' + side + '.wav')
            wavfile.write(path, 16000, samples)
            entry[side] = {'path': path.name, 'sha256': digest(path), 'pcmSha256': hashlib.sha256(samples.tobytes()).hexdigest(),
                'frames': 64000, 'sampleRate': 16000}
        if result['state'] == 'local-acoustic-candidate':
            entry['referenceMinusSourceSamples16k'] = (entry['referenceOriginUs'] - entry['sourceOriginUs']) * 16000 // 1000000 + result['offsetFrames']
        report['windows'].append(entry)
        (args.output / 'local.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
        print(row['name'] + ': ' + result['state'], flush=True)

if __name__ == '__main__': main()
