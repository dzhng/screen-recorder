"""Native retained-run proof against frozen accepted mono PCM. Uses isolated output directory."""
from pathlib import Path
import json
import struct
import subprocess
import sys
sys.dont_write_bytecode = True
from composition_audio import NativeAudio, clip, plan, selection, span, stereo

root = Path(__file__).resolve().parents[3]
worker, out = (Path(x).resolve() for x in sys.argv[1:])
native = NativeAudio(worker, out)
run = native.run
asset = root / 'specs/agent-editing/assets/13a-corrected-selections'
source = asset / 'original.wav'
original = source.read_bytes()[44:]
frames = len(original) // 4
report = native.report

for case in json.loads((asset / 'report.json').read_text())['results']:
    name = Path(case['path']).stem
    a, b = case['sourceFrames']; n = case['declaredOutput']['frames']; end = frames+n-(b-a)
    clips = []
    if a: clips.append(clip('before', 0, a, 0, a))
    clips.append(clip('retimed', a, b, a, a+n))
    if b < frames: clips.append(clip('after', b, frames, a+n, end))
    value = plan(clips, 0, end, source)
    actual, receipt = run(name, value)
    assert actual == stereo((asset / case['path']).read_bytes()[44:]), name
    assert receipt['sourceWork']['preparedRetimeRuns'] == 1

# Selected-only poison ensures excluded decoder support never enters the accepted recipe.
case = json.loads((asset / 'report.json').read_text())['results'][0]
a, b = case['sourceFrames']; n = case['declaredOutput']['frames']
selected = clip('retimed', a, b, a, a+n)
clean, _ = run('selected-only', plan([selected], a, a+n, source))
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
removed_clean, receipt = run('support-gap', plan([removed], a, a+n, source))
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
value = plan([selected], a, a+n, source)
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
cancel = plan([selected], a, a+n, source)
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

# Sequential retained runs must not consume one permanent descriptor per run.
# The native process inherits the Mac launch default-sized descriptor limit.
reference, _ = run('descriptor-reference', plan([clip('one', 0, 12000, 0, 15000)], 0, 15000, source))
runs = [clip(f'run-{i}', 0, 12000, i*15000, (i+1)*15000) for i in range(300)]
many, receipt = run('descriptor-300', plan(runs, 0, 300*15000, source), descriptor_limit=256)
assert many == reference*300
assert receipt['sourceWork']['preparedRetimeRuns'] == 300
report['descriptors'] = {'limit': 256, 'runs': 300, 'fullPcmMatchesRepeatedReference': True}
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'checks': len(report['checks']), 'report': str(out / 'report.json')}))
