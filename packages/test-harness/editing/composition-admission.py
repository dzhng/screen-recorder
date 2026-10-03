"""Real NativeWire retiming admission and stereo-consumer proof in fresh scratch."""
from pathlib import Path
from fractions import Fraction
import copy
import hashlib
import json
import struct
import subprocess
import sys
sys.dont_write_bytecode = True
from composition_audio import RETIME_IMPLEMENTATION, clip, plan, pcm, selection, span

worker, references, out = (Path(x).resolve() for x in sys.argv[1:])
out.mkdir(parents=True, exist_ok=False)
report = {'workerSha256': hashlib.sha256(worker.read_bytes()).hexdigest(), 'checks': []}

def call(name, operation, params, error=None):
    request = {'id': name, 'operation': operation, 'params': params}
    response = subprocess.run([str(worker)], input=json.dumps(request)+'\n', capture_output=True, text=True, timeout=90)
    assert response.returncode == 0, response.stderr
    value = json.loads(response.stdout)
    report['checks'].append({'name': name, 'response': value})
    (out/'report.json').write_text(json.dumps(report, indent=2)+'\n')
    assert value['ok'] == (error is None), value
    if error: assert value['error']['code'] == error, value
    return value.get('data')

def wave(path, data, channels=2):
    path.write_bytes(struct.pack('<4sI4s4sIHHIIHH4sI', b'RIFF', len(data)+36, b'WAVE', b'fmt ', 16,
        3, channels, 48000, 48000*channels*4, channels*4, 32, b'data', len(data))+data)

def validate(name, value, error=None, file=False):
    value = copy.deepcopy(value)
    # Admission has no reason to create the destination or its missing parent.
    value['output'] = str(out/'must-not-exist'/(name+'.wav'))
    if file:
        path = out/(name+'.json'); path.write_text(json.dumps(value)); value = {'planFile': str(path)}
    result = call(name, 'media.validateCompositionAudio', value, error)
    assert not (out/'must-not-exist').exists()
    assert not any(p.name.startswith(('.retime-', '.rnnoise-', '.screenrec-output-')) for p in out.iterdir())
    if not error: assert result == {'retime': RETIME_IMPLEMENTATION}, result

cap = call('capability', 'media.audioCapabilities', {})
assert cap['retime'] == RETIME_IMPLEMENTATION
frozen = json.loads((Path(__file__).resolve().parents[3]/'specs/done/agent-editing/assets/14c-stereo-stretch/reference.json').read_text())
for name in ['correlated', 'antiphase', 'distinct-tones', 'coupled-mixture', 'channel-events', 'silent-right']:
    source = out/(name+'.wav'); raw = (references/(name+'-input.f32')).read_bytes(); wave(source, raw)
    for ratio in ['5-4', '4-5']:
        key = name+'-'+ratio; reference = frozen[key]
        assert hashlib.sha256(raw).hexdigest() == reference['inputSha256']
        first, count, wanted = reference['firstFrame'], reference['inputFrames'], reference['outputFrames']
        value = plan([clip('c', first, first+count, 0, wanted)], 0, wanted, source)
        validate(key+'-admit', value, file=ratio=='4-5')
        value['output'] = str(out/(key+'.wav'))
        call(key+'-render', 'media.mixCompositionAudio', value)
        expected = (references/(key+'-reference.f32')).read_bytes()
        assert hashlib.sha256(expected).hexdigest() == reference['sha256']
        # The graph's existing addition normalizes negative zero in each lane.
        expected = b''.join(bytes(4) if x == b'\x00\x00\x00\x80' else x for x in (expected[i:i+4] for i in range(0,len(expected),4)))
        assert pcm(Path(value['output'])) == expected, key

source = out/'distinct-tones.wav'
value = plan([clip('c', 137, 95743, 0, 119507)], 0, 119507, source)
for binding in [None, 'retime-other-version']:
    bad = copy.deepcopy(value)
    if binding is None: bad.pop('retimeImplementationId')
    else: bad['retimeImplementationId'] = binding
    validate('missing-binding' if binding is None else 'wrong-binding', bad, 'NOT_READY')
    bad['output'] = str(out/'rejected.wav')
    call('reject-execution-'+str(binding), 'media.mixCompositionAudio', bad, 'NOT_READY')
    assert not Path(bad['output']).exists()
unit = plan([clip('c',0,100,0,100)], 0,100,source); unit.pop('retimeImplementationId')
validate('unit-unbound', unit)
for channels in [1,2]:
    tiny_source = out/f'tiny-{channels}.wav'; wave(tiny_source, bytes(100*channels*4), channels)
    tiny = plan([clip('c',0,100,0,125)], 0,125,tiny_source)
    validate(f'short-preserve-{channels}', tiny, 'NOT_READY', file=True)
    physical = plan([clip('c',0,96000,0,120000)],0,120000,tiny_source)
    validate(f'short-physical-support-{channels}', physical, 'NOT_READY')
    tiny['clips'][0]['pitch'] = 'follow'
    validate(f'short-follow-{channels}', tiny)

# A two-lane file with a discrete layout must not silently become conventional stereo.
discrete = out/'discrete.caf'
fixture = subprocess.run(['swift', '-', str(discrete)], input='''
import AVFoundation
let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48000, interleaved: true,
    channelLayout: AVAudioChannelLayout(layoutTag: kAudioChannelLayoutTag_DiscreteInOrder | 2)!)
let file = try AVAudioFile(forWriting: URL(fileURLWithPath: CommandLine.arguments[1]), settings: format.settings,
    commonFormat: .pcmFormatFloat32, interleaved: true)
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 48000)!
buffer.frameLength = 48000
for i in 0..<96000 { buffer.floatChannelData![0][i] = 0 }
try file.write(from: buffer)
''', capture_output=True, text=True, timeout=60)
assert fixture.returncode == 0, fixture.stderr
for pitch in ['preserve', 'follow']:
    unconventional = plan([clip('c',0,48000,0,60000)],0,60000,discrete)
    unconventional['clips'][0]['pitch'] = pitch
    validate('discrete-'+pitch,unconventional,'UNSUPPORTED_FORMAT')
# Opening this source for an earlier unit-rate clip must not skip retiming validation.
mixed = plan([clip('unit',0,48000,0,48000),clip('retime',0,48000,48000,108000)],0,108000,discrete)
validate('unit-before-discrete-retime',mixed,'UNSUPPORTED_FORMAT')

# Native metadata resolves each policy/channel combination from the real stream.
for channels in [1, 2]:
    path = out/f'metadata-{channels}.wav'; wave(path, bytes(96000*channels*4), channels)
    for pitch in ['preserve', 'follow']:
        metadata = plan([clip('c',137,95743,0,119507)],0,119507,path)
        metadata['clips'][0]['pitch'] = pitch
        validate(f'metadata-{channels}-{pitch}',metadata)

# The ordinary window is unit rate; a short retimed RNNoise prerequisite is outside it.
state = plan([clip('state',0,100,0,125)],0,125,source)
state['processing'][0]['steps'] = [{'id':'denoise','enabled':True,
    'processor':{'type':'rnnoise','active':[span(0,125)]}}]
hidden = plan([clip('c',1000,1100,1000,1100)],1000,1100,source)
hidden['state'] = {'implementationId':cap['rnnoise'], 'clips':state['clips'], 'processing':state['processing'],
    'domains':[{'sampleRange':span(0,125),'dependencies':[], 'members':[{'target':{'kind':'clip','id':'state'},
        'stepId':'denoise','sampleRange':span(0,125)}]}],
    'formats':[{'assetId':'a','streamId':'track:1','sampleRate':48000,'channels':2}]}
validate('short-hidden-state',hidden,'NOT_READY')
# Equal quantized counts stay on the exact adapter's bit-preserving identity path,
# even when the authored exact duration differs by less than one frame.
identity = plan([clip('c',0,100,0,Fraction(1001,10))],0,100,source)
identity['clips'][0]['sampleRange'] = span(0,100)
identity['clips'][0]['available'] = [span(0,100)]
identity['clips'][0]['context'][0]['sampleRange'] = span(0,100)
validate('short-equal-count',identity)

# Every retained piece must be supported, even when the aggregate is long.
pieces = copy.deepcopy(value)
pieces['clips'][0]['context'] = [{'source':selection(137,237), 'sampleRange':span(0,124)},
    {'source':selection(937,95743), 'sampleRange':span(999,119507)}]
validate('short-retained-piece', pieces, 'NOT_READY')
# Valid metadata containing selected nonfinite samples is admitted without decoding.
poison = out/'selected-nan.wav'; wave(poison, struct.pack('<ff',float('nan'),0)*96000)
poison_plan = copy.deepcopy(value); poison_plan['assets'][0]['path'] = str(poison)
validate('metadata-only-selected-nan', poison_plan)
poison_plan['output'] = str(out/'nan-output.wav')
call('decode-rejects-selected-nan', 'media.mixCompositionAudio', poison_plan, 'INVALID_REQUEST')
assert not Path(poison_plan['output']).exists()
assert not any(p.name.startswith(('.retime-', '.rnnoise-', '.screenrec-output-')) for p in out.iterdir())
print(json.dumps({'checks':len(report['checks']), 'report':str(out/'report.json')}))
