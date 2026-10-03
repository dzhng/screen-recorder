"""Bounded file adapter proof; provide fresh worker binaries and an unused scratch path."""
from pathlib import Path
import hashlib
import json
import os
import struct
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
worker, pointer, out = map(lambda s: Path(s).resolve(), sys.argv[1:])
out.mkdir(parents=True, exist_ok=False)
sha = lambda data: hashlib.sha256(data).hexdigest()
asset = root / 'specs/done/agent-editing/assets/13a-corrected-selections'
source = (asset / 'original.wav').read_bytes()
assert sha(source) == 'afb2a082d6712beef71dae54a89060710e62f9ee0db6e69c5e4eae029cf5bb0c'
pcm = source[44:]
input_path = out / 'source.f32'
input_path.write_bytes(pcm)
control = out / 'pointer-control'
subprocess.run(['clang++', '-std=c++17', '-O2', '-I', str(root / 'helpers/stretch/Sources/CSignalsmith/include'),
    str(root / 'packages/test-harness/editing/stretch/pointer-control.cpp'),
    str(root / 'helpers/stretch/Sources/CSignalsmith/Signalsmith.cpp'), '-o', str(control)], check=True, timeout=60)
report = {'workerSha256' : sha(worker.read_bytes()), 'pointerSha256': sha(pointer.read_bytes()), 'controlSha256': sha(control.read_bytes()), 'checks': []}

def call(name, path, start, count, wanted, cancel=0, failure=None, inject=False):
    dest = out / (name + '.f32')
    args = [str(worker), str(path), str(dest), str(start), str(count), str(wanted), str(cancel), '1']
    if inject:
        args.append('close-output')
    result = subprocess.run(['/usr/bin/time', '-l', *args], text=True, capture_output=True, timeout=90)
    row = {'case': name, 'args': args, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
    for line in result.stderr.splitlines():
        if 'maximum resident set size' in line:
            row['maxRSSBytes'] = int(line.split()[0])
    report['checks'].append(row)
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    assert not Path(str(dest)+'.partial').exists(), name + ' leaked scratch'
    if failure:
        assert result.returncode == 1 and failure in result.stderr, row
        assert not dest.exists(), name + ' published failure'
        return
    assert result.returncode == 0, row
    assert dest.stat().st_size == wanted*4
    row['sha256'] = sha(dest.read_bytes())
    return dest

# Retained acceptance hashes independently pin output, not a newly compiled oracle.
for case in json.loads((asset / 'report.json').read_text())['results']:
    name = Path(case['path']).stem
    start, end = case['sourceFrames']
    wanted = case['declaredOutput']['frames']
    dest = call(name, input_path, start, end-start, wanted)
    selected = dest.read_bytes()
    assert sha(selected) == case['selectedPcmSha256']
    assert pcm[:start*4] + selected + pcm[end*4:] == (asset / case['path']).read_bytes()[44:]
    original = out / (name + '-pointer.f32')
    subprocess.run([str(pointer), str(input_path), str(original), str(start), str(end), str(wanted), '48000'], check=True, capture_output=True, timeout=30)
    assert selected == original.read_bytes()

# Frozen leading/trailing impulse phases pin output-seek and reflected-tail behavior.
for endpoint in json.loads((root / 'specs/done/agent-editing/assets/13a-support-review/report.json').read_text())['endpoints']:
    name = f"endpoint-{endpoint['phase']}-{endpoint['speed']}"
    data = bytearray(72000*4)
    struct.pack_into('<f', data, endpoint['phase']*4, 0.8)
    struct.pack_into('<f', data, (71999-endpoint['phase'])*4, 0.8)
    assert sha(data) == endpoint['inputSha256']
    path = out / (name + '-input.f32')
    path.write_bytes(data)
    result = call(name, path, 0, 72000, endpoint['wanted'])
    assert sha(result.read_bytes()) == endpoint['sha256']

# Poison outside the chosen run must neither enter validation nor affect the exact result.
poison = out / 'poison-input.f32'
poison_bytes = bytearray(pcm)
for i in range(len(pcm)//4):
    if i < 31206 or i >= 91680:
        struct.pack_into('<f', poison_bytes, i*4, float('nan'))
poison.write_bytes(poison_bytes)
assert call('excluded-poison', poison, 31206, 60474, 75592).read_bytes() == (out / 'internal-slower-0.8x.f32').read_bytes()

# Identity has no DSP arithmetic, including the sign of zero and subnormal bits.
identity = out / 'identity-input.f32'
identity_bytes = struct.pack('<IIII', 0, 0x80000000, 1, 0x80000001)*3000
identity.write_bytes(identity_bytes)
assert call('identity-bits', identity, 0, 12000, 12000).read_bytes() == identity_bytes

# OS measurements run in separate native processes, with no duration-sized buffers.
for seconds in [60, 600]:
    path = out / f'scale-{seconds}-input.f32'
    with path.open('wb') as f:
        remaining = seconds*48000*4
        while remaining:
            block = pcm[:min(len(pcm), remaining)]
            f.write(block)
            remaining -= len(block)
    bounded = call(f'scale-{seconds}', path, 0, seconds*48000, seconds*60000)
    baseline = out / f'scale-{seconds}-pointer.f32'
    command = ['/usr/bin/time', '-l', str(control), str(path), str(baseline), '0', str(seconds*48000), str(seconds*60000)]
    run = subprocess.run(command, capture_output=True, text=True, timeout=90)
    assert run.returncode == 0, run.stderr
    assert bounded.read_bytes() == baseline.read_bytes()
    report['checks'][-1]['pointerControl'] = {'args': command, 'stderr': run.stderr, 'exact': True}

long_input = out / 'scale-600-input.f32'
# Prevalidation, energy scan, synthesis: all must be interruptible.
for name, check in [('cancel-before', 1), ('cancel-validation', 100), ('cancel-energy', 18000), ('cancel-synthesis', 40000)]:
    call(name, long_input, 0, 600*48000, 600*60000, check, 'CancellationError')
assert json.loads(report['checks'][-1]['stdout'])['cancelledAfterOutput'] is True
call('io-synthesis' , long_input, 0, 600*48000, 600*60000, -40000, 'ioFailed', inject=True)
call('unrepresentable-seek', long_input, 0, 2000000, 1, failure='unsupportedSelection')
call('unsupported', input_path, 0, 1, 2, failure='unsupportedSelection')
call('short-source', input_path, len(pcm)//4-1, 2, 3, failure='invalidCount')
call('overflow-offset', input_path, 2**63-1, 2, 3, failure='invalidCount')
nonfinite = out / 'nonfinite-input.f32'
nonfinite.write_bytes(pcm + struct.pack('<f', float('nan')))
call('nonfinite', nonfinite, 0, len(pcm)//4+1, len(pcm)//4, failure='nonfinite')
# An existing destination must survive the publication attempt unchanged.
preserved = out / 'existing.f32'
preserved.write_bytes(b'existing-output')
result = subprocess.run([str(worker), str(input_path), str(preserved), '0', '12000', '12000', '0', '1'], capture_output=True, timeout=30)
assert result.returncode == 1 and preserved.read_bytes() == b'existing-output'
assert not Path(str(preserved)+'.partial').exists()
assert input_path.read_bytes() == pcm
small = next(row for row in report['checks'] if row['case'] == 'scale-60')
large = next(row for row in report['checks'] if row['case'] == 'scale-600')
assert large['maxRSSBytes'] < small['maxRSSBytes']*2 + 4*1024*1024
for line in large['pointerControl']['stderr'].splitlines():
    if 'maximum resident set size' in line:
        assert int(line.split()[0]) > large['maxRSSBytes']*10
contracts = subprocess.run([str(worker), '--contracts'], capture_output=True, text=True, timeout=30)
assert contracts.returncode == 0, contracts.stderr
report['descriptorContracts'] = contracts.stdout
report['passed'] = True
(out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'passed':True, 'checks':len(report['checks']), 'report':str(out/'report.json')}))
