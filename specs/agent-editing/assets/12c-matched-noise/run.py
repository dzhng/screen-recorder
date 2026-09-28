import argparse, array, hashlib, json, math, pathlib, subprocess, time
parser = argparse.ArgumentParser(description='Matched known-noise mechanism comparison; no listening or production promotion.')
for name in ['repo', 'out', 'ffmpeg', 'processor']:
    parser.add_argument('--' + name, type=pathlib.Path, required=True)
parser.add_argument('--speech', type=pathlib.Path)
parser.add_argument('--speech-sha256')
parser.add_argument('--reference-rms', type=float)
args = parser.parse_args()
if bool(args.speech) != bool(args.speech_sha256):
    parser.error('--speech and --speech-sha256 must be provided together')
repo = args.repo.resolve()
out = args.out.resolve()
out.mkdir()
start = time.monotonic()
source = args.speech.resolve() if args.speech else repo / 'specs/agent-editing/assets/18-voice/context.wav'
ff = args.ffmpeg.resolve()
rn = args.processor.resolve()
expected = json.loads((repo / 'specs/agent-editing/assets/12c-rnnoise-timing/report.json').read_text())['identity']
if args.speech_sha256:
    expected['speechSha256'] = args.speech_sha256
digest = lambda b: hashlib.sha256(b).hexdigest()
assert digest(rn.read_bytes()) == expected['processorSha256']
assert digest(ff.read_bytes()) == expected['ffmpegSha256']
assert digest(source.read_bytes()) == expected['speechSha256']
commands = []

def run(argv, data=None):
    assert time.monotonic() - start < 300
    result = subprocess.run(argv, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=30)
    commands.append({
        'argv': list(map(str, argv)),
        'stdinSha256': digest(data) if data is not None else None,
        'stdoutSha256': digest(result.stdout),
        'stderr': result.stderr.decode(),
    })
    return result.stdout

def floats(b):
    a = array.array('f')
    a.frombytes(b)
    return a

def rms(a):
    return math.sqrt(sum((x * x for x in a)) / len(a))
reference = floats(run([
    str(ff),
    '-nostdin',
    '-v',
    'error',
    '-i',
    str(source),
    '-map',
    '0:a:0',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-c:a',
    'pcm_f32le',
    '-f',
    'f32le',
    'pipe:1',
]))
reference_scale = 1.0
if args.reference_rms is not None:
    if not math.isfinite(args.reference_rms) or args.reference_rms <= 0:
        parser.error('--reference-rms must be finite and positive')
    reference_scale = args.reference_rms / rms(reference)
    reference = array.array('f', (x * reference_scale for x in reference))
seed = 20903
noise = []
for i in range(len(reference)):
    seed ^= seed << 13 & 4294967295
    seed ^= seed >> 17
    seed ^= seed << 5 & 4294967295
    seed &= 4294967295
    white = seed / 4294967295 * 2 - 1
    noise.append(0.7 * math.sin(2 * math.pi * 60 * i / 48000) + 0.3 * white)
scale = rms(reference) / (10 ** (10 / 20) * rms(noise))
noise = array.array('f', (x * scale for x in noise))
mixture = array.array('f', (x + y for x, y in zip(reference, noise)))
inputs = {'reference': reference, 'noise': noise, 'mixture': mixture}
assert max(map(abs, mixture)) < 1
for name, values in inputs.items():
    (out / (name + '.f32')).write_bytes(values.tobytes())
recipe = 'afftdn=nr=12:nf=-50:tn=0:tr=0:om=o:ad=0.5:fo=1:nl=min:bm=1.25:gs=0'
outputs = {}
for method in ['afftdn', 'rnnoise']:
    outputs[method] = {}
    for name, values in inputs.items():
        n = len(values)
        if method == 'afftdn':
            raw = run([
                str(ff),
                '-nostdin',
                '-v',
                'error',
                '-f',
                'f32le',
                '-ar',
                '48000',
                '-ac',
                '1',
                '-i',
                'pipe:0',
                '-af',
                f'apad=pad_len=1200,{recipe},atrim=start_sample=1200:end_sample={1200 + n}',
                '-c:a',
                'pcm_f32le',
                '-f',
                'f32le',
                'pipe:1',
            ], values.tobytes())
            selected = floats(raw)
        else:
            path = out / f'{method}-{name}-raw.f32'
            run([
                '/usr/bin/sandbox-exec',
                '-p',
                '(version 1)(allow default)(deny network*)',
                str(rn),
                str(out / (name + '.f32')),
                str(path),
                '2',
            ])
            raw = path.read_bytes()
            selected = floats(raw)[960:960 + n]
        assert len(selected) == n
        assert all((math.isfinite(x) for x in selected))
        outputs[method][name] = selected
        (out / f'{method}-{name}.f32').write_bytes(selected.tobytes())

def difference(a, b):
    return array.array('f', (x - y for x, y in zip(a, b)))

def energy_windows(a):
    return [rms(a[i:i + 480]) for i in range(0, len(a), 480)]
report = {
    'productionAdoption': False,
    'referenceScaleApplied': reference_scale,
    'speechQuality': 'unverified; no listening; reference includes original ambience',
    'sampleRate': 48000,
    'frames': len(reference),
    'inputSnrDb': 20 * math.log10(rms(reference) / rms(noise)),
    'recipe': recipe,
    'identity': expected,
    'commands': commands,
    'methods': {
    },
    'windows10ms': {
        'reference': energy_windows(reference),
        'noise': energy_windows(noise),
    },
    'files': {
    },
}
for method, items in outputs.items():
    error = rms(difference(items['mixture'], reference))
    dry = rms(difference(items['reference'], reference))
    sensitivity = rms(difference(items['mixture'], items['reference']))
    report['methods'][method] = {
        'mixtureErrorRms': error,
        'mixtureErrorRelativeToInputNoiseDb': 20 * math.log10(error / rms(noise)),
        'referenceOnlyErrorRms': dry,
        'referenceOnlyErrorRelativeToReferenceDb': 20 * math.log10(dry / rms(reference)),
        'noiseOnlyAttenuationDb': 20 * math.log10(rms(items['noise']) / rms(noise)),
        'addedNoiseOutputSensitivityRms': sensitivity,
        'sensitivityRelativeToInputNoiseDb': 20 * math.log10(sensitivity / rms(noise)),
        'inputReferenceRms': rms(reference),
        'outputs': {name: {'rms': rms(a), 'peak': max(map(abs, a)), 'clipped': sum((abs(x) >= 1 for x in a)), 'frames': len(a)} for name, a in items.items()},
    }
    report['windows10ms'][method] = {name: energy_windows(a) for name, a in items.items()}
    x, y = (reference, items['reference'])
    dot = sum((a * b for a, b in zip(x, y)))
    xx = sum((a * a for a in x))
    yy = sum((b * b for b in y))
    gain = dot / yy
    error = sum(((a - gain * b) ** 2 for a, b in zip(x, y)))
    report['methods'][method]['referenceGainDiagnostic'] = {
        'correlation': dot / math.sqrt(xx * yy),
        'bestFitOutputGain': gain,
        'gainCorrectedErrorDb': 10 * math.log10(error / xx),
        'appliedToOutputs': False,
    }
for p in sorted(out.glob('*.f32')):
    report['files'][p.name] = {'bytes': p.stat().st_size, 'sha256': digest(p.read_bytes())}
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report['methods'], indent=2))
