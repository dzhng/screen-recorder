"""Bounded afftdn timing experiment; numeric mechanism evidence, not speech quality."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time

RECIPE = 'afftdn=nr=12:nf=-50:tn=0:tr=0:om=o:ad=0.5:fo=1:nl=min:bm=1.25:gs=0'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--ffmpeg', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--speech', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=False)
started = time.monotonic()
commands = []


def digest(data):
    return hashlib.sha256(data).hexdigest()


def run(options, data=None):
    assert time.monotonic() - started < 300, 'Five-minute experiment deadline'
    command = [str(args.ffmpeg), '-nostdin', '-v', 'error', *options]
    result = subprocess.run(command, input=data, capture_output=True, check=True, timeout=30)
    commands.append({'argv': command, 'inputSha256': digest(data) if data else None,
                     'outputSha256': digest(result.stdout)})
    return result.stdout


def floats(data):
    values = array.array('f')
    values.frombytes(data)
    return values


def process(name, values, rate, channels=1, compensate=True, tail_hops=2, packet=None):
    count = len(values) // channels
    hop = rate // 80
    filters = [] if packet is None else [f'asetnsamples=n={packet}:p=0']
    if compensate:
        filters.append(f'apad=pad_len={tail_hops * hop}')
    filters.append(RECIPE)
    if compensate:
        filters.append(f'atrim=start_sample={2 * hop}:end_sample={2 * hop + count}')
    raw = run(['-f', 'f32le', '-ar', str(rate), '-ac', str(channels), '-i', 'pipe:0',
               '-af', ','.join(filters), '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'],
              values.tobytes())
    (args.out / (name + '.f32')).write_bytes(raw)
    return floats(raw)


def comparison(a, b):
    assert len(a) == len(b), 'Sample counts differ'
    delta = [x - y for x, y in zip(a, b)]
    return {'samples': len(a), 'differentSamples': sum(x != 0 for x in delta),
            'maxAbsoluteError': max(map(abs, delta), default=0),
            'rmsError': math.sqrt(sum(x*x for x in delta) / max(1, len(delta)))}


report = {'recipe': RECIPE, 'delayRule': '2 * floor(sampleRate / 80)', 'impulses': [],
          'speechQuality': 'unverified; no listening', 'productionAdoption': False}
for rate in [24000, 44100, 48000]:
    hop = rate // 80
    cases = [(rate, 0), (rate, rate // 10), (rate, rate - 1),
             (1, 0), (17, 16), (hop - 1, hop - 2)]
    for count, at in cases:
        source = array.array('f', [0]) * count
        source[at] = 0.5
        for compensate in [False, True]:
            name = f'impulse-{rate}-{count}-{at}-' + ('compensated' if compensate else 'raw')
            result = process(name, source, rate, compensate=compensate)
            assert len(result) == count
            peak = max(range(len(result)), key=lambda i: abs(result[i]))
            timing = peak == at and abs(result[peak]) > 1e-6
            report['impulses'].append({'name': name, 'rate': rate, 'inputFrames': count,
                                      'outputFrames': len(result), 'at': at, 'peakAt': peak,
                                      'peak': result[peak], 'timingPass': timing})
            if compensate:
                assert timing, name
            else:
                assert not timing, 'Uncompensated negative control unexpectedly passes'

speech = floats(run(['-i', str(args.speech), '-ar', '24000', '-ac', '1',
                    '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1']))
prepared = process('speech-compensated', speech, 24000)
report['speechFrames'] = len(speech)
report['speechControls'] = {}
for name, settings in [('longer-tail', {'tail_hops': 4}), ('packet-17', {'packet': 17}),
                       ('packet-997', {'packet': 997}), ('repeat', {})]:
    candidate = process('speech-' + name, speech, 24000, **settings)
    result = comparison(prepared, candidate)
    report['speechControls'][name] = result
    assert result['differentSamples'] == 0, name
report['rawSpeechDifference'] = comparison(speech, prepared)
report['speechPeak'] = {'input': max(map(abs, speech)), 'output': max(map(abs, prepared))}
# Independent channels carry unequal, differently placed impulses.
stereo = array.array('f', [0]) * 48000
stereo[0], stereo[-1] = 0.5, -0.25
mixed = process('stereo-compensated', stereo, 24000, channels=2)
report['stereo'] = []
for channel in [0, 1]:
    mono = process(f'stereo-channel-{channel}', stereo[channel::2], 24000)
    result = comparison(mixed[channel::2], mono)
    report['stereo'].append(result)
    assert result['differentSamples'] == 0
report['elapsedSeconds'] = time.monotonic() - started
report['commands'] = commands
report['identity'] = {'runnerSha256': digest(Path(__file__).read_bytes()),
                      'ffmpegSha256': digest(args.ffmpeg.read_bytes()),
                      'speechSha256': digest(args.speech.read_bytes())}
report['outputs'] = {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p.read_bytes())}
                     for p in sorted(args.out.glob('*.f32'))}
report['passedTimingMechanism'] = True
(args.out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
(args.out / 'version.txt').write_bytes(subprocess.check_output([str(args.ffmpeg), '-version']))
print(json.dumps({key: value for key, value in report.items()
                  if key not in ['commands', 'outputs', 'impulses']}, indent=2))
