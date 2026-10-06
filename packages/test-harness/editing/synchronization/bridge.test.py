import importlib.util
from pathlib import Path
import unittest
import numpy as np
import json
import subprocess
import sys
import tempfile
from scipy.signal import resample_poly

spec = importlib.util.spec_from_file_location('offset', Path(__file__).with_name('offset.py'))
offset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offset)

class BridgeTests(unittest.TestCase):
    def test_long_search_preserves_exact_known_delay_and_unequal_origins(self):
        rate = 1000
        rng = np.random.default_rng(61026)
        raw = rng.normal(size=20000)
        reference = rng.normal(size=60000) * .01
        reference[10125:30125] += .2 * raw
        result = offset.peaks(raw[8000:12000], reference, rate, -8000)
        self.assertEqual(result[0]['offsetFrames'], 10125)
        self.assertGreater(result[0]['absoluteCorrelation'], .99)
        # Raw window begins at25s, reference vector at7s:7+10.125-25=-7.875.
        self.assertEqual(7000 + result[0]['offsetFrames'] - 25000, -7875)

    def test_broad_search_exposes_silence_unrelated_and_repeated_alternatives(self):
        rng = np.random.default_rng(61027)
        template = rng.normal(size=4000)
        self.assertEqual(offset.peaks(template, np.zeros(60000), 1000), [])
        unrelated = offset.peaks(template, rng.normal(size=60000), 1000)
        self.assertLess(unrelated[0]['absoluteCorrelation'], .35)
        repeating = np.tile(rng.normal(size=1000), 60)
        repeated = offset.peaks(repeating[:4000], repeating, 1000)
        self.assertGreater(repeated[1]['absoluteCorrelation'] / repeated[0]['absoluteCorrelation'], .99)

    def test_continuous_drift_refuses_one_constant_offset(self):
        rng = np.random.default_rng(61028)
        left = rng.normal(size=20000)
        at = np.arange(20000)
        right = np.interp(at - (125 + at * .005), at, left, left=0, right=0)
        receipt = offset.estimate(left, right, 1000)
        self.assertEqual(receipt['state'], 'unsuitable')
        self.assertIsNone(receipt['offsetFrames'])

    def test_changed_source_origin_refuses_before_any_acquisition(self):
        root = Path(__file__).parents[4]
        protocol = json.loads((root / 'specs/video-editing-feedback/assets/20-synchronization/bridge/protocol.json').read_text())
        protocol['sources']['main']['rangeSeconds'] = [1, 1960]
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'protocol.json').write_text(json.dumps(protocol))
            result = subprocess.run([sys.executable, '-I', '-B', str(Path(__file__).with_name('bridge.py')),
                'acquire', '--protocol', str(directory / 'protocol.json'), '--native', '/missing',
                '--originals', '/missing', '--output', str(directory / 'output')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn('Frozen bridge source ranges changed', result.stderr)
            self.assertFalse((directory / 'output').exists())

    def test_source_rate_recipe_preserves_independently_authored_125ms_delay(self):
        rng = np.random.default_rng(61029)
        at = np.arange(20 * 44100) / 44100
        left, right = np.zeros_like(at), np.zeros_like(at)
        for frequency, phase in zip(rng.uniform(150, 3500, 24), rng.uniform(0, 2 * np.pi, 24)):
            left += np.sin(2 * np.pi * frequency * at + phase)
            right += np.sin(2 * np.pi * frequency * (at - .125) + phase)
        left = resample_poly(left.astype('<f4'), 160, 441)
        right = resample_poly(right.astype('<f4'), 160, 441)
        receipt = offset.estimate(left, right, 16000)
        self.assertEqual(receipt['state'], 'constant-offset')
        self.assertLessEqual(abs(receipt['offsetFrames'] - 2000), 32)
        self.assertLessEqual(receipt['spreadFrames'], 32)

if __name__ == '__main__': unittest.main()
