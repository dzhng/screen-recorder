"""Native pitch-follow retained-run proof. Worker and fresh scratch directory are required."""
from pathlib import Path
from fractions import Fraction
import array
import argparse
import hashlib
import tarfile
import copy
import json
import math
import struct
import subprocess
import sys
sys.dont_write_bytecode = True
from composition_audio import NativeAudio, RETIME_IMPLEMENTATION, clip, plan, pcm, selection, span, stereo

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('worker', type=lambda value: Path(value).resolve())
parser.add_argument('out', type=lambda value: Path(value).resolve())
parser.add_argument('--learned-reference', type=lambda value: Path(value).resolve(),
    help='Run only the retained follow → independent learned oracle through the real native wire')
args = parser.parse_args()
worker, out = args.worker, args.out
native = NativeAudio(worker, out, wire=args.learned_reference is not None)
run, report = native.run, native.report

def wave(path, samples, rate, channels):
    data = samples.tobytes() if isinstance(samples, array.array) else samples
    path.write_bytes(struct.pack('<4sI4s4sIHHIIHH4sI', b'RIFF', len(data)+36, b'WAVE', b'fmt ', 16,
        3, channels, rate, rate*channels*4, channels*4, 32, b'data', len(data)) + data)

def tone(frames, rate, channels):
    return array.array('f', (0.25*math.sin(2*math.pi*(997+412*c)*i/rate)
        for i in range(frames) for c in range(channels)))

def retained(start, end, rate, speed, project_start=Fraction(0)):
    first, last = Fraction(start*48000, rate), Fraction(end*48000, rate)
    project_end = project_start + (last-first)/speed
    value = clip('c', first, last, project_start, project_end)
    value['pitch'] = 'follow'
    value['sampleRange'] = span(math.floor(project_start), math.floor(project_end))
    value['available'] = [value['sampleRange']]
    value['context'][0]['sampleRange'] = value['sampleRange']
    return value

def request(value, source):
    return plan([value], value['sampleRange']['start'], value['sampleRange']['end'], source)

def frequency(data, channel):
    samples = array.array('f'); samples.frombytes(data)
    crossing = []
    for i in range(2001, len(samples)//2-2000):
        left, right = samples[(i-1)*2+channel], samples[i*2+channel]
        if left <= 0 < right: crossing.append(i-1-left/(right-left))
    assert len(crossing) > 10
    return 48000*(len(crossing)-1)/(crossing[-1]-crossing[0])

def learned_retained(reference):
    root = Path(__file__).resolve().parents[3]
    packet = root / 'specs/done/agent-editing/assets/15a3d-follow-learned-native'
    retained = out / 'retained'; retained.mkdir()
    manifest = json.loads((packet / 'retained.json').read_text())
    with tarfile.open(packet / 'retained.tar.xz') as archive:
        for entry in manifest['files']:
            data = archive.extractfile(entry['path']).read()
            assert hashlib.sha256(data).hexdigest() == entry['sha256']
            (retained / entry['path']).write_bytes(data)
    frozen_report = json.loads((root / 'specs/done/agent-editing/assets/14d-pitch-follow/follow.json').read_text())
    frozen = pcm(retained / 'rate-44100-2-9-10.wav')
    dry_hash = next(case['sha256'] for case in frozen_report['checks']
        if case['case'] == 'rate-44100-2-9-10')
    assert hashlib.sha256(frozen).hexdigest() == dry_hash
    report.update(passed=False, scope='Native follow → independent fixed-recipe RNNoise only; no public or listening claim',
        retained=manifest, frozenDrySha256=dry_hash,
        harnessSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        referenceSha256=hashlib.sha256(reference.read_bytes()).hexdigest())
    def saved_plan(name):
        value = json.loads((retained / (name + '.json')).read_text())
        value['retimeImplementationId'] = RETIME_IMPLEMENTATION
        value['assets'][0]['path'] = str(retained / 'tone-44100-2.wav')
        return value
    dry, _ = run('dry', saved_plan('rate-44100-2-9-10'))
    assert dry == frozen, 'Current follow PCM differs from retained dry oracle; no tolerance applies'
    def learned(name, data):
        source = out / (name + '-input.f32'); source.write_bytes(data)
        destination = out / (name + '.f32')
        script = """import {readFileSync, writeFileSync} from 'node:fs';
const [module, reference, out, name, input, output] = process.argv.slice(1);
const {createDenoiseReference} = await import(module);
writeFileSync(output, createDenoiseReference(reference, out)(name, readFileSync(input), 2));"""
        subprocess.run(['node', '--input-type=module', '-e', script,
            (Path(__file__).parent / 'denoise-reference.mjs').resolve().as_uri(),
            str(reference), str(out), name, str(source), str(destination)], check=True, timeout=90)
        return destination.read_bytes()
    expected = learned('expected', frozen)
    late_plan = saved_plan('state-stereo-late')
    whole_plan = saved_plan('state-stereo-full')
    offset = (late_plan['range']['start'] - whole_plan['range']['start']) * 8
    reset = learned('reset-control', frozen[offset:])
    assert reset != expected[offset:], 'Late reset control must discriminate state history'
    late, late_receipt = run('late-before-full', late_plan)
    assert late == expected[offset:], 'Late learned PCM differs from independent complete-run C oracle'
    whole, whole_receipt = run('full', whole_plan)
    assert whole == expected, 'Full learned PCM differs from independent C oracle'
    assert late_receipt['sourceWork']['preparedRetimeRuns'] == 1
    assert whole_receipt['sourceWork']['preparedRetimeRuns'] == 1
    report.update(passed=True, learnedSha256=hashlib.sha256(expected).hexdigest(),
        lateSha256=hashlib.sha256(late).hexdigest(), resetAtLateDiffers=True,
        lateBeforeFull=True, retimeImplementationId=RETIME_IMPLEMENTATION,
        rnnoiseImplementationId=whole_plan['state']['implementationId'])
    (out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'checks': len(report['checks']), 'report': str(out / 'report.json')}))

if args.learned_reference:
    learned_retained(args.learned_reference)
    sys.exit(0)

source = out / 'tone.wav'
wave(source, tone(600000, 48000, 1), 48000, 1)
value = retained(0, 600000, 48000, Fraction(9, 10))
actual, receipt = run('fractional-rate', request(value, source))
measured = frequency(actual, 0)
assert abs(measured-997*0.9) < 0.001, measured
assert receipt['frames'] == 666666
assert receipt['sourceWork']['preparedRetimeRuns'] == 1
report['fractionalRateHz'] = measured
# Both source rates and channel layouts use the source's lanes before the existing
# graph map. Pitch follows every exact authored ratio, including fractional Hz.
report['frequency'] = []
for rate in [48000, 44100]:
    for channels in [1, 2]:
        path = out / f'tone-{rate}-{channels}.wav'
        wave(path, tone(62000, rate, channels), rate, channels)
        for speed in [Fraction(4, 5), Fraction(9, 10), Fraction(5, 4), Fraction(1234567, 1000000), Fraction(1)]:
            selected = retained(731, 61205, rate, speed, Fraction(17, 3))
            data, receipt = run(f'rate-{rate}-{channels}-{speed.numerator}-{speed.denominator}', request(selected, path))
            measured = [frequency(data, c) for c in range(2)]
            expected = [(997+412*(c if channels == 2 else 0))*float(speed) for c in range(2)]
            assert all(abs(a-b) < 0.001 for a, b in zip(measured, expected)), (measured, expected)
            report['frequency'].append({'sourceRate': rate, 'channels': channels, 'speed': str(speed),
                'measuredHz': measured, 'expectedHz': expected})
            if speed == 1:
                unit = copy.deepcopy(selected); unit['pitch'] = 'preserve'
                control, _ = run(f'identity-control-{rate}-{channels}', request(unit, path))
                assert data == control

# A fractional project origin owes one extra frame beyond the platform's natural
# seven-frame output here. Only that proven quantization debt may become zero.
short_path = out / 'short.wav'
wave(short_path, tone(7, 48000, 1), 48000, 1)
short, _ = run('short-floor', request(retained(0, 7, 48000, Fraction(9, 10)), short_path))
rounded, _ = run('short-ceil-debt', request(retained(0, 7, 48000, Fraction(9, 10), Fraction(1, 2)), short_path))
assert rounded == short + bytes(8)

# A split and every view retain the original complete converter phase. Source
# support is deliberately internal, so poisoning either excluded side is decisive.
rate, channels, speed = 44100, 2, Fraction(1234567, 1000000)
path = out / 'tone-44100-2.wav'
selected = retained(731, 61205, rate, speed, Fraction(17, 3))
whole, _ = run('retained-whole', request(selected, path))
start, end = selected['sampleRange'].values(); middle = start+(end-start)//2
left, right = copy.deepcopy(selected), copy.deepcopy(selected)
left['sampleRange'], right['sampleRange'] = span(start, middle), span(middle, end)
left['available'], right['available'] = [left['sampleRange']], [right['sampleRange']]
left_pcm, _ = run('left-view', request(left, path))
right_pcm, _ = run('right-view', request(right, path))
assert left_pcm+right_pcm == whole
source_first = Fraction(731*48000, rate)
source_last = Fraction(61205*48000, rate)
project_first = Fraction(17, 3)
project_last = project_first+(source_last-source_first)/speed
source_middle = source_first+(middle-project_first)*speed
left['placement'], right['placement'] = selection(project_first, middle), selection(middle, project_last)
left['source']['range'], right['source']['range'] = selection(source_first, source_middle), selection(source_middle, source_last)
left['clipId'], right['clipId'] = 'left', 'right'
split, receipt = run('pure-split', plan([left, right], start, end, path))
assert split == whole and receipt['sourceWork']['preparedRetimeRuns'] == 1
poison = array.array('f'); poison.frombytes(path.read_bytes()[44:])
for i in list(range(731)) + list(range(61205, 62000)):
    for c in range(2): poison[i*2+c] = float('nan')
poison_path = out / 'excluded-poison-input.wav'; wave(poison_path, poison, rate, 2)
poison_pcm, _ = run('excluded-poison', request(selected, poison_path))
assert poison_pcm == whole

# The right lane stays silent while the left follows pitch; there is no remix.
silent_lane = tone(62000, 48000, 2)
for i in range(62000): silent_lane[i*2+1] = 0
path = out / 'silent-right-input.wav'; wave(path, silent_lane, 48000, 2)
data, _ = run('silent-right', request(retained(731, 61205, 48000, Fraction(9, 10)), path))
samples = array.array('f'); samples.frombytes(data)
assert all(x == 0 for x in samples[1::2]) and any(x != 0 for x in samples[::2])

# Preserve first normalizes the exact native selection to48k. Its result must match
# the accepted preserve recipe given that separately normalized selected PCM.
path = out / 'tone-44100-1.wav'
normal, _ = run('normalize-44100-selection', request(retained(731, 61205, 44100, Fraction(1)), path))
normal_samples = array.array('f'); normal_samples.frombytes(normal)
normalized_path = out / 'normalized-48000.wav'
wave(normalized_path, normal_samples[::2], 48000, 1)
preserved = retained(731, 61205, 44100, Fraction(9, 10)); preserved['pitch'] = 'preserve'
preserved_pcm, receipt = run('preserve-44100', request(preserved, path))
count = preserved['sampleRange']['end']
control = clip('c', 0, len(normal_samples)//2, 0, count)
reference_pcm, _ = run('preserve-normalized-48000', request(control, normalized_path))
assert preserved_pcm == reference_pcm
report['preserveNormalized44100Exact'] = True

# Policy and exact ratio remain distinct even when their frame boundaries match.
# Combined output checks the dictionary's stored value as well as its run count.
path = out / 'tone-48000-1.wav'
follow = retained(0, 60000, 48000, Fraction(9, 10))
preserve = copy.deepcopy(follow); preserve['pitch'] = 'preserve'
follow_pcm, _ = run('policy-follow', request(follow, path))
preserve_pcm, _ = run('policy-preserve', request(preserve, path))
assert follow_pcm != preserve_pcm
follow['clipId'], preserve['clipId'] = 'follow', 'preserve'
def sum_pcm(left, right):
    a, b = array.array('f'), array.array('f'); a.frombytes(left); b.frombytes(right)
    return array.array('f', (x+y for x, y in zip(a, b))).tobytes()
combined, receipt = run('policy-distinct', plan([preserve, follow], 0, follow['sampleRange']['end'], path))
assert combined == sum_pcm(preserve_pcm, follow_pcm)
assert receipt['sourceWork']['preparedRetimeRuns'] == 2
other = copy.deepcopy(follow); other['clipId'] = 'other-rate'
other['placement'] = selection(0, Fraction(60000*10, 9)+Fraction(1, 4))
other_pcm, _ = run('fractional-collision-other', request(other, path))
assert follow_pcm != other_pcm
combined, receipt = run('fractional-collision-combined', plan([follow, other], 0, follow['sampleRange']['end'], path))
assert combined == sum_pcm(follow_pcm, other_pcm)
assert receipt['sourceWork']['preparedRetimeRuns'] == 2

# Stateful processing sees the same complete stereo follow run even when its
# preparation prefix is outside the requested output view.
state_clip = retained(731, 61205, 44100, Fraction(9, 10), Fraction(17, 3))
state_value = request(state_clip, out / 'tone-44100-2.wav')
bounds = state_clip['sampleRange']
state_value['processing'][0]['steps'] = [{'id': 'denoise', 'enabled': True,
    'processor': {'type': 'rnnoise', 'active': [bounds]}}]
state_value['state'] = {
    'implementationId': 'rnnoise-70f1d256-d6021b7697677c4d2274c912975e143765552b0e6f25500aa660fdb4a9849be5-f480-s32768-flush2-delay960-independent-channels-v2',
    'clips': [copy.deepcopy(state_clip)], 'processing': state_value['processing'],
    'domains': [{'sampleRange': bounds, 'dependencies': [], 'members': [
        {'target': {'kind': 'clip', 'id': 'c'}, 'stepId': 'denoise', 'sampleRange': bounds}]}],
    'formats': [{'assetId': 'a', 'streamId': 'track:1', 'sampleRate': 44100, 'channels': 2}]}
wet, receipt = run('state-stereo-full', state_value)
assert receipt['sourceWork']['preparedRetimeRuns'] == 1
state_value = copy.deepcopy(state_value)
mid = (bounds['start']+bounds['end'])//2
state_value['range'] = span(mid, bounds['end'])
state_value['clips'][0]['sampleRange'] = state_value['range']
state_value['clips'][0]['available'] = [state_value['range']]
late, receipt = run('state-stereo-late', state_value)
assert late == wet[(mid-bounds['start'])*8:]
assert receipt['sourceWork']['preparedRetimeRuns'] == 1

# The adapter is bounded while the request-owned scratch file grows with duration.
# Each native process measures its own resident peak; source generation is outside it.
peaks = []
second = tone(48000, 48000, 1).tobytes()
for seconds in [60, 600]:
    frames = seconds*48000
    path = out / f'long-{seconds}-input.wav'
    wave(path, second*seconds, 48000, 1)
    data, receipt = run(f'long-{seconds}', request(retained(0, frames, 48000, Fraction(9, 10)), path))
    assert receipt['frames'] == frames*10//9
    peaks.append(receipt['peakResidentBytes'])
    del data
assert peaks[1] <= peaks[0]+32*1024*1024, peaks
report['scale'] = {'seconds': [60, 600], 'peakResidentBytes': peaks, 'allowanceBytes': 32*1024*1024}

# Cancellation is observed while preparation owns scratch and never publishes.
value = request(retained(0, 600*48000, 48000, Fraction(9, 10)), path)
value['output'] = str(out / 'cancelled.wav')
request_path = out / 'cancelled.json'; request_path.write_text(json.dumps(value))
result = subprocess.run([str(worker), str(request_path), '--cancel-during-preparation'],
    capture_output=True, text=True, timeout=30)
assert result.returncode == 0, result.stderr
assert not Path(value['output']).exists() and not list(out.glob('.retime-*'))
report['cancellation'] = result.stdout.strip()

(out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'checks': len(report['checks']), 'report': str(out / 'report.json')}))
