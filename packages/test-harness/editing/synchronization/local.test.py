import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('local', Path(__file__).with_name('local.py'))
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)

class LocalTests(unittest.TestCase):
    def test_known125ms_delay_is_not_a_zero_offset(self):
        rng = np.random.default_rng(61030)
        left = rng.normal(size=4000)
        right = np.concatenate([np.zeros(125), left[:-125]]) * -.2
        result = local.estimate(left, right, 1000)
        self.assertEqual(result['state'], 'local-acoustic-candidate')
        self.assertEqual(result['offsetFrames'], 125)
        self.assertEqual([a['selectedFrames'] for a in result['anchors']], [125, 125, 125])

    def test_missing_unrelated_and_repeated_subanchors_remain_refused(self):
        rng = np.random.default_rng(61031)
        a = rng.normal(size=4000)
        gated = a.copy(); gated[3000:4000] = 0
        periodic = np.tile(rng.normal(size=100), 40)
        for left, right in [(a, np.zeros_like(a)), (a, rng.normal(size=4000)), (a, gated), (periodic, np.roll(periodic, 25))]:
            result = local.estimate(left, right, 1000)
            self.assertEqual(result['state'], 'refused')
            self.assertIsNone(result['offsetFrames'])
        missing = local.estimate(a, gated, 1000)
        self.assertEqual([row['selectedFrames'] for row in missing['anchors']], [0, 0, None])

    def test_continuous_and_discontinuous_edits_cannot_become_one_local_clock(self):
        rng = np.random.default_rng(61032)
        left = rng.normal(size=4000)
        at = np.arange(4000)
        shifts = np.where(at < 1300, 25, np.where(at < 2700, 50, 75))
        piecewise = left[np.maximum(0, at - shifts)]
        result = local.estimate(left, piecewise, 1000)
        self.assertEqual(result['state'], 'refused')
        self.assertEqual([row['selectedFrames'] for row in result['anchors']], [25, 50, 75])
        self.assertIsNone(result['offsetFrames'])
        drift = np.interp(at - (25 + at * .0125), at, left, left=0, right=0)
        self.assertEqual(local.estimate(left, drift, 1000)['state'], 'refused')

if __name__ == '__main__': unittest.main()
