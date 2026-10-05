from pathlib import Path
import subprocess, struct, json, math, hashlib, sys
root = Path(sys.argv[2])
root.mkdir()
ff = sys.argv[1]
rate = 48000
protocol = {'acceptedBy': 'parent before held-out generation', 'frames': 'exact', 'timing': 'exact authored indices', 'stereoRatioAbs': 1e-06, 'ceilingLinearExcess': 1e-06, 'steadyGainAbs': 1e-06, 'packetCropPcmAbs': 1e-06}
(root / 'frozen-protocol.json').write_text(json.dumps(protocol, indent=2))

def save(name, rows):
    p = root / (name + '.f32')
    p.write_bytes(b''.join((struct.pack('<ff', *row) for row in rows)))
    return p

def read(p):
    """Validate complete, finite frames before a numerical reduction can hide them."""
    b = p.read_bytes()
    if len(b) % 8:
        raise ValueError('Stereo PCM has an incomplete frame: ' + str(p))
    v = struct.unpack('<' + 'f' * (len(b) // 4), b)
    if not all((math.isfinite(x) for x in v)):
        raise ValueError('Nonfinite PCM: ' + str(p))
    return [v[i:i + 2] for i in range(0, len(v), 2)]

def run(name, program, filt, detector=None):
    """Retain original candidate output and logs before acceptance gates."""
    path = root / (name + '.f32')
    args = [ff, '-hide_banner', '-nostdin', '-y', '-f', 'f32le', '-ar', str(rate), '-ac', '2', '-i', str(program)]
    if detector:
        args += ['-f', 'f32le', '-ar', str(rate), '-ac', '2', '-i', str(detector), '-filter_complex', filt]
    else:
        args += ['-filter_complex' if filt.startswith('[0:a]') else '-af', filt]
    args += ['-c:a', 'pcm_f32le', '-f', 'f32le', str(path)]
    p = subprocess.run(args, capture_output=True, text=True)
    (root / (name + '.log')).write_text(p.stderr)
    if p.returncode:
        raise RuntimeError(name + ' failed')
    return read(path)

def diff(a, b):
    """Unequal clocks or nonfinite samples cannot reduce to a passing error."""
    if len(a) != len(b):
        return math.inf
    differences = [abs(x - y) for (ar, br) in zip(a, b) for (x, y) in zip(ar, br)]
    if not all((math.isfinite(x) for x in differences)):
        return math.inf
    return max(differences or [0])

def linked_limiter(n, ceiling, lookahead, release=71, fragment=False, crop=''):
    """Apply one mono maximum-channel envelope to both signed channels; avoid per-channel safety clip drift."""
    prefix = 'asetnsamples=n=17:p=0,' if fragment else ''
    return f'[0:a]{prefix}asetnsamples=n=128:p=1,asplit=2[p][d];[d]aeval=exprs=max(abs(val(0))\\,abs(val(1))):c=mono,asplit=2[m][md];[m]alimiter=limit={ceiling}:attack={lookahead}:release={release}:level_in=1:level_out=1:level=false:asc=false:latency=true,asetnsamples=n=128:p=1[ml];[p][md][ml]amerge=inputs=3,aeval=exprs=if(eq(val(2)\\,0)\\,val(0)\\,val(0)*val(3)/val(2))|if(eq(val(2)\\,0)\\,val(1)\\,val(1)*val(3)/val(2)):c=stereo,atrim=end_sample={n}' + crop
report = {'protocol': protocol, 'runtimeSha256': hashlib.sha256(Path(ff).read_bytes()).hexdigest(), 'limiter': [], 'compressor': {}}
for (name, n, ms, ceiling) in [('l132', 11003, 2.75, 0.375), ('l4', 1031, 0.1, 0.8), ('l3840-short', 31, 80, 0.25), ('l132-near', 11003, 2.75, 0.375)]:
    baseline = ceiling * 0.9999 if name.endswith('near') else 0.03125
    rows = [(baseline, baseline / 2)] * n
    at = n // 2
    rows[0] = (0.95, 0.475)
    rows[at] = (-0.95, -0.475)
    rows[-1] = (0.95, 0.475)
    inp = save(name + '-input', rows)
    recipe = linked_limiter(n, ceiling, ms)
    a = run(name, inp, recipe)
    b = run(name + '-packet', inp, linked_limiter(n, ceiling, ms, fragment=True))
    cropstart = n // 4
    cropend = max(cropstart + 1, n * 3 // 4)
    c = run(name + '-crop', inp, recipe + f',atrim=start_sample={cropstart}:end_sample={cropend}')
    report['limiter'].append({'name': name, 'frames': len(a), 'expectedFrames': n, 'lookaheadMs': ms, 'delaySamples': math.floor(rate * ms / 1000) - 1, 'peak': max([abs(x) for row in a for x in row] or [0]), 'ceiling': ceiling, 'linkedError': max([abs(row[0] - 2 * row[1]) for row in a] or [0]), 'landmarks': {str(i): a[i] if i < len(a) else None for i in [0, at, n - 1]}, 'expectedLandmarks': {str(i): [math.copysign(ceiling, rows[i][0]), math.copysign(ceiling / 2, rows[i][1])] for i in [0, at, n - 1]}, 'maximumGain': max([abs(x / y) for (ar, br) in zip(a, rows) for (x, y) in zip(ar, br) if y] or [0]), 'maximumReleaseStepGain': 1 + 1 / (rate * 0.071), 'polarityPreserved': all((x * y >= 0 for (ar, br) in zip(a, rows) for (x, y) in zip(ar, br))), 'packetDifference': diff(a, b), 'packetFrames': len(b), 'cropDifference': diff(a[cropstart:cropend], c), 'cropFrames': len(c), 'expectedCropFrames': cropend - cropstart})
n = 17003
rows = [(0.125, 0.0625)] * n
det = [(0.0, 0.0) if i < 1901 or 6703 <= i < 9911 or i >= 14003 else (0.03125, 0.75) for i in range(n)]
p = save('compress-program', rows)
d = save('compress-detector', det)
base = 'sidechaincompress=threshold=.1875:ratio=3:attack=7:release=83:knee=1:detection=peak:link=maximum:level_in=1:level_sc=1:makeup=1:mix=1:mode=downward'

def recipe(fragment=False, crop=''):
    pa = 'asetnsamples=n=19:p=0,' if fragment else ''
    da = 'asetnsamples=n=43:p=0,' if fragment else ''
    return f'[0:a]{pa}asetnsamples=n=128:p=1[p];[1:a]{da}asetnsamples=n=128:p=1[d];[p][d]' + base + f',atrim=end_sample={n}' + crop
a = run('compress', p, recipe(), d)
b = run('compress-fragment', p, recipe(True), d)
start = 3107
end = 15301
c = run('compress-crop', p, recipe(crop=f',atrim=start_sample={start}:end_sample={end}'), d)
expectedGain = (0.1875 / 0.75) ** (1 - 1 / 3)
steady = 6600
level = 0.0
expected = []
for (programRow, detectorRow) in zip(rows, det):
    peak = max((abs(x) for x in detectorRow))
    coefficient = min(1, 4000 / ((7 if peak > level else 83) * rate))
    level += (peak - level) * coefficient
    gain = 1 if level <= 0.1875 else (0.1875 / level) ** (1 - 1 / 3)
    expected.append(tuple((x * gain for x in programRow)))
save('compress-independent-envelope', expected)
report['compressor'] = {'frames': len(a), 'expectedFrames': n, 'packetFrames': len(b), 'packetDifference': diff(a, b), 'cropFrames': len(c), 'expectedCropFrames': end - start, 'cropDifference': diff(a[start:end], c), 'linkedError': max([abs(row[0] - 2 * row[1]) for row in a] or [0]), 'envelopePcmMaxDifference': diff(a, expected), 'expectedSteadyGain': expectedGain, 'steadyGain': a[steady][0] / 0.125, 'releaseToUnity': a[9910], 'initial': a[0], 'tail': a[-1]}
(root / 'report.json').write_text(json.dumps(report, indent=2))
checks = []
for r in report['limiter']:
    checks += [r['frames'] == r['expectedFrames'], r['packetFrames'] == r['expectedFrames'], r['cropFrames'] == r['expectedCropFrames'], r['peak'] <= r['ceiling'] + 1e-06, r['linkedError'] <= 1e-06, r['packetDifference'] <= 1e-06, r['cropDifference'] <= 1e-06]
    checks += [r['polarityPreserved'], r['maximumGain'] <= r['maximumReleaseStepGain'] + 1e-06]
    for (i, v) in r['landmarks'].items():
        checks.append(v is not None and all((abs(x - y) <= 1e-06 for (x, y) in zip(v, r['expectedLandmarks'][i]))))
r = report['compressor']
checks += [r['frames'] == n, r['packetFrames'] == n, r['cropFrames'] == r['expectedCropFrames'], r['packetDifference'] <= 1e-06, r['cropDifference'] <= 1e-06, r['linkedError'] <= 1e-06, r['envelopePcmMaxDifference'] <= 1e-06, r['releaseToUnity'] == (0.125, 0.0625), abs(r['steadyGain'] - expectedGain) <= 1e-06, r['initial'] == (0.125, 0.0625), r['tail'] == (0.125, 0.0625)]
report['passed'] = all(checks)
report['checks'] = checks
(root / 'report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if not report['passed']:
    raise SystemExit('Frozen numerical acceptance failed; complete operands retained')
