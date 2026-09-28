"""Run a prepared, pinned upstream RNNoise example without accepting its edit semantics."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--demo', type=Path, required=True)
parser.add_argument('--repo', type=Path, required=True)
parser.add_argument('--ffmpeg', type=Path, required=True)
parser.add_argument('--speech', type=Path, required=True)
parser.add_argument('--noise', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=False)
started = time.monotonic()

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def levels(path):
    samples = array.array('h')
    samples.frombytes(path.read_bytes())
    return {'frames': len(samples), 'peak': max(map(abs, samples), default=0)/32768,
            'rms': math.sqrt(sum(x*x for x in samples)/max(1, len(samples)))/32768,
            'fullScaleSamples': sum(x in [-32768, 32767] for x in samples)}

report = {'productionAdoption': False, 'listening': 'not performed', 'runs': [],
          'revision': subprocess.check_output(['git', '-C', str(args.repo), 'rev-parse', 'HEAD'], text=True).strip(),
          'demoSha256': sha(args.demo), 'runnerSha256': sha(Path(__file__)),
          'ffmpegSha256': sha(args.ffmpeg),
          'modelDataSha256': sha(args.repo / 'src/rnnoise_data.c'),
          'modelHeaderSha256': sha(args.repo / 'src/rnnoise_data.h')}
for name, source in [('speech', args.speech), ('room-tone', args.noise)]:
    assert time.monotonic() - started < 120, 'Two-minute batch deadline'
    decoded, output = args.out / (name + '-input.s16'), args.out / (name + '-output.s16')
    decode = [str(args.ffmpeg), '-nostdin', '-v', 'error', '-i', str(source), '-map', '0:a:0',
              '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 's16le', '-n', str(decoded)]
    subprocess.run(decode, check=True, capture_output=True, timeout=30)
    command = ['/usr/bin/time', '-l', '/usr/bin/sandbox-exec', '-p',
               '(version 1)(allow default)(deny network*)', str(args.demo), str(decoded), str(output)]
    before = time.monotonic()
    result = subprocess.run(command, check=True, capture_output=True, timeout=30)
    seconds = time.monotonic() - before
    (args.out / (name + '-resource.txt')).write_bytes(result.stderr)
    resident = re.search(rb'(\d+)\s+maximum resident set size', result.stderr)
    a, b = levels(decoded), levels(output)
    report['runs'].append({'name': name, 'sourceSha256': sha(source), 'decode': decode,
                          'command': command, 'inputSha256': sha(decoded), 'outputSha256': sha(output),
                          'before': a, 'after': b, 'secondsIncludingSandboxStartup': seconds,
                          'peakResidentBytes': int(resident[1]) if resident else None,
                          'countPreserved': a['frames'] == b['frames'],
                          'rmsChangeDb': 20*math.log10(b['rms']/a['rms']) if a['rms'] and b['rms'] else None})
report['elapsedSeconds'] = time.monotonic() - started
(args.out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
