"""Native composition plan fixtures and complete-PCM receipt runner."""
from pathlib import Path
from fractions import Fraction
import hashlib
import json
import struct
import resource
import subprocess

RETIME_IMPLEMENTATION = "retime-signalsmith-a670068d9aeb64913331d5cc29337b19a457a7df-exact-joint-48k-p1-follow-avconverter-rational-v1"

def time(frame):
    value = Fraction(frame * 1_000_000, 48000)
    return value.numerator if value.denominator == 1 else {'numerator': value.numerator, 'denominator': value.denominator}

def span(start, end): return {'start': start, 'end': end}
def selection(start, end): return {'startUs': time(start), 'endUs': time(end)}
def clip(name, start, end, project_start, project_end):
    return {'clipId': name, 'trackId': 't', 'sampleRange': span(project_start, project_end),
        'placement': selection(project_start, project_end),
        'source': {'kind': 'range', 'assetId': 'a', 'streamId': 'track:1', 'range': selection(start, end)},
        'pitch': 'preserve', 'available': [span(project_start, project_end)],
        'context': [{'source': selection(start, end), 'sampleRange': span(project_start, project_end)}]}

def plan(clips, start, end, path):
    nodes = [{'target': {'kind': 'clip', 'id': c['clipId']}, 'mediaKind': 'audio', 'inputs': [], 'steps': []} for c in clips]
    nodes += [{'target': {'kind': 'track', 'id': 't'}, 'mediaKind': 'audio',
        'inputs': [n['target'] for n in nodes], 'steps': []}]
    nodes += [{'target': {'kind': 'output'}, 'mediaKind': 'output', 'inputs': [nodes[-1]['target']], 'steps': []}]
    return {'retimeImplementationId': RETIME_IMPLEMENTATION, 'range': span(start, end), 'clips': clips, 'processing': nodes,
        'assets': [{'assetId': 'a', 'streamId': 'track:1', 'path': str(path), 'originUs': 0}]}

def pcm(wav):
    data = wav.read_bytes(); offset = 12
    while offset < len(data):
        kind, size = struct.unpack_from('<4sI', data, offset)
        if kind == b'data': return data[offset+8:offset+8+size]
        offset += 8 + size + size % 2
    raise AssertionError('WAV has no data')

def stereo(data): return b''.join(data[i:i+4]*2 for i in range(0, len(data), 4))

class NativeAudio:
    def __init__(self, worker, out, wire=False):
        self.worker, self.out, self.wire = worker, out, wire
        out.mkdir(parents=True, exist_ok=False)
        self.report = {'workerSha256': hashlib.sha256(worker.read_bytes()).hexdigest(), 'checks': []}

    def run(self, name, value, descriptor_limit=None):
        value['output'] = str(self.out / (name + '.wav'))
        request = self.out / (name + '.json'); request.write_text(json.dumps(value))
        def limit_descriptors():
            resource.setrlimit(resource.RLIMIT_NOFILE, (descriptor_limit, descriptor_limit))
        if self.wire:
            message = {'id': name, 'operation': 'media.mixCompositionAudio', 'params': {'planFile': str(request)}}
            result = subprocess.run([str(self.worker)], input=json.dumps(message)+'\n',
                text=True, capture_output=True, timeout=90,
                preexec_fn=limit_descriptors if descriptor_limit is not None else None)
            (self.out / (name + '-response.json')).write_text(result.stdout)
            assert result.returncode == 0, result.stderr
            response = json.loads(result.stdout)
            assert response['ok'], response
            receipt = response['data']
        else:
            result = subprocess.run([str(self.worker), str(request)], text=True, capture_output=True, timeout=90,
                preexec_fn=limit_descriptors if descriptor_limit is not None else None)
            assert result.returncode == 0, result.stderr
            receipt = json.loads(result.stdout)
        data = pcm(Path(value['output']))
        assert len(data) == (value['range']['end'] - value['range']['start']) * 8
        assert not list(self.out.glob('.retime-*')) and not list(self.out.glob('.rnnoise-*'))
        self.report['checks'].append({'case': name, 'sha256': hashlib.sha256(data).hexdigest(), 'receipt': receipt})
        (self.out / 'report.json').write_text(json.dumps(self.report, indent=2) + '\n')
        return data, receipt

