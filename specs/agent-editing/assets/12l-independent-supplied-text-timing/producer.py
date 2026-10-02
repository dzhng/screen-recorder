"""One whole-source format bridge, finite conversion and supplied-text alignment."""
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import struct
import subprocess
import sys
import time
import traceback

root = Path(__file__).resolve().parents[4]
asset = Path(__file__).resolve().parent
ns = Path('/Users/david/.cache/screen-recorder/verification/sentence-alignment-12i-beecd927')
corpus = Path('/Users/david/.codex/artifacts/screen-recorder/speech-corpora/l2-arctic-public-example')
out = Path('/Users/david/.codex/artifacts/screen-recorder/speech-corpora/l2-arctic-alignment-timing-12l')
out.mkdir(exist_ok=False)
for folder in ['cache', 'temp']:
    (out / folder).mkdir()
worker = Path('/tmp/screenrec-09c-native-presented-worker')
source = corpus / 'lxc_arctic_a0018.wav'
raw_path = root / 'specs/agent-editing/assets/12k-independent-word-timing/continuation-recognition.raw.jsonl'
first_report = Path('/Users/david/.codex/artifacts/screen-recorder/speech-corpora/l2-arctic-word-timing-12k/report.json')
bridge, converted, candidate = out / 'source-float32.wav', out / 'source16k.wav', out / 'candidate'
prep = json.loads((ns / 'evidence/report.json').read_text())
with gzip.open(ns / 'evidence/runtime-files.json.gz', 'rt') as stream:
    runtime_inventory = json.load(stream)
model_files = [dict(row, path=str(ns / 'model' / row['path'])) for row in prep['model']['files']]

def pin(path):
    path = Path(path)
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    return {'path': str(path), 'bytes': path.stat().st_size, 'sha256': digest}

def save(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n')

protected = [worker, source, corpus / 'lxc_arctic_a0018.TextGrid', corpus / 'qualification.json',
    corpus / 'frozen.json', raw_path, first_report, ns / 'evidence/report.json', ns / 'case/report.json',
    ns / 'candidate/result.json', ns / 'candidate/manifest.json', ns / 'alignment-float16.py',
    ns / 'evidence/runtime-files.json.gz', asset / 'producer.py', asset / 'score.mjs',
    asset / 'editing/speech/alignment-float16.py', asset / 'editing/model_inventory.py',
    root / 'packages/test-harness/speech/evaluate.mjs', root / 'packages/test-harness/editing/model_inventory.py',
    root / 'packages/test-harness/editing/speech/alignment-probe.py',
    root / 'specs/agent-editing/slices/12l-independent-supplied-text-timing.md']
report = {'scope': 'One fixed independent supplied-text timing characterization; no adoption/full quality/performance verdict',
    'producer': pin(__file__), 'hostPython': pin(Path(sys.executable).resolve()),
    'command': {'argv': sys.argv, 'cwd': str(Path.cwd())}, 'namespace': str(ns),
    'children': [], 'requests': [], 'bounds': {'nativeSeconds': 180, 'alignmentSeconds': 900,
    'stdioBytes': 8388608, 'resourceBytes': 4 * 1024**3, 'retry': False},
    'modelFiles': model_files, 'runtimeInventory': pin(ns / 'evidence/runtime-files.json.gz'),
    'runner': pin(asset / 'editing/speech/alignment-float16.py'),
    'inventoryOwner': pin(asset / 'editing/model_inventory.py')}

def snapshots():
    pins = [pin(path) for path in protected]
    models = [pin(row['path']) for row in model_files]
    assert models == model_files, 'Model bytes changed'
    for row in runtime_inventory:
        path = ns / row['path']
        if 'symlink' in row:
            assert path.is_symlink() and str(path.readlink()) == row['symlink'], str(path)
        else:
            actual = pin(path)
            assert (actual['bytes'], actual['sha256']) == (row['bytes'], row['sha256']), str(path)
    expected = {row['path'] for row in runtime_inventory}
    actual = {str(path.relative_to(ns)) for folder in ['python', 'venv']
        for path in (ns / folder).rglob('*') if path.is_file() or path.is_symlink()}
    assert actual == expected, 'Runtime file set changed'
    return {'protected': pins, 'model': models, 'runtime': {'members': len(expected),
        'allByteAndSymlinkIdentitiesEqual': True, 'inventory': report['runtimeInventory']}}

def wav(path, code, rate, frames):
    data = path.read_bytes()
    assert data[:4] == b'RIFF' and data[8:12] == b'WAVE'
    assert struct.unpack_from('<I', data, 4)[0] + 8 == len(data)
    pos, fmt, payload = 12, None, None
    while pos + 8 <= len(data):
        tag, length = data[pos:pos+4], struct.unpack_from('<I', data, pos+4)[0]
        assert pos + 8 + length <= len(data)
        body = data[pos+8:pos+8+length]
        if tag == b'fmt ':
            fmt = struct.unpack_from('<HHIIHH', body)
        if tag == b'data':
            assert payload is None
            payload = body
        pos += 8 + length + length % 2
    bits = 16 if code == 1 else 32
    assert fmt == (code, 1, rate, rate * bits//8, bits//8, bits), str(fmt)
    assert payload is not None and len(payload) == frames * bits//8
    if code == 3:
        assert all(math.isfinite(v[0]) for v in struct.iter_unpack('<f', payload))
    return {'file': pin(path), 'format': {'code': code, 'channels': 1, 'sampleRate': rate,
        'frames': frames, 'bits': bits}, 'payloadBytes': len(payload),
        'payloadSha256': hashlib.sha256(payload).hexdigest()}, payload

env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1',
    HF_HOME=str(out / 'cache/huggingface'), HF_MODULES_CACHE=str(out / 'cache/modules'),
    TORCH_HOME=str(out / 'cache/torch'), NUMBA_CACHE_DIR=str(out / 'cache/numba'),
    XDG_CACHE_HOME=str(out / 'cache'), TMPDIR=str(out / 'temp'))
profile = '(version 1)(allow default)(deny network*)(deny file-write* (subpath "/Users/david/.cache/screen-recorder/verification"))(deny file-write* (subpath "' + str(corpus) + '"))'
sandbox = ['/usr/bin/sandbox-exec', '-p', profile]
report['environment'] = {key: env[key] for key in ['PYTHONDONTWRITEBYTECODE', 'HF_HUB_OFFLINE',
    'TRANSFORMERS_OFFLINE', 'HF_HOME', 'HF_MODULES_CACHE', 'TORCH_HOME', 'NUMBA_CACHE_DIR', 'XDG_CACHE_HOME', 'TMPDIR']}
report['sandbox'] = profile

def run(name, command, ceiling, request=None):
    stdout_path, stderr_path = out / (name + '.stdout'), out / (name + '.stderr')
    with stdout_path.open('wb') as stdout, stderr_path.open('wb') as stderr:
        child = subprocess.Popen(command, cwd=out, env=env, stdout=stdout, stderr=stderr,
            stdin=subprocess.PIPE if request is not None else subprocess.DEVNULL, start_new_session=True)
        event = {'name': name, 'pid': child.pid, 'command': command, 'ceilingSeconds': ceiling,
            'startedAt': time.time()}
        report['children'].append(event)
        save('report.json', report)
        print(json.dumps({'event': 'child-started', **event}), flush=True)
        started, failure = time.monotonic(), None
        if request is not None:
            report['requests'].append(request)
            raw = (json.dumps(request) + '\n').encode()
            (out / (name + '.stdin')).write_bytes(raw)
            save('report.json', report)
            try:
                child.stdin.write(raw)
                child.stdin.close()
            except BrokenPipeError as error:
                failure = str(error)
        while True:
            pid, status, usage = os.wait4(child.pid, os.WNOHANG)
            if pid:
                break
            if failure is None and time.monotonic() - started > ceiling:
                failure = 'Operational deadline'
            if failure is None and max(stdout_path.stat().st_size, stderr_path.stat().st_size) > 8388608:
                failure = 'Stdout/stderr bound'
            if failure is not None:
                os.killpg(child.pid, signal.SIGKILL)
                _, status, usage = os.wait4(child.pid, 0)
                break
            time.sleep(0.1)
        child.returncode = os.waitstatus_to_exitcode(status)
        event.update(exitCode=child.returncode, signal=signal.Signals(-child.returncode).name if child.returncode < 0 else None,
            closedAt=time.time(), wallSeconds=time.monotonic()-started, failure=failure,
            peakResidentBytes=usage.ru_maxrss, peakResidentUnit='macOS wait4 bytes')
    event['stdout'], event['stderr'] = pin(stdout_path), pin(stderr_path)
    save('report.json', report)
    print(json.dumps({'event': 'child-terminal', **event}), flush=True)
    assert failure is None and child.returncode == 0, f'{name} failed; original output retained'
    if request is None:
        return event
    response = json.loads(stdout_path.read_text())
    report.setdefault('replies', []).append(response)
    save('report.json', report)
    assert response['ok'] and response['id'] == request['id'], response
    return response['data']

try:
    report['before'] = snapshots()
    assert report['before']['protected'][0]['sha256'] == '0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928'
    generic = (root / 'packages/test-harness/editing/speech/alignment-probe.py').read_text()
    assert (asset / 'editing/speech/alignment-float16.py').read_text() == generic.replace('dtype=torch.float32', 'dtype=torch.float16').replace("'dtype': 'float32'", "'dtype': 'float16'")
    assert (asset / 'editing/model_inventory.py').read_bytes() == (root / 'packages/test-harness/editing/model_inventory.py').read_bytes()
    report['source'], original_pcm = wav(source, 1, 44100, 71508)
    raw = json.loads(raw_path.read_text())
    assert pin(raw_path)['sha256'] == 'd32f2fb3b47464de8b4c856aafcd72fd2b61bec35ca74525e4a11589cd2112f1'
    supplied = [{'type': 'word', 'text': word['text']} for word in raw['words']]
    assert len(supplied) == 5
    save('supplied-text.json', supplied)
    report['suppliedText'] = pin(out / 'supplied-text.json')
    support = {'startUs': 0, 'endUs': {'numerator': 238360000, 'denominator': 147}}
    probe = json.loads(first_report.read_text())['exchanges'][0]
    assert probe['request']['params']['path'] == str(source)
    assert probe['reply']['data']['streams'][0]['endUs'] == support['endUs']
    result = run('bridge', [*sandbox, str(worker)], 180, {'id': '12l-bridge', 'operation': 'media.sourceAudio', 'params': {
        'source': {'source': str(source), 'streamId': 'track:1', 'sourceOffsetUs': 0, 'available': [support]},
        'range': support, 'output': str(bridge)}})
    assert result['range'] == support and result['sampleRange'] == {'start': 0, 'end': 71508}
    assert result['frames'] == 71508 and result['decodedFrames'] == 71508
    assert result['sampleRate'] == 44100 and result['channels'] == 1 and result['layout'] == 'mono'
    assert result['unavailable'] == [] and result['file'] == str(bridge)
    report['bridge'], float_pcm = wav(bridge, 3, 44100, 71508)
    assert result['bytes'] == report['bridge']['file']['bytes']
    expected = b''.join(struct.pack('<f', value[0]/32768) for value in struct.iter_unpack('<h', original_pcm))
    assert float_pcm == expected, 'Every original source sample must survive the format bridge exactly'
    report['bridge']['all71508SamplesExactlyInt16Div32768'] = True
    save('report.json', report)
    result = run('conversion', [*sandbox, str(worker)], 180, {'id': '12l-conversion', 'operation': 'media.convertSelectedAudio', 'params': {
        'source': str(bridge), 'output': str(converted), 'sampleRate': 16000, 'channels': 1}})
    assert result['input'] == {'sampleRate': 44100, 'channels': 1, 'frames': 71508}
    assert result['output'] == {'sampleRate': 16000, 'channels': 1, 'frames': 25943}
    assert result['contextPolicy'] == 'complete-selected-pcm-zero-origin' and result['channelPolicy'] == 'preserve'
    assert result['implementationId'] == 'native-finite-pcm-v1' and result['file'] == str(converted)
    report['converted'], _ = wav(converted, 3, 16000, 25943)
    assert result['bytes'] == report['converted']['file']['bytes']
    report['clock'] = {'originalFrames': 71508, 'originalRate': 44100, 'sourceSupport': support,
        'outputFrames': 25943, 'outputRate': 16000, 'outputDurationSeconds': 25943/16000,
        'sourceEndDifferenceSeconds': 71508/44100-25943/16000, 'savedAsrFrames': raw['samples'],
        'internalAsrPcmByteEquivalence': False}
    save('report.json', report)
    alignment = run('alignment', [*sandbox, str(ns / 'venv/bin/python'), '-B', str(asset / 'editing/speech/alignment-float16.py'),
        '--model', str(ns / 'model'), '--audio', str(converted), '--transcript', str(out / 'supplied-text.json'), '--out', str(candidate)], 900)
    manifest = json.loads((candidate / 'manifest.json').read_text())
    report['candidateResult'] = pin(candidate / 'result.json')
    report['candidateManifest'] = manifest
    assert manifest['audioSha256'] == report['converted']['file']['sha256']
    assert manifest['transcriptSha256'] == report['suppliedText']['sha256']
    assert manifest['suppliedTextSha256'] == hashlib.sha256(' '.join(row['text'] for row in supplied).encode()).hexdigest()
    assert manifest['runnerSha256'] == report['runner']['sha256']
    assert manifest['modelInventorySha256'] == report['inventoryOwner']['sha256']
    assert manifest['modelFiles'] == prep['model']['files'] and manifest['runtime'] == prep['runtime']['versions']
    assert manifest['settings'] == {'device': 'mps', 'dtype': 'float16', 'language': 'English'}
    report['resource'] = {'kernelPeakResidentBytes': alignment['peakResidentBytes'], 'runnerPeakResidentBytes': manifest['peakResidentBytes'],
        'ceilingBytes': 4*1024**3, 'meets': max(alignment['peakResidentBytes'], manifest['peakResidentBytes']) <= 4*1024**3}
    assert report['resource']['meets'], 'Existing4GiB resource criterion failed'
    report['state'] = 'Alignment complete; independent timing scoring pending'
except BaseException as error:
    report['state'] = 'Fixed case failed; no retry'
    report['error'] = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
finally:
    try:
        report['after'] = snapshots()
        assert report['after'] == report['before']
        report['preserved'] = True
    except BaseException as error:
        report['preserved'] = False
        report['preservationError'] = {'message': str(error), 'traceback': traceback.format_exc()}
    save('report.json', report)
    print(json.dumps({'event': 'case-terminal', 'state': report['state'], 'preserved': report['preserved'], 'error': report.get('error')}), flush=True)
    if report.get('error') or not report['preserved']:
        sys.exit(1)
