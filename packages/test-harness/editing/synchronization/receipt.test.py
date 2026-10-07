import importlib.util
from pathlib import Path
import unittest
import numpy as np
receipt_spec = importlib.util.spec_from_file_location('receipt', Path(__file__).with_name('receipt.py'))
receipt = importlib.util.module_from_spec(receipt_spec)
receipt_spec.loader.exec_module(receipt)
offset_spec = importlib.util.spec_from_file_location('offset', Path(__file__).with_name('offset.py'))
offset = importlib.util.module_from_spec(offset_spec)
offset_spec.loader.exec_module(offset)

class ReceiptTests(unittest.TestCase):
    def test_constant_offset_becomes_source_bound_accepted_receipt(self):
        rate = 1000
        estimate = {"state": "constant-offset", "offsetFrames": 125, "sampleRate": rate, "spreadFrames": 1, "anchors": [{"selectedFrames": 125}] * 3, "policy": {"maximumSpreadMs": 2}}
        value = receipt.make(estimate, [
            {"assetId": "camera-a", "streamId": "audio"},
            {"assetId": "camera-b", "streamId": "audio"},
        ], evidence_id="fixture-waveform", generation="fixture-v1")
        self.assertEqual(value["evidence"]["status"], "accepted")
        self.assertEqual(value["evidence"]["method"], "waveform")
        self.assertEqual(value["measurement"]["offsetFrames"], 125)
        self.assertEqual(value["evidence"]["sources"], [
            {"assetId": "camera-a", "streamId": "audio"},
            {"assetId": "camera-b", "streamId": "audio"},
        ])
        self.assertRegex(value["evidence"]["fingerprint"], r"^sha256:[0-9a-f]{64}$")

    def test_estimator_result_is_the_measurement_consumed_by_the_receipt(self):
        rate = 1000
        rng = np.random.default_rng(62003)
        left = rng.normal(size=rate * 20)
        right = np.concatenate([np.zeros(125), left[:-125]]) * .2 + rng.normal(size=rate * 20) * .02
        value = receipt.make(offset.estimate(left, right, rate), [
            {"assetId": "camera-a", "streamId": "audio"},
            {"assetId": "camera-b", "streamId": "audio"},
        ], evidence_id="measured-waveform", generation="fixture-v1")
        self.assertEqual(value["evidence"]["status"], "accepted")
        self.assertEqual(value["measurement"]["offsetFrames"], 125)

    def test_unsuitable_drift_or_unrelated_result_cannot_be_accepted(self):
        value = receipt.make({"state": "unsuitable", "reason": "nonconstant-offset", "offsetFrames": None, "sampleRate": 1000, "spreadFrames": 100}, [
            {"assetId": "a", "streamId": "mic"},
            {"assetId": "b", "streamId": "mic"},
        ], evidence_id="fixture-drift", generation="fixture-v1")
        self.assertEqual(value, {"status": "refused", "reason": "nonconstant-offset"})

        unrelated = receipt.make({"state": "unsuitable", "reason": "insufficient-or-ambiguous-shared-waveform", "offsetFrames": None, "sampleRate": 1000, "spreadFrames": None}, [
            {"assetId": "a", "streamId": "mic"},
            {"assetId": "b", "streamId": "mic"},
        ], evidence_id="fixture-unrelated", generation="fixture-v1")
        self.assertEqual(unrelated["status"], "refused")
        self.assertEqual(unrelated["reason"], "insufficient-or-ambiguous-shared-waveform")

    def test_constant_offset_with_excessive_anchor_spread_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "spread policy"):
            receipt.make({
                "state": "constant-offset",
                "offsetFrames": 20,
                "sampleRate": 1000,
                "policy": {"maximumSpreadMs": 2},
                "anchors": [{"selectedFrames": value} for value in (10, 20, 30)],
            }, [
                {"assetId": "a", "streamId": "mic"},
                {"assetId": "b", "streamId": "mic"},
            ], evidence_id="spread", generation="fixture-v1")

    def test_receipt_requires_distinct_source_identity(self):
        with self.assertRaisesRegex(ValueError, "distinct"):
            receipt.make({"state": "constant-offset", "offsetFrames": 0}, [
                {"assetId": "same", "streamId": "mic"},
                {"assetId": "same", "streamId": "mic"},
            ], evidence_id="duplicate", generation="fixture-v1")

if __name__ == '__main__':
    unittest.main()
