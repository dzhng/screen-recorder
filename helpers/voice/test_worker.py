"""Focused adapter contracts; tiny MLX shapes only, no model loading or generation."""
import importlib.util
import json
from pathlib import Path
import unittest
import mlx.core as mx

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("voice_worker", Path(__file__).with_name("worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
profile = json.loads((root / "packages/core/src/model-data/voice-profile-v1.json").read_text())


class AdapterTests(unittest.TestCase):
    def test_requested_clamp_seed_and_refusals(self):
        requested, effective = worker.resolve_settings({}, "18446744073709551615", profile)
        self.assertEqual(requested["repetition_penalty"], 1.05)
        self.assertEqual(effective["repetition_penalty"], 1.5)
        for settings, seed in [({"speed": 1}, "18"), ({"temperature": 1e-38}, "18"),
                               ({"temperature": True}, "18"), ({"lang_code": "typo"}, "18"),
                               ({"stream": True}, "18"), ({}, True), ({}, "01"),
                               ({}, "18446744073709551616")]:
            with self.subTest(settings=settings, seed=seed):
                with self.assertRaises(worker.Refusal) as caught:
                    worker.resolve_settings(settings, seed, profile)
                self.assertEqual(caught.exception.code, "INVALID_REQUEST")

    def model(self, target_tokens=3, prefill=17, fail=False):
        class Tokenizer:
            def encode(self, text):
                return list(range(7 if text == "reference" else target_tokens + 8))
        class Model:
            def __init__(self):
                self.tokenizer = Tokenizer()
                self.calls = 0
                self.results = (mx.zeros((1, prefill, 2)), mx.zeros((1, 1, 2)),
                                mx.zeros((1, 1, 2)), mx.zeros((1, 16, 1)))
            def _prepare_icl_generation_inputs(self):
                self.calls += 1
                self.tokenizer.encode("reference")
                self.tokenizer.encode("target")
                if fail:
                    raise ValueError("unusable input")
                return self.results
        return Model()

    def test_preserves_original_result_and_restores_encode(self):
        model = self.model()
        encode = model.tokenizer.encode
        evidence = {}
        worker.bounded_prepare(model, profile, evidence)
        self.assertIs(model._prepare_icl_generation_inputs(), model.results)
        self.assertEqual(model.calls, 1)
        self.assertEqual(model.tokenizer.encode, encode)
        self.assertEqual(evidence["referenceTextTokens"], 2)
        self.assertEqual(evidence["targetTextTokens"], 3)
        self.assertEqual(evidence["inputTokens"], 17)
        with self.assertRaises(worker.Refusal):
            model._prepare_icl_generation_inputs()
        self.assertEqual(model.calls, 1)

    def test_refusal_prevents_consumer_work_and_always_restores_encode(self):
        for kwargs, code in [({"target_tokens": 1025}, "LIMIT_EXCEEDED"),
                             ({"prefill": 1326}, "LIMIT_EXCEEDED"),
                             ({"fail": True}, "INVALID_REFERENCE")]:
            with self.subTest(kwargs=kwargs):
                model = self.model(**kwargs)
                encode = model.tokenizer.encode
                worker.bounded_prepare(model, profile, {})
                consumed = False
                with self.assertRaises(worker.Refusal) as caught:
                    model._prepare_icl_generation_inputs()
                    consumed = True
                self.assertFalse(consumed)
                self.assertEqual(caught.exception.code, code)
                self.assertEqual(model.tokenizer.encode, encode)
                self.assertEqual(model.calls, 1)


if __name__ == "__main__":
    unittest.main()
