"""Test declared two-frame RNNoise latency; never infer speech quality from impulses."""
import argparse
import array
import hashlib
import json
from pathlib import Path
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--processor', type=Path, required=True)
parser.add_argument('--speech', type=Path, required=True)
parser.add_argument('--ffmpeg', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=False)
started = time.monotonic()
commands = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def values(raw):
    a = array.array('f')
    a.frombytes(raw)
    return a

def process(name, source, tail=2):
    assert time.monotonic() - started < 120, 'Two-minute experiment deadline'
    inp, out = args.out / (name + '-input.f32'), args.out / (name + '-raw.f32')
    inp.write_bytes(source.tobytes())
    command = ['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network*)',
               str(args.processor), str(inp), str(out), str(tail)]
    subprocess.run(command, check=True, capture_output=True, timeout=30)
    commands.append(command)
    return values(out.read_bytes())

def peak(a):
    if not a:
        return {'at': None, 'value': None}
    i = max(range(len(a)), key=lambda j: abs(a[j]))
    return {'at': i, 'value': a[i]}

report = {'sampleRate': 48000, 'declaredDelayFrames': 960, 'impulses': [],
          'speechQuality': 'unverified; no listening', 'productionAdoption': False}
for count, at in [(48000, 0), (48000, 4800), (48000, 47999), (17, 16), (1, 0), (479, 478)]:
    source = array.array('f', [0]) * count
    source[at] = 0.5
    raw = process(f'impulse-{count}-{at}', source)
    selected, old = raw[960:960+count], raw[480:480+count]
    observation = peak(selected)
    assert len(selected) == count and observation['at'] == at and abs(observation['value']) > 1e-6
    assert peak(old)['at'] != at or abs(peak(old)['value']) <= 1e-6
    report['impulses'].append({'inputFrames': count, 'inputAt': at, 'inputAmplitude': 0.5,
                               'rawFrames': len(raw), 'rawPeak': peak(raw),
                               'selectedFrames': len(selected), 'selectedPeak': observation,
                               'oneFrameSkipNegativeControl': peak(old)})
decode = [str(args.ffmpeg), '-nostdin', '-v', 'error', '-i', str(args.speech), '-map', '0:a:0',
          '-ar', '48000', '-ac', '1', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1']
source = values(subprocess.check_output(decode, timeout=30))
raw = process('speech', source)
selected = raw[960:960+len(source)]
assert len(selected) == len(source)
for name, tail in [('longer-tail', 4), ('repeat', 2)]:
    result = process('speech-' + name, source, tail)[960:960+len(source)]
    assert result.tobytes() == selected.tobytes(), name
    report[name] = {'exactSelectedPcm': True}
missing_tail = process('speech-no-tail', source, 0)[960:960+len(source)]
assert len(missing_tail) < len(source)
report['speech'] = {'frames': len(source), 'outputFrames': len(selected),
                    'noTailNegativeControlFrames': len(missing_tail),
                    'inputPeak': peak(source), 'outputPeak': peak(selected)}
(args.out / 'speech-selected.f32').write_bytes(selected.tobytes())
report['identity'] = {'runnerSha256': digest(Path(__file__)), 'processorSha256': digest(args.processor),
                      'driverSha256': digest(Path(__file__).with_name('rnnoise-frame-probe.c')),
                      'speechSha256': digest(args.speech), 'ffmpegSha256': digest(args.ffmpeg)}
report['decode'] = decode
report['commands'] = commands
report['elapsedSeconds'] = time.monotonic() - started
report['outputs'] = {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p)}
                     for p in sorted(args.out.glob('*.f32'))}
(args.out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({key: value for key, value in report.items() if key not in ['commands', 'outputs']}, indent=2))
