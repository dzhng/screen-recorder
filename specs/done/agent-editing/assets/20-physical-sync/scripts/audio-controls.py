"""Check each matched beep at full sample rate to rule out decimation aliases."""
import array
import json
import math
import sys
from pathlib import Path

out = Path(sys.argv[1])
events = json.loads((out / 'audio-analysis.json').read_text())['events'][:50]
checks = []
with (out / 'microphone-packed.f32').open('rb') as pcm:
    for event in events:
        at = event['packedTime'] + .03
        pcm.seek(round(at * 48000) * 4)
        samples = array.array('f')
        samples.frombytes(pcm.read(480 * 4))
        assert len(samples) == 480
        energy = sum(value * value for value in samples)
        fractions = {}
        for hz in [700, 1000, 1300, 7000, 9000]:
            real = sum(value * math.cos(2 * math.pi * hz * i / 48000) for i, value in enumerate(samples))
            imaginary = sum(value * math.sin(2 * math.pi * hz * i / 48000) for i, value in enumerate(samples))
            fractions[hz] = 2 * (real * real + imaginary * imaginary) / (480 * energy)
        checks.append({'packedTime': at, 'full48kRatios': fractions})
(out / 'audio-full48k-controls.json').write_text(json.dumps(checks, indent=2))
