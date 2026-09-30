"""Native retained-run proof against frozen accepted mono PCM. Uses isolated output directory."""
from pathlib import Path
from fractions import Fraction
import hashlib
import json
import struct
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
worker, out = (Path(x).resolve() for x in sys.argv[1:])
out.mkdir(parents=True, exist_ok=False)
asset = root / 'specs/agent-editing/assets/13a-corrected-selections'
source = asset / 'original.wav'
original = source.read_bytes()[44:]
frames = len(original) // 4
report = {'checks': []}

def time(frame):
    value = Fraction(frame * 1_000_000, 48000)
    return {'numerator': value.numerator, 'denominator': value.denominator}

def span(start, end): return {'start': start, 'end': end}
def selection(start, end): return {'startUs': time(start), 'endUs': time(end)}
def clip(name, start, end, project_start, project_end):
    return {'clipId': name, 'trackId': 't', 'sampleRange': span(project_start, project_end),
        'placement': selection(project_start, project_end),
        'source': {'kind': 'range', 'assetId': 'a', 'streamId': 'track:1', 'range': selection(start, end)},
        'pitch': 'preserve', 'available': [span(project_start, project_end)],
        'context': [{'source': selection(start, end), 'sampleRange': span(project_start, project_end)}]}

def plan(clips, start, end, path=source):
    nodes = [{'target': {'kind': 'clip', 'id': c['clipId']}, 'mediaKind': 'audio', 'inputs': [], 'steps': []} for c in clips]
    nodes += [{'target': {'kind': 'track', 'id': 't'}, 'mediaKind': 'audio',
        'inputs': [n['target'] for n in nodes], 'steps': []}]
    nodes += [{'target': {'kind': 'output'}, 'mediaKind': 'output', 'inputs': [nodes[-1]['target']], 'steps': []}]
    return {'range': span(start, end), 'clips': clips, 'processing': nodes,
        'assets': [{'assetId': 'a', 'streamId': 'track:1', 'path': str(path), 'originUs': 0}]}

def pcm(wav):
    data = wav.read_bytes(); offset = 12
    while offset < len(data):
        kind, size = struct.unpack_from('<4sI', data, offset)
        if kind == b'data': return data[offset+8:offset+8+size]
        offset += 8 + size + size % 2
    raise AssertionError('WAV has no data')

def run(name, value):
    value['output'] = str(out / (name + '.wav'))
    request = out / (name + '.json'); request.write_text(json.dumps(value))
    result = subprocess.run([str(worker), str(request)], text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    receipt = json.loads(result.stdout)
    data = pcm(Path(value['output']))
    assert len(data) == (value['range']['end'] - value['range']['start']) * 8
    assert not list(out.glob('.retime-*')) and not list(out.glob('.rnnoise-*'))
    report['checks'].append({'case': name, 'sha256': hashlib.sha256(data).hexdigest(), 'receipt': receipt})
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return data, receipt

def stereo(data): return b''.join(data[i:i+4]*2 for i in range(0, len(data), 4))

for case in json.loads((asset / 'report.json').read_text())['results']:
    name = Path(case['path']).stem
    a, b = case['sourceFrames']; n = case['declaredOutput']['frames']; end = frames+n-(b-a)
    clips = []
    if a: clips.append(clip('before', 0, a, 0, a))
    clips.append(clip('retimed', a, b, a, a+n))
    if b < frames: clips.append(clip('after', b, frames, a+n, end))
    value = plan(clips, 0, end)
    actual, receipt = run(name, value)
    assert actual == stereo((asset / case['path']).read_bytes()[44:]), name
    assert receipt['sourceWork']['preparedRetimeRuns'] == 1

# Selected-only poison ensures excluded decoder support never enters the accepted recipe.
case = json.loads((asset / 'report.json').read_text())['results'][0]
a, b = case['sourceFrames']; n = case['declaredOutput']['frames']
selected = clip('retimed', a, b, a, a+n)
clean, _ = run('selected-only', plan([selected], a, a+n))
poison = bytearray(source.read_bytes())
for i in list(range(a)) + list(range(b, frames)): struct.pack_into('<f', poison, 44+i*4, float('nan'))
poison_path = out / 'poison.wav'; poison_path.write_bytes(poison)
poisoned, _ = run('excluded-poison', plan([selected], a, a+n, poison_path))
assert poisoned == clean

# An unavailable interior source range breaks the retained run; excluded poison
# must not enter either preparation or disappear from the availability report.
removed = json.loads(json.dumps(selected))
first_end, second_start = a+20000, a+30000
project_first_end = a + (first_end-a)*n//(b-a)
project_second_start = a + (second_start-a)*n//(b-a)
removed['context'] = [
    {'source': selection(a, first_end), 'sampleRange': span(a, project_first_end)},
    {'source': selection(second_start, b), 'sampleRange': span(project_second_start, a+n)}]
removed['available'] = [part['sampleRange'] for part in removed['context']]
removed_clean, receipt = run('support-gap', plan([removed], a, a+n))
assert receipt['sourceWork']['preparedRetimeRuns'] == 2
removed_poison = bytearray(source.read_bytes())
for i in range(first_end, second_start): struct.pack_into('<f', removed_poison, 44+i*4, float('nan'))
removed_path = out / 'removed-poison.wav'; removed_path.write_bytes(removed_poison)
removed_actual, _ = run('support-gap-poison', plan([removed], a, a+n, removed_path))
assert removed_actual == removed_clean
assert removed_clean[(project_first_end-a)*8:(project_second_start-a)*8] == bytes((project_second_start-project_first_end)*8)
assert receipt['unavailable'][0]['ranges'] == [span(project_first_end, project_second_start)]

# Gain consumes prepared PCM, and a state component prepares its full upstream run
# even when its prefix lies outside the requested view.
value = plan([selected], a, a+n)
value['processing'][0]['steps'] = [{'id': 'gain', 'enabled': True, 'processor': {'type': 'gain', 'gain': 0.5}}]
gained, _ = run('gain-after-retime', value)
expected_gain = b''.join(struct.pack('<f', x[0]*0.5) for x in struct.iter_unpack('<f', clean))
assert gained == expected_gain

implementation = 'rnnoise-70f1d256-d6021b7697677c4d2274c912975e143765552b0e6f25500aa660fdb4a9849be5-f480-s32768-flush2-delay960-independent-channels-v2'
value['processing'][0]['steps'].append({'id': 'denoise', 'enabled': True,
    'processor': {'type': 'rnnoise', 'active': [span(a, a+n)]}})
value['state'] = {'implementationId': implementation, 'clips': [selected],
    'processing': value['processing'], 'domains': [{'sampleRange': span(a, a+n), 'dependencies': [],
        'members': [{'target': {'kind': 'clip', 'id': 'retimed'}, 'stepId': 'denoise', 'sampleRange': span(a, a+n)}]}],
    'formats': [{'assetId': 'a', 'streamId': 'track:1', 'sampleRate': 48000, 'channels': 1}]}
wet, receipt = run('state-full', value)
assert receipt['sourceWork']['preparedRetimeRuns'] == 1
control = json.loads(json.dumps(value))
control['assets'][0]['path'] = str(asset / case['path'])
control['clips'][0]['source']['range'] = selection(a, a+n)
control['clips'][0]['context'][0]['source'] = selection(a, a+n)
control['state']['clips'] = control['clips']
control_wet, receipt = run('state-frozen-pcm-control', control)
assert control_wet == wet
assert receipt['sourceWork']['preparedRetimeRuns'] == 0
value = json.loads(json.dumps(value))
mid = a+n//2
value['range'] = span(mid, a+n)
value['clips'][0]['sampleRange'] = span(mid, a+n)
value['clips'][0]['available'] = [span(mid, a+n)]
late, receipt = run('state-outside-view', value)
assert late == wet[(mid-a)*8:]
assert receipt['sourceWork']['preparedRetimeRuns'] == 1
cancel = plan([selected], a, a+n)
cancel['output'] = str(out / 'cancelled.wav')
request = out / 'cancelled.json'; request.write_text(json.dumps(cancel))
result = subprocess.run([str(worker), str(request), '--cancel-during-preparation'], capture_output=True, text=True, timeout=30)
assert result.returncode == 0, result.stderr
assert not Path(cancel['output']).exists() and not list(out.glob('.retime-*'))
report['cancellation'] = result.stdout.strip()
# Failed selected PCM must not expose a partially prepared run or final output.
invalid = bytearray(source.read_bytes())
struct.pack_into('<f', invalid, 44+(a+100)*4, float('nan'))
invalid_path = out / 'invalid-selected.wav'; invalid_path.write_bytes(invalid)
failed = plan([selected], a, a+n, invalid_path)
failed['output'] = str(out / 'failed.wav')
request = out / 'failed.json'; request.write_text(json.dumps(failed))
result = subprocess.run([str(worker), str(request)], capture_output=True, text=True, timeout=30)
assert result.returncode != 0, 'Selected NaN was accepted'
assert not Path(failed['output']).exists() and not list(out.glob('.retime-*'))
report['selectedFailure'] = result.stderr.strip()

(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'checks': len(report['checks']), 'report': str(out / 'report.json')}))
