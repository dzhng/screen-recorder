import importlib.util
from pathlib import Path
import unittest
import numpy as np
spec = importlib.util.spec_from_file_location('offset',Path(__file__).with_name('offset.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class OffsetTests(unittest.TestCase):
    def test_known_delay_requires_three_separated_waveform_anchors(self):
        rate = 1000
        rng = np.random.default_rng(61006)
        left = rng.normal(size=rate*20)
        right = np.concatenate([np.zeros(125),left[:-125]]) * .2 + rng.normal(size=rate*20)*.02
        receipt = module.estimate(left,right,rate)
        self.assertEqual(receipt['state'],'constant-offset')
        self.assertEqual(receipt['offsetFrames'],125)
        self.assertEqual(len(receipt['anchors']),3)
        self.assertEqual([a['selectedFrames'] for a in receipt['anchors']],[125,125,125])
    def test_signed_offsets_preserve_mapping_under_gain_polarity_and_noise(self):
        for rate in (1000,16000):
            for seed in (61009,61010,61011):
                rng=np.random.default_rng(seed)
                left=rng.normal(size=rate*20)
                for milliseconds in (-250,0,375):
                    frames=rate*milliseconds//1000
                    indices=np.arange(len(left))-frames
                    valid=(indices>=0)&(indices<len(left))
                    right=rng.normal(size=len(left))*.01
                    right[valid]+=-.15*left[indices[valid]]
                    with self.subTest(rate=rate,seed=seed,offset=frames):
                        receipt=module.estimate(left,right,rate)
                        self.assertEqual(receipt['state'],'constant-offset')
                        self.assertEqual(receipt['offsetFrames'],frames)
                        self.assertEqual([a['selectedFrames'] for a in receipt['anchors']],[frames]*3)
                        self.assertTrue(all(a['alternatives'][0]['correlation']<-.9 for a in receipt['anchors']))
    def test_silence_unrelated_and_repeated_waveforms_cannot_declare_one_offset(self):
        rng = np.random.default_rng(61007)
        rate = 1000
        a = rng.normal(size=rate*20)
        periodic = np.tile(rng.normal(size=100),200)
        for left,right in [(a,np.zeros_like(a)),(a,rng.normal(size=len(a))), (periodic,np.roll(periodic,25))]:
            receipt=module.estimate(left,right,rate)
            self.assertEqual(receipt['state'],'unsuitable')
            self.assertIsNone(receipt['offsetFrames'])
            self.assertTrue(any(a['selectedFrames'] is None for a in receipt['anchors']))
    def test_gated_anchor_and_out_of_search_offset_remain_missing_evidence(self):
        rng=np.random.default_rng(61012)
        rate=1000
        left=rng.normal(size=rate*20)
        gated=left.copy()
        gated[7000:13000]=0
        receipt=module.estimate(left,gated,rate)
        self.assertEqual([a['selectedFrames'] for a in receipt['anchors']],[0,None,0])
        self.assertEqual(receipt['state'],'unsuitable')
        self.assertIsNone(receipt['offsetFrames'])
        far=np.concatenate([np.zeros(1500),left[:-1500]])
        receipt=module.estimate(left,far,rate)
        self.assertEqual(receipt['state'],'unsuitable')
        self.assertTrue(all(a['selectedFrames'] is None for a in receipt['anchors']))
        self.assertIsNone(receipt['offsetFrames'])
    def test_clock_drift_cannot_collapse_to_a_single_global_offset(self):
        rng=np.random.default_rng(61008)
        rate=1000
        left=rng.normal(size=20000)
        indices=np.arange(20000)
        shifts=np.where(indices<6500,125,np.where(indices<13500,175,225))
        right=left[np.maximum(0,indices-shifts)]
        receipt=module.estimate(left,right,rate)
        self.assertEqual([a['selectedFrames'] for a in receipt['anchors']],[125,175,225])
        self.assertEqual(receipt['state'],'unsuitable')
        self.assertEqual(receipt['reason'],'nonconstant-offset')
        self.assertIsNone(receipt['offsetFrames'])
if __name__ == '__main__': unittest.main()
