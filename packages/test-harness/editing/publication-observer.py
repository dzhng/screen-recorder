"""Fixture-only byte/FD-preserving observer around the real one-call native worker."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

folder = Path(os.environ['YAP_PUBLICATION_OBSERVER'])
# Capture inherited descriptors before opening observer files or subprocess pipes.
descriptors = []
identities = []
for entry in os.listdir('/dev/fd'):
    fd = int(entry)
    if fd < 3:
        continue
    try:
        info = os.fstat(fd)
    except OSError:
        continue
    descriptors.append(fd)
    identities.append({'fd': fd, 'dev': str(info.st_dev), 'ino': str(info.st_ino), 'mode': info.st_mode})
raw = sys.stdin.buffer.read(1024 * 1024 + 1)
request = json.loads(raw)
operation = request['operation']
name = str(os.getpid())
(folder / (name + '.request')).write_bytes(raw)
record = {'proxyPid': os.getpid(), 'servicePid': os.getppid(), 'operation': operation,
          'descriptors': identities, 'requestSha256': hashlib.sha256(raw).hexdigest()}
if not (operation.startswith(('publication.', 'storage.')) or operation in ('packageWorkspace.recover', 'media.audioCapabilities')):
    (folder / (name + '.forbidden.json')).write_text(json.dumps(record))
    sys.exit(42)  # No fabricated response and no media/model work forwarded.
child = subprocess.Popen([os.environ['YAP_REAL_NATIVE']], stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         pass_fds=tuple(descriptors))
record['nativePid'] = child.pid
(folder / (name + '.started.json')).write_text(json.dumps(record))
reply, stderr = child.communicate(raw)
(folder / (name + ".stderr")).write_bytes(stderr)
sys.stderr.buffer.write(stderr)
sys.stderr.buffer.flush()
record.update(nativeExitCode=child.returncode, responseSha256=hashlib.sha256(reply).hexdigest())
(folder / (name + '.response')).write_bytes(reply)
(folder / (name + '.finished.json')).write_text(json.dumps(record))
arm = folder / 'arm.json'
if operation == 'publication.commit' and arm.exists():
    result = json.loads(reply)
    assert child.returncode == 0 and result['ok'] and result['data']['state'] == 'committed'
    expected = json.loads(arm.read_text())
    # Publication.call sends stage/destination first; jsonWorker maps them to FD3/4.
    for fd, key in [(3, 'stage'), (4, 'destination')]:
        actual = os.fstat(fd)
        assert {'dev': str(actual.st_dev), 'ino': str(actual.st_ino)} == request['params'][key]
    prepared_fd = os.open('prepared.json', os.O_RDONLY, dir_fd=3)
    with os.fdopen(prepared_fd) as prepared_file:
        prepared = json.load(prepared_file)
    assert prepared['leaf'] == expected['leaf']
    arm.rename(folder / 'armed.json')
    record['prepared'] = prepared
    pending = folder / 'hit.pending'
    pending.write_text(json.dumps(record))
    pending.rename(folder / 'hit.json')
    deadline = time.monotonic() + 15  # Fixture watchdog, not a native deadline override.
    while not (folder / 'release').exists():
        if time.monotonic() >= deadline:
            (folder / 'hold-timeout.json').write_text(json.dumps(record))
            sys.exit(75)  # Exit closes inherited locks; never invent a reply.
        time.sleep(0.02)
    # The controller has killed/reaped the service. Never send the held reply.
    for fd in descriptors:
        os.close(fd)
    (folder / 'proxy-closed.json').write_text(json.dumps({'proxyPid': os.getpid(), 'replyForwarded': False}))
    sys.exit(0)
sys.stdout.buffer.write(reply)
sys.stdout.buffer.flush()
sys.exit(child.returncode)
