# Frozen research controller. Explicit local bytes, sandboxed native inference.
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

root = Path(__file__).resolve().parent
protocol = json.loads((root / 'frozen-protocol.json').read_text())
provider = protocol['provider']
out = root / 'results'
out.mkdir(exist_ok=True)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


assert sha(provider['binary']) == provider['binarySha256']
assert sha(root / provider['wrapper']) == provider['wrapperSha256']
assert sha(root / provider['modelInventory']) == provider['modelInventorySha256']
for row in json.loads((root / provider['modelInventory']).read_text()):
    path = Path(provider['modelDirectory']) / row['path']
    assert path.stat().st_size == row['bytes'] and sha(path) == row['sha256']
assert sha(root / protocol['selection']) == protocol['selectionSha256']
audit = json.loads((root.parent / 'speaker-cohort/input-audit.json').read_text())
for source in audit['cases']:
    assert sha(source['prepared']) == source['preparedFloatSha256']
    assert Path(source['prepared']).stat().st_size == source['frames'] * 4
for recipe in protocol['recipes']:
    assert sha(root / 'recipes' / (recipe['id'] + '.json')) == recipe['configSha256']


def invoke(recipe, source):
    name = recipe['id'] + '-' + source['id']
    result = out / (name + '.json')
    assert not result.exists()
    command = ['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network*)', provider['binary'], provider['modelDirectory'], source['prepared'], str(result), str(root / 'recipes' / (recipe['id'] + '.json'))]
    print('START', name, flush=True)
    start = time.monotonic()
    child = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
    timed_out = False
    try:
        log, _ = child.communicate(timeout=protocol['plan']['deadlineSecondsPerCall'])
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(child.pid, signal.SIGKILL)
        log, _ = child.communicate()
    (out / (name + '.log')).write_bytes(log)
    (out / (name + '-attempt.json')).write_text(json.dumps({'command': command, 'wallSeconds': time.monotonic() - start, 'exitCode': child.returncode, 'timedOut': timed_out, 'networkDenied': True, 'role': source['role'], 'protocolSha256': sha(root / 'frozen-protocol.json'), 'binarySha256': provider['binarySha256'], 'sourcePreparedSha256': source['preparedFloatSha256']}, indent=2) + '\n')
    assert child.returncode == 0 and not timed_out, 'Retained infrastructure failure; do not repeat unchanged'
    raw = json.loads(result.read_text())
    assert raw['config'] == dict(recipe['config'], exclusiveSegments=False)
    if recipe['id'] == 'control':
        baseline = json.loads((root.parent / 'speaker-cohort/results/community-bspxd.json').read_text())
        assert raw['segments'] == baseline['segments'], 'Configurable wrapper does not preserve original defaults'
        print('PASS unchanged default control', flush=True)
        return
    subprocess.run(['node', str(root / 'score.mjs'), recipe['id'], source['id']], check=True)


control = protocol['recipes'][0]
invoke(control, next(row for row in audit['cases'] if row['id'] == 'bspxd'))
for recipe in protocol['recipes'][1:]:
    for source in audit['cases']:
        if source['role'] == 'development':
            invoke(recipe, source)
qualified = []
for recipe in protocol['recipes'][1:]:
    scores = [json.loads((out / (recipe['id'] + '-' + source['id'] + '-score.json')).read_text()) for source in audit['cases'] if source['role'] == 'development']
    if all(row['passed'] for row in scores):
        denominator = sum(row['metrics']['referenceSpeakerSeconds'] for row in scores)
        error = sum(row['metrics']['missedSpeakerSeconds'] + row['metrics']['falseSpeakerSeconds'] + row['metrics']['confusedSpeakerSeconds'] for row in scores)
        qualified.append((error / denominator, recipe['id'], recipe))
selected = min(qualified, key=lambda row: (row[0], row[1]))[2] if qualified else None
(out / 'development-decision.json').write_text(json.dumps({'selectedRecipe': selected, 'qualifiedRecipes': [{'id': row[1], 'pooledDer': row[0]} for row in qualified], 'noAverageOverridesFailedCase': True}, indent=2) + '\n')
if selected:
    for source in audit['cases']:
        if source['role'] == 'confirmation':
            invoke(selected, source)
else:
    print('STOP: no qualifying recipe; confirmation untouched', flush=True)
