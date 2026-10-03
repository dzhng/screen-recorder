"""One fixed conversion and supplied-text alignment; no inference retry or adoption."""
import argparse
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

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--namespace', type=Path, required=True)
args = parser.parse_args()
root, ns = args.root.resolve(), args.namespace.resolve()
out = ns / 'case'
out.mkdir(exist_ok=False)
for folder in ['cache', 'temp']:
    (out / folder).mkdir()
worker = Path('/private/tmp/screenrec-09c-native-presented-worker')
input_wav = root / 'specs/agent-editing/assets/12d-complete-sentence/original.wav'
converted = ns / 'input/sentence16k.wav'
candidate = ns / 'candidate'
assert not converted.exists() and not candidate.exists(), 'Use fresh outputs; never repeat this case'

def save(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n')

def pin(path):
    path = Path(path)
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    return {'path': str(path), 'bytes': path.stat().st_size, 'sha256': digest}

prep = json.loads((ns / 'evidence/report.json').read_text())
prior = json.loads((ns / 'evidence/before.json').read_text())
recognition = Path('/Users/david/.cache/screen-recorder/verification/sentence-12h-2591aa28/evidence')
old_report = json.loads((recognition / 'report.json').read_text())
protected = [prior['raw'], prior['input'], *prior['nativeSources'], *prior['voiceMetadata'],
             prior['pythonSourceBinary'], prior['hf'], prior['hfMetadata'], prior['uv'],
             *old_report['before']]
protected = list({entry['path']: entry for entry in protected}.values())
for path in [recognition / 'evaluation.json', recognition / 'report.json',
             root / 'specs/agent-editing/assets/12d-human-marks/human-marks.json',
             root / 'packages/test-harness/editing/speech/boundaries.mjs']:
    protected.append(pin(path))
expected_models = [dict(entry, path=str(ns / 'model' / entry['path'])) for entry in prep['model']['files']]
with gzip.open(ns / 'evidence/runtime-files.json.gz', 'rt') as stream:
    runtime_inventory = json.load(stream)
report = {'scope': 'One fixed supplied-text sentence timing diagnostic; not ASR/adoption/quality acceptance',
          'producer': pin(Path(__file__).resolve()), 'hostPython': pin(Path(sys.executable).resolve()),
          'command': {'argv': sys.argv, 'cwd': str(Path.cwd())}, 'namespace': str(ns),
          'children': [], 'conversionAttempts': 0, 'alignmentAttempts': 0,
          'runner': pin(ns / 'alignment-float16.py'), 'modelFiles': expected_models,
          'runtimeInventory': pin(ns / 'evidence/runtime-files.json.gz'),
          'suppliedText': pin(ns / 'input/supplied-text.json'), 'adoption': False}

def check_files(expected):
    actual = [pin(entry['path']) for entry in expected]
    assert actual == expected, 'Pinned original/model/source authority changed'
    return actual

def check_runtime():
    paths = set()
    for entry in runtime_inventory:
        path = ns / entry['path']
        paths.add(entry['path'])
        if 'symlink' in entry:
            assert path.is_symlink() and str(path.readlink()) == entry['symlink']
        else:
            actual = pin(path)
            assert actual['bytes'] == entry['bytes'] and actual['sha256'] == entry['sha256'], str(path)
    actual_paths = {str(path.relative_to(ns)) for folder in ['python', 'venv']
                    for path in (ns / folder).rglob('*') if path.is_file() or path.is_symlink()}
    assert paths == actual_paths, 'Runtime file set changed'
    return {'members': len(paths), 'allBytesAndSymlinksEqual': True, 'inventory': report['runtimeInventory']}

def wav_receipt(path, rate, frames):
    data = path.read_bytes()
    assert data[:4] == b'RIFF' and data[8:12] == b'WAVE'
    assert struct.unpack_from('<I', data, 4)[0] + 8 == len(data)
    pos, fmt, payload = 12, None, None
    while pos + 8 <= len(data):
        name, count = data[pos:pos + 4], struct.unpack_from('<I', data, pos + 4)[0]
        assert pos + 8 + count <= len(data)
        body = data[pos + 8:pos + 8 + count]
        if name == b'fmt ':
            fmt = struct.unpack_from('<HHIIHH', body)
        if name == b'data':
            assert payload is None
            payload = body
        pos += 8 + count + count % 2
    assert fmt == (3, 1, rate, rate * 4, 4, 32), str(fmt)
    assert payload is not None and len(payload) == frames * 4
    assert all(math.isfinite(value[0]) for value in struct.iter_unpack('<f', payload))
    return {'file': pin(path), 'format': {'code': 3, 'channels': 1, 'sampleRate': rate,
            'sampleFormat': 'Float32', 'frames': frames}, 'payloadBytes': len(payload),
            'payloadSha256': hashlib.sha256(payload).hexdigest(),
            'sourceSupport': {'startUs': 0, 'endUs': 7140000}}

def run(name, command, ceiling, env, request=None):
    with (out / (name + '.stdout')).open('wb') as stdout, (out / (name + '.stderr')).open('wb') as stderr:
        child = subprocess.Popen(command, cwd=ns, env=env, stdout=stdout, stderr=stderr,
                                 stdin=subprocess.PIPE if request is not None else subprocess.DEVNULL,
                                 start_new_session=True)
        event = {'name': name, 'pid': child.pid, 'command': command, 'ceilingSeconds': ceiling,
                 'startedAt': time.time()}
        report['children'].append(event)
        save('report.json', report)
        print(json.dumps({'event': 'child-started', **event}), flush=True)
        started, exceeded = time.monotonic(), False
        if request is not None:
            request_bytes = (json.dumps(request) + '\n').encode()
            (out / (name + '.stdin')).write_bytes(request_bytes)
            try:
                child.stdin.write(request_bytes)
                child.stdin.close()
            except BrokenPipeError as error:
                event['stdinError'] = str(error)
        while True:
            pid, status, usage = os.wait4(child.pid, os.WNOHANG)
            if pid:
                break
            if time.monotonic() - started > ceiling and not exceeded:
                exceeded = True
                os.killpg(child.pid, signal.SIGKILL)
            time.sleep(0.1)
        child.returncode = os.waitstatus_to_exitcode(status)
        event.update(exitCode=child.returncode, signal=signal.Signals(-child.returncode).name if child.returncode < 0 else None, closedAt=time.time(),
                     wallSeconds=time.monotonic() - started, deadlineExceeded=exceeded,
                     peakResidentBytes=usage.ru_maxrss, peakResidentUnit='macOS wait4 bytes')
        save('report.json', report)
        print(json.dumps({'event': 'child-terminal', **event}), flush=True)
        assert not exceeded and child.returncode == 0 and 'stdinError' not in event, f'{name} failed; retained stderr'
        return event

try:
    report['before'] = check_files(protected)
    report['modelBefore'] = check_files(expected_models)
    report['runtimeBefore'] = check_runtime()
    assert report['runner']['sha256'] == '25c06832ddac53f7080520887e10642df36047629ec3ea7b924c54c6af3b53b3'
    assert pin(worker)['sha256'] == '0a9cd72a62af990a2bccef585184df0a2bbc36220a2fc258e0198ee43d726928'
    report['worker'] = pin(worker)
    report['input'] = wav_receipt(input_wav, 48000, 342720)
    raw = json.loads((recognition / 'raw.jsonl').read_text())
    supplied = json.loads((ns / 'input/supplied-text.json').read_text())
    assert supplied == [{'type': 'word', 'text': word['text']} for word in raw['words']]
    assert len(supplied) == 14
    assert pin(ns / 'input/supplied-text.json')['sha256'] == prep['suppliedText']['sha256']
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1',
               HF_HOME=str(out / 'cache/huggingface'), HF_MODULES_CACHE=str(out / 'cache/modules'),
               TORCH_HOME=str(out / 'cache/torch'), NUMBA_CACHE_DIR=str(out / 'cache/numba'),
               XDG_CACHE_HOME=str(out / 'cache'), TMPDIR=str(out / 'temp'))
    sandbox = ['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network*)']
    request = {'id': '12i-conversion', 'operation': 'media.convertSelectedAudio', 'params': {
        'source': str(input_wav), 'output': str(converted), 'sampleRate': 16000, 'channels': 1}}
    save('conversion-request.json', request)
    report['conversionAttempts'] += 1
    run('conversion', [*sandbox, str(worker)], 180, env, request)
    response = json.loads((out / 'conversion.stdout').read_text())
    save('conversion-response.json', response)
    assert response['ok'] is True and response['id'] == request['id']
    receipt = response['data']
    assert receipt['input'] == {'sampleRate': 48000, 'channels': 1, 'frames': 342720}
    assert receipt['output'] == {'sampleRate': 16000, 'channels': 1, 'frames': 114240}
    assert receipt['contextPolicy'] == 'complete-selected-pcm-zero-origin'
    assert receipt['channelPolicy'] == 'preserve' and receipt['implementationId'] == 'native-finite-pcm-v1'
    report['converted'] = wav_receipt(converted, 16000, 114240)
    assert receipt['file'] == str(converted) and receipt['bytes'] == report['converted']['file']['bytes']
    save('conversion-qualification.json', report['converted'])
    report['modelPreLoad'] = check_files(expected_models)
    report['runtimePreLoad'] = check_runtime()
    report['alignmentAttempts'] += 1
    alignment = run('alignment', [*sandbox, str(ns / 'venv/bin/python'), str(ns / 'alignment-float16.py'),
        '--model', str(ns / 'model'), '--audio', str(converted), '--transcript', str(ns / 'input/supplied-text.json'),
        '--out', str(candidate)], 900, env)
    candidate_manifest = json.loads((candidate / 'manifest.json').read_text())
    report['candidateManifest'] = candidate_manifest
    report['candidateResult'] = pin(candidate / 'result.json')
    assert candidate_manifest['audioSha256'] == report['converted']['file']['sha256']
    assert candidate_manifest['transcriptSha256'] == prep['suppliedText']['sha256']
    assert candidate_manifest['suppliedTextSha256'] == prep['suppliedText']['joinedTextSha256']
    assert candidate_manifest['runnerSha256'] == report['runner']['sha256']
    assert candidate_manifest['modelFiles'] == prep['model']['files']
    assert candidate_manifest['settings'] == {'device': 'mps', 'dtype': 'float16', 'language': 'English'}
    assert candidate_manifest['runtime'] == prep['runtime']['versions']
    report['resource'] = {'kernelPeakResidentBytes': alignment['peakResidentBytes'],
        'runnerPeakResidentBytes': candidate_manifest['peakResidentBytes'], 'ceilingBytes': 4 * 1024**3,
        'meets': max(alignment['peakResidentBytes'], candidate_manifest['peakResidentBytes']) <= 4 * 1024**3}
    assert report['resource']['meets'], 'Unchanged4GiB resource ceiling failed'
    report['state'] = 'alignment complete; offline correspondence/timing comparison pending'
except BaseException as error:
    report['state'] = 'fixed case failed; no retry/repair/adoption'
    report['error'] = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
finally:
    try:
        report['after'] = check_files(protected)
        report['modelAfter'] = check_files(expected_models)
        report['runtimeAfter'] = check_runtime()
        report['preserved'] = True
    except BaseException as error:
        report['preserved'] = False
        report['preservationError'] = {'message': str(error), 'traceback': traceback.format_exc()}
    save('report.json', report)
    print(json.dumps({'event': 'case-terminal', 'state': report['state'], 'preserved': report['preserved'],
                      'error': report.get('error'), 'resource': report.get('resource')}), flush=True)
    if report.get('error') or not report['preserved']:
        sys.exit(1)
