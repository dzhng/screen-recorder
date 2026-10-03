"""Linked stereo proof. Default mode requires the retained direct-reference hashes."""
from pathlib import Path
import hashlib
import json
import math
import struct
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
worker, mono, out = map(lambda s: Path(s).resolve(), sys.argv[1:4])
record = sys.argv[4:] == ['--record-reference']
assert len(sys.argv) == 4 or record
out.mkdir(parents=True, exist_ok=False)
asset = root / 'specs/done/agent-editing/assets/14c-stereo-stretch'
expected = {} if record else json.loads((asset / 'reference.json').read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
def file_hash(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()
reference = out / 'linked-reference'
subprocess.run(['clang++', '-std=c++17', '-O2', '-I', str(root / 'helpers/stretch/Sources/CSignalsmith/vendor'),
    str(root / 'packages/test-harness/editing/stretch/linked-reference.cpp'), '-o', str(reference)], check=True, timeout=60)
report = {'workerSha256': file_hash(worker), 'directReferenceSha256': file_hash(reference), 'checks': []}
golden = {}

def call(name, source, first, count, wanted, cancel=0, failure=None, channels=2, inject=False):
    dest = out / (name + '.f32')
    args = [str(worker), str(source), str(dest), str(first), str(count), str(wanted), str(cancel), str(channels)]
    if inject:
        args.append('close-output')
    result = subprocess.run(['/usr/bin/time', '-l', *args], capture_output=True, text=True, timeout=90)
    row = {'case': name, 'args': args, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
    for line in result.stderr.splitlines():
        if 'maximum resident set size' in line:
            row['maxRSSBytes'] = int(line.split()[0])
    report['checks'].append(row)
    (out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
    assert not Path(str(dest)+'.partial').exists(), name+' leaked scratch'
    if failure:
        assert result.returncode == 1 and failure in result.stderr, row
        assert not dest.exists(), name+' published failure'
        return
    assert result.returncode == 0 and dest.stat().st_size == wanted*8, row
    row['sha256'] = file_hash(dest)
    return dest

def matched(name, source, first, count, wanted):
    baseline = out / (name+'-reference.f32')
    args = [str(reference), str(source), str(baseline), str(first), str(count), str(wanted)]
    result = subprocess.run(['/usr/bin/time', '-l', *args], capture_output=True, text=True, timeout=90)
    assert result.returncode == 0, result.stderr
    golden[name] = {'inputSha256': file_hash(source), 'firstFrame': first, 'inputFrames': count,
        'outputFrames': wanted, 'sha256': file_hash(baseline)}
    if not record:
        assert golden[name] == expected[name], name+' direct reference changed'
    dest = call(name, source, first, count, wanted)
    with dest.open('rb') as a, baseline.open('rb') as b:
        while chunk := a.read(1024*1024):
            assert chunk == b.read(len(chunk)), name+' differs from linked upstream'
        assert b.read(1) == b''
    report['checks'][-1]['directReference'] = {'args': args, 'stderr': result.stderr, 'completeByteEquality': True}
    return dest

frames, first, count = 96000, 137, 95606
fixtures = {}
for name in ['correlated', 'antiphase', 'distinct-tones', 'coupled-mixture', 'channel-events', 'silent-right']:
    data = bytearray()
    for i in range(frames):
        a = 0.2*math.sin(2*math.pi*173*i/48000)
        b = 0.2*math.sin(2*math.pi*431*i/48000)
        if name == 'correlated': b = a
        elif name == 'antiphase': b = -a
        elif name == 'coupled-mixture':
            a += 0.08*math.sin(2*math.pi*431*i/48000)
            b += 0.11*math.sin(2*math.pi*173*i/48000 + 1.1)
        elif name == 'channel-events':
            a, b = (0.8 if i == 19200 else 0), (-0.7 if i == 67200 else 0)
        elif name == 'silent-right': b = 0
        data.extend(struct.pack('<ff', a, b))
    path = out / (name+'-input.f32')
    path.write_bytes(data)
    fixtures[name] = path
    for n, d in [(5, 4), (4, 5)]:
        wanted = count*n//d
        dest = matched(f'{name}-{n}-{d}', path, first, count, wanted)
        samples = list(struct.iter_unpack('<ff', dest.read_bytes()))
        assert all(math.isfinite(v) for frame in samples for v in frame)
        if name in ['correlated', 'antiphase']:
            sign = 1 if name == 'correlated' else -1
            peak_frame = max(range(wanted), key=lambda i: abs(samples[i][0]-sign*samples[i][1]))
            error = abs(samples[peak_frame][0]-sign*samples[peak_frame][1])
            peak = max(abs(v) for frame in samples for v in frame)
            rms_error = math.sqrt(sum((a-sign*b)**2 for a,b in samples)/wanted)
            correlation = sum(a*sign*b for a,b in samples)/math.sqrt(sum(a*a for a,b in samples)*sum(b*b for a,b in samples))
            energy = sum(a*a+b*b for a,b in samples)/wanted
            assert energy > 1e-4, (name,error,energy)
            report['checks'][-1]['coherence'] = {'maximumSignedDifference': error, 'differencePeakFrame': peak_frame, 'differencePeakSeconds': peak_frame/48000, 'maximumRelativeToSignalPeak': error/peak, 'rmsDifference': rms_error, 'signedCorrelation': correlation, 'meanStereoEnergy': energy}
        elif name == 'silent-right':
            assert all(b == 0 for a,b in samples)
        elif name == 'channel-events':
            peaks = [max(range(wanted), key=lambda i: abs(samples[i][c])) for c in range(2)]
            nominal = [(19200-first)*n/d, (67200-first)*n/d]
            assert all(abs(a-b)<5760 for a,b in zip(peaks,nominal)), (peaks,nominal)
            report['checks'][-1]['eventPeaks'] = {'actual': peaks, 'nominal': nominal}

# The fixture must distinguish linked processing from two independent mono engines.
mixture = fixtures['coupled-mixture'].read_bytes()
lanes = [b''.join(struct.pack('<f', frame[c]) for frame in struct.iter_unpack('<ff', mixture)) for c in range(2)]
independent = []
for c, data in enumerate(lanes):
    path = out / f'independent-{c}-input.f32'
    path.write_bytes(data)
    dest = out / f'independent-{c}.f32'
    subprocess.run([str(mono),str(path),str(dest),str(first),str(first+count),str(count*5//4),'48000'], check=True, capture_output=True, timeout=30)
    independent.append(dest.read_bytes())
interleaved = b''.join(independent[0][i:i+4]+independent[1][i:i+4] for i in range(0,len(independent[0]),4))
linked = (out / 'coupled-mixture-5-4.f32').read_bytes()
assert interleaved != linked
report['independentMonoControl'] = {'linkedSha256':sha(linked), 'independentSha256':sha(interleaved),
    'maxDifference':max(abs(a[0]-b[0]) for a,b in zip(struct.iter_unpack('<f',linked),struct.iter_unpack('<f',interleaved)))}
assert report['independentMonoControl']['maxDifference'] > 1e-5

# Exact frame offsets preserve both channel lanes, including signed zero/subnormals.
identity = out / 'identity-input.f32'
identity_bytes = struct.pack('<IIIIIIII',0,0x80000000,1,0x80000001,0x3e800000,0xbe000000,0x80000000,0)*4000
identity.write_bytes(identity_bytes)
assert call('identity-bits',identity,7,12000,12000).read_bytes() == identity_bytes[7*8:12007*8]
poison = out / 'poison-input.f32'
data = bytearray(mixture)
for i in range(frames):
    if not first <= i < first+count:
        struct.pack_into('<ff',data,i*8,float('nan'),float('inf'))
poison.write_bytes(data)
assert call('excluded-source-poison',poison,first,count,count*5//4).read_bytes() == linked

# Long fixtures and reference comparisons do not accumulate duration-sized Python buffers.
for seconds in [60,600]:
    path = out / f'scale-{seconds}-input.f32'
    with path.open('wb') as f:
        for _ in range(seconds//2): f.write(mixture)
    matched(f'scale-{seconds}',path,0,seconds*48000,seconds*60000)
small,large = [next(c for c in report['checks'] if c['case']==f'scale-{seconds}') for seconds in [60,600]]
assert large['maxRSSBytes'] < small['maxRSSBytes']*2 + 4*1024*1024
long_input = out / 'scale-600-input.f32'
call('cancel-before',long_input,0,600*48000,600*60000,1,'CancellationError')
call('cancel-synthesis',long_input,0,600*48000,600*60000,80000,'CancellationError')
assert json.loads(report['checks'][-1]['stdout'])['cancelledAfterOutput'] is True
call('io-synthesis',long_input,0,600*48000,600*60000,-80000,'ioFailed',inject=True)
call('bad-channels',identity,0,12000,14000,failure='unsupportedFormat',channels=3)
call('overflow-offset',identity,2**63-1,12000,14000,failure='invalidCount')
call('short-source',identity,len(identity_bytes)//8-1,2,3,failure='invalidCount')
nonfinite = out / 'nonfinite-right-input.f32'
data = bytearray(mixture)
struct.pack_into('<f',data,(first+count-1)*8+4,float('nan'))
nonfinite.write_bytes(data)
call('nonfinite-right',nonfinite,first,count,count*5//4,failure='nonfinite')
assert fixtures['coupled-mixture'].read_bytes() == mixture
report['passed'] = True
(out / 'report.json').write_text(json.dumps(report,indent=2)+'\n')
(out / 'reference.json').write_text(json.dumps(golden,indent=2)+'\n')
print(json.dumps({'passed':True,'checks':len(report['checks']),'report':str(out/'report.json')}))
