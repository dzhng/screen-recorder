"""Recover missing isolated endpoints with the frozen research recipe, then hash-admit."""
import gzip
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile

here = Path(__file__).resolve().parent
root = here.parents[3]
evidence = json.loads((here.parent/'13a-endpoint-verification/evidence.json').read_text())
trusted = {row['path']: row['sha256'] for row in evidence['loaded']}
cpp = root/'packages/test-harness/editing/stretch/Signalsmith.cpp'
assert hashlib.sha256(cpp.read_bytes()).hexdigest() == evidence['cppSha256']
vendor = root/'helpers/stretch/Sources/CSignalsmith/vendor'
for row in evidence['dependency']['files']:
    assert hashlib.sha256((vendor/row['path']).read_bytes()).hexdigest() == row['sha256']
receipts = []
# No product worker, new dependency, admission sweep, or recipe changes.
with tempfile.TemporaryDirectory(prefix='stretch-plot-recovery-') as temporary:
    scratch = Path(temporary)
    executable = scratch/'signalsmith'
    subprocess.run(['clang++', '-std=c++17', '-O2', '-I', str(vendor.parent), str(cpp), '-o', str(executable)], check=True, timeout=60)
    for row in evidence['endpoints']:
        data = bytearray(72000*4)
        struct.pack_into('<f', data, row['sourceFrame']*4, .8)
        assert hashlib.sha256(data).hexdigest() == trusted[row['input']]
        input_path = scratch/'input.f32'
        input_path.write_bytes(data)
        for mode in ['exact', 'tail']:
            output = scratch/Path(row[mode]).name
            result = subprocess.run([str(executable), str(input_path), str(output), '0', '72000', str(row['wanted']), mode, '0'],
                                    check=True, timeout=60, capture_output=True, text=True)
            data = output.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            assert digest == trusted[row[mode]], f"Hash mismatch: {row[mode]}"
            path = here/'pcm'/(Path(row[mode]).name+'.gz')
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(gzip.compress(data, mtime=0))
            receipts.append({'originalPath': row[mode], 'retainedPath': str(path.relative_to(here)),
                             'sha256': digest, 'metadata': json.loads(result.stdout)})
(here/'recovery.json').write_text(json.dumps({'cppSha256': evidence['cppSha256'],
    'source': '../13a-endpoint-verification/evidence.json', 'outputs': receipts}, indent=2)+'\n')
