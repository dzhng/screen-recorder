"""Exercise bounded failure accounting without model imports or inference."""
import hashlib
import json
import pathlib
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


class TimeoutReceipt(unittest.TestCase):
    def test_timeout_preserves_elapsed_and_termination_receipt(self):
        with tempfile.TemporaryDirectory(prefix="yap-speaker-timeout-test-") as directory:
            root = pathlib.Path(directory)
            pcm = root / "pcm.f32"
            pcm.write_bytes(b"\0" * 4)
            model = root / "model"
            model.write_bytes(b"test-model")
            worker = root / "worker.py"
            worker.write_text("# No inference permitted in this test.\n")
            sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
            reference = root / "references.json"
            reference.write_text(json.dumps({"cases": [{"id": "one", "pcm": str(pcm), "pcmSha256": sha(pcm), "frames": 1}]}))
            protocol = {
                "references": {"path": reference.name, "sha256": sha(reference)},
                "caseOrder": ["one"], "workerSha256": sha(worker),
                "modelPath": str(model), "candidate": {"modelSha256": sha(model)},
                "runtime": {"python": sys.executable, "cache": str(root / "cache")},
                "execution": {"timeoutSecondsPerCall": 0.01},
            }
            (root / "protocol.json").write_text(json.dumps(protocol))
            output = root / "output"
            invocation = pathlib.Path(__file__).with_name("native-cache-invoke.py")
            with patch.object(sys, "argv", [str(invocation), str(root), str(root), "one", str(output)]), patch.object(
                subprocess, "run", side_effect=subprocess.TimeoutExpired("frozen-worker", 0.01)
            ), self.assertRaises(subprocess.TimeoutExpired):
                runpy.run_path(str(invocation), run_name="__main__")
            receipt = json.loads((output / "transport.json").read_text())
            self.assertIsNone(receipt["exitCode"])
            self.assertTrue(receipt["timedOut"])
            self.assertTrue(receipt["networkDenied"])
            self.assertEqual(receipt["timeoutSeconds"], 0.01)
            self.assertGreaterEqual(receipt["wallSeconds"], 0)
            self.assertTrue((output / "request.json").is_file())


if __name__ == "__main__":
    unittest.main()
