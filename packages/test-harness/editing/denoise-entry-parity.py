"""Frozen native-library parity, not public readiness or listening acceptance."""
import argparse, array, gzip, hashlib, json, subprocess, time
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--native', type=Path, required=True)
p.add_argument('--reference', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
a = p.parse_args()
a.out.mkdir(parents=True, exist_ok=False)
root = Path(__file__).resolve().parents[3]
assets = root / 'specs/done/agent-editing/assets'
report = {'publicReadiness': False, 'listening': 'not performed', 'comparisons': [], 'commands': []}
sha = lambda b: hashlib.sha256(b).hexdigest()
started = time.monotonic()
frozen_identity = json.loads((assets / '12c-rnnoise-timing/state-report.json').read_text())['identity']['processorSha256']
report['identity'] = {name: sha(path.read_bytes()) for name, path in [('native', a.native), ('reference', a.reference), ('harness', Path(__file__))]}
(a.out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
assert report['identity']['reference'] == frozen_identity, 'Reference executable differs from frozen timing proof'

def save():
    (a.out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')

def run(command, error=None):
    record = {'argv': list(map(str, command))}
    report['commands'].append(record)
    save()
    try:
        result = subprocess.run(record['argv'], capture_output=True, timeout=45)
        record.update(exit=result.returncode, stdout=result.stdout.decode(errors='replace'), stderr=result.stderr.decode(errors='replace'))
    except subprocess.TimeoutExpired as failure:
        record.update(timeoutSeconds=45, stdout=(failure.stdout or b'').decode(errors='replace'), stderr=(failure.stderr or b'').decode(errors='replace'))
        save()
        raise
    except OSError as failure:
        record['launchError'] = str(failure)
        save()
        raise
    save()
    assert result.returncode == (1 if error else 0), record
    if error:
        assert json.loads(record['stderr']) == {'error': error}, record
    return result

def native(name, data, chunk=480, rate=48000, channels=1, error=None, cancel=False):
    inp, out = a.out / (name + '-input.f32'), a.out / (name + '-native.f32')
    inp.write_bytes(data)
    run([a.native, inp, out, chunk, rate, channels] + (['--cancel-after-output'] if cancel else []), error)
    if error:
        assert not out.exists(), 'Failed processing published output'
        assert not list(a.out.glob('.denoise-*.tmp')), 'Failed processing left staging bytes'
        return b''
    return out.read_bytes()

def reference(name, data, tail=2):
    inp, out = a.out / (name + '-input.f32'), a.out / (name + '-raw.f32')
    inp.write_bytes(data)
    run([a.reference, inp, out, tail])
    return out.read_bytes()

def compare(name, actual, expected, equal=True):
    result = {'name': name, 'actualBytes': len(actual), 'expectedBytes': len(expected),
              'actualSha256': sha(actual), 'expectedSha256': sha(expected), 'equal': actual == expected}
    report['comparisons'].append(result)
    # Preserve measurements even on the first red gate.
    (a.out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
    assert result['equal'] == equal, result

run([a.native, '--failures'])

for cohort, directory in [('original', '12c-matched-noise/audio'), ('clean', '12c-clean-reference/native-level/audio')]:
    for kind in ['reference', 'noise', 'mixture']:
        source = gzip.decompress((assets / directory / (kind + '.f32.gz')).read_bytes())
        expected = gzip.decompress((assets / directory / ('rnnoise-' + kind + '.f32.gz')).read_bytes())
        compare(cohort + '-' + kind, native(cohort + '-' + kind, source), expected)
        if kind == 'mixture':
            compare(cohort + '-chunk17', native(cohort + '-chunk17', source, 17), expected)

for count, at in [(48000, 0), (48000, 4800), (48000, 47999), (17, 16), (1, 0), (479, 478)]:
    name = f'impulse-{count}-{at}'
    x = array.array('f', [0]) * count; x[at] = .5
    data = x.tobytes(); raw = reference(name, data)
    actual = native(name, data, 1 if count < 480 else 479)
    compare(name, actual, raw[960*4:960*4+len(data)])
    y = array.array('f'); y.frombytes(actual)
    assert max(range(count), key=lambda i: abs(y[i])) == at
    compare(name + '-wrong-delay-negative', actual, raw[480*4:480*4+len(data)], False)

source = gzip.decompress((assets / '12c-matched-noise/audio/mixture.f32.gz').read_bytes())
full = native('state-full', source)
first, last, split = 48000, 192000, 112002
kept = source[first*4:last*4]
selected = native('selected', kept)
poison = array.array('f'); poison.frombytes(source)
for i in range(len(poison)):
    if i < first or i >= last: poison[i] = .9 if i % 2 else -.9
poisoned = poison.tobytes()
compare('selection-isolation', native('selected-poison', poisoned[first*4:last*4]), selected)
compare('process-before-selection-negative', native('poison-full', poisoned)[first*4:last*4], full[first*4:last*4], False)
compare('split-reset-negative', native('reset-left', kept[:(split-first)*4]) + native('reset-right', kept[(split-first)*4:]), selected, False)
compare('stale-trim-negative', full[first*4:last*4], selected, False)
compare('missing-flush-negative', reference('no-flush', source, 0)[960*4:960*4+len(source)], full, False)
for name, data, rate, channels, error in [('rate', source[:1920], 44100, 1, 'unsupportedFormat'), ('stereo', source[:1920], 48000, 2, 'unsupportedFormat'),
                                    ('empty', b'', 48000, 1, 'invalidCount'), ('nan', array.array('f', [float('nan')]).tobytes(), 48000, 1, 'nonfinite')]:
    native('invalid-' + name, data, rate=rate, channels=channels, error=error)
late = array.array('f', [0.1]) * 4000; late[3000] = float('nan')
native('invalid-late-nan', late.tobytes(), error='nonfinite')
native('cancel-after-output', source, error='cancelled', cancel=True)
report['elapsedSeconds'] = time.monotonic() - started
report['identity'] = {name: sha(path.read_bytes()) for name, path in [('native', a.native), ('reference', a.reference), ('harness', Path(__file__))]}
report['files'] = {p.name: {'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in sorted(a.out.glob('*.f32'))}
(a.out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'comparisons': len(report['comparisons']), 'elapsedSeconds': report['elapsedSeconds']}))
