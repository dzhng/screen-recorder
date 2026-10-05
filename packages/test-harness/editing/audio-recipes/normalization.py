from pathlib import Path
import subprocess, struct, json, math, hashlib, sys
ff = sys.argv[1]
oracle = sys.argv[2]
root = Path(sys.argv[3])
root.mkdir()
protocol = {'acceptedBy': 'parent before confirmation', 'integratedAbsoluteLu': 0.2, 'rangeMaximumExcessLu': 0.2, 'meterSpecificTruePeakExcessDb': 0.15, 'scaledPcmAbsolute': 1e-06, 'frames': 'exact'}
(root / 'frozen-protocol.json').write_text(json.dumps(protocol, indent=2))

def run(name, p, rate, channels, filt, output=False):
    """Retain original candidate output and logs before acceptance gates."""
    args = [ff, '-hide_banner', '-nostdin', '-y', '-f', 'f32le', '-ar', str(rate), '-ac', str(channels), '-i', str(p), '-af', filt]
    path = root / (name + '.f32')
    args += ['-ar', str(rate), '-c:a', 'pcm_f32le', '-f', 'f32le', str(path)] if output else ['-f', 'null', '-']
    s = subprocess.run(args, capture_output=True, text=True, check=True)
    (root / (name + '.log')).write_text(s.stderr)
    return (s.stderr, path)

def meter(name, path, rate, channels):
    cache = root / (name + '-oracle.json')
    if not cache.exists():
        s = subprocess.run([oracle, str(path), str(channels), str(rate)], capture_output=True, text=True, check=True)
        cache.write_text(s.stdout)
    value = json.loads(cache.read_text())
    return {k: float(v) if v is not None else None for (k, v) in value.items()}

def admit(value, targets):
    return abs(value['integratedLufs'] - targets['integratedLufs']) <= 0.2 and value['loudnessRangeLu'] <= targets['loudnessRangeLu'] + 0.2 and (value['truePeakDbtp'] <= targets['truePeakDbtp'] + 0.15)
report = {'protocol': protocol, 'records': [], 'ffmpegSha256': hashlib.sha256(Path(ff).read_bytes()).hexdigest(), 'oracleSha256': hashlib.sha256(Path(oracle).read_bytes()).hexdigest()}
for (name, rate, channels, mode) in [('linear-unequal-stereo', 48000, 2, 'gain-only'), ('dynamic-steady-mono', 44100, 1, 'dynamic')]:
    n = rate * 8
    v = []
    for i in range(n):
        t = i / rate
        taper = min(1, t / 0.1, (8 - t - 1 / rate) / 0.1)
        for c in range(channels):
            v.append((0.06 if c == 0 else 0.03) * taper * (math.sin(2 * math.pi * 733 * t) + 0.13 * math.sin(2 * math.pi * 4117 * t)))
    p = root / (name + '-input.f32')
    p.write_bytes(struct.pack('<' + 'f' * len(v), *v))
    before = meter(name + '-input', p, rate, channels)
    targets = {'integratedLufs': -20, 'truePeakDbtp': -2, 'loudnessRangeLu': 8}
    if mode == 'gain-only':
        gain = 10 ** ((targets['integratedLufs'] - before['integratedLufs']) / 20)
        (log, path) = run(name, p, rate, channels, f'volume={gain}:precision=double', True)
    else:
        (log, _) = run(name + '-first', p, rate, channels, 'loudnorm=I=-20:TP=-2:LRA=8:linear=false:print_format=json')
        first = json.JSONDecoder().raw_decode(log[log.rfind('{'):])[0]
        recipe = 'loudnorm=I=-20:TP=-2:LRA=8:linear=false:measured_I=' + first['input_i'] + ':measured_TP=' + first['input_tp'] + ':measured_LRA=' + first['input_lra'] + ':measured_thresh=' + first['input_thresh'] + ':offset=' + first['target_offset'] + ':print_format=json'
        (log, path) = run(name, p, rate, channels, recipe, True)
    b = path.read_bytes()
    if len(b) % (4 * channels):
        raise ValueError('Incomplete authored output frame')
    out = struct.unpack('<' + 'f' * (len(b) // 4), b)
    if not all((math.isfinite(x) for x in out)):
        raise ValueError('Nonfinite normalized PCM')
    after = meter(name + '-output', path, rate, channels)
    r = {'name': name, 'mode': mode, 'rate': rate, 'channels': channels, 'expectedFrames': n, 'frames': len(out) // channels, 'targets': targets, 'before': before, 'after': after, 'admitted': admit(after, targets), 'inputSha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'outputSha256': hashlib.sha256(b).hexdigest()}
    if mode == 'gain-only':
        r['gain'] = gain
        r['scaledPcmMaxDifference'] = max((abs(a * gain - b) for (a, b) in zip(struct.unpack('<' + 'f' * len(v), p.read_bytes()), out)))
        r['linearFeasible'] = before['loudnessRangeLu'] <= targets['loudnessRangeLu'] + 0.2 and before['truePeakDbtp'] + 20 * math.log10(gain) <= targets['truePeakDbtp'] + 0.15
    else:
        r['recipe'] = recipe
        r['first'] = first
    report['records'].append(r)
    (root / 'report.json').write_text(json.dumps(report, indent=2))
report['passed'] = all((r['admitted'] and r['frames'] == r['expectedFrames'] and (r.get('scaledPcmMaxDifference', 0) <= 1e-06) for r in report['records']))
(root / 'report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if not report['passed']:
    raise SystemExit('Frozen numerical acceptance failed; complete operands retained')
