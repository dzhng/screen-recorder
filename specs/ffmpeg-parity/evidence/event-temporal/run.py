# Frozen train producer loop. Confirmation requires separate frozen thresholds.
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

root = Path(__file__).resolve().parent
protocol = json.loads((root / 'frozen-protocol.json').read_text())
provider = protocol['provider']
admission = json.loads((root / 'input-admission.json').read_text())
role = sys.argv[1]
assert role in ['development', 'confirmation']
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


if role == 'confirmation':
    decision = json.loads((root / 'threshold-decision.json').read_text())
    assert decision['selectedThresholds'], 'No qualified named categories'
    assert decision['frozenBeforeConfirmation']
    for key, path in [('protocolSha256', 'frozen-protocol.json'), ('mappingSha256', 'bins.mjs'), ('developmentReportSha256', 'development-report.json')]:
        assert decision[key] == sha(root / path), 'Frozen ' + key
out = root / 'results'
out.mkdir(exist_ok=True)


assert admission['protocolSha256'] == sha(root / 'frozen-protocol.json')
assert sha(provider['model']) == provider['modelSha256']
producer = (root / provider['producer']).resolve()
assert sha(producer) == provider['producerSha256']
for source in admission['cases']:
    if source['role'] != role:
        continue
    assert sha(source['prepared']) == source['preparedSha256']
    name = source['id']
    destination = out / (name + '.json')
    assert not destination.exists(), 'Never reuse output from a failed process'
    assert not (out / (name + '.log')).exists() and not (out / (name + '-attempt.json')).exists(), 'Preserve earlier attempt diagnostics; use a separately frozen repair attempt'
    command = ['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network*)', provider['python'], str(producer), provider['model'], source['prepared'], str(destination)]
    print('START', role, name, flush=True)
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
    (out / (name + '-attempt.json')).write_text(json.dumps({'command': command, 'exitCode': child.returncode, 'timedOut': timed_out, 'networkDenied': True, 'wallSeconds': time.monotonic() - start, 'role': role, 'protocolSha256': sha(root / 'frozen-protocol.json'), 'modelSha256': provider['modelSha256'], 'preparedSha256': source['preparedSha256']}, indent=2) + '\n')
    assert child.returncode == 0 and not timed_out, 'Retained infra failure; never repeat unchanged'
    report = json.loads(destination.read_text())
    assert report['pcmSha256'] == source['preparedSha256']
    assert report['audioSeconds'] == 20 and report['scoreShape'] == [41, 521]
    assert report['inferenceSeconds'] <= 40 and report['peakProcessRSSBytes'] <= protocol['gate']['peakProcessRSSBytes']
    print('FINISH', name, report['inferenceSeconds'], flush=True)
