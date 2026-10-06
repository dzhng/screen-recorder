"""CLI bounds refuse before external work; replay compares frozen evidence."""
import hashlib
import json
import os

import numpy as np
from scipy.io import wavfile
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("research.py")


class ResearchContract(unittest.TestCase):
    def run_cli(self, *arguments):
        return subprocess.run([sys.executable, "-I", "-B", str(SCRIPT), *map(str, arguments)],
                              capture_output=True, text=True, timeout=10)

    def fixture(self, root, extra=False):
        fixtures = root / "fixtures"
        fixtures.mkdir()
        pcm = np.zeros(320000, dtype="<f4")
        wave = fixtures / "shared.wav"
        wavfile.write(wave, 16000, pcm)
        blob = wave.read_bytes()
        cases = []
        for source in ("left", "right", "third"):
            for start in (0, 240, 1200):
                name = source + "-" + str(start)
                path = name + ".wav"
                os.link(wave, fixtures / path)
                cases.append({"name": name, "source": source, "path": path,
                    "range": {"startUs": start*1000000, "endUs": (start+20)*1000000},
                    "bytes": len(blob), "sha256": hashlib.sha256(blob).hexdigest(),
                    "pcmSha256": hashlib.sha256(pcm.tobytes()).hexdigest(),
                    "sampleRate": 16000, "frames": 320000})
        if extra: cases.append(dict(cases[0]))
        (fixtures / "manifest.json").write_text(json.dumps({
            "sources": {source: {} for source in ("left", "right", "third")}, "cases": cases}))
        return fixtures

    def test_extra_replay_case_refuses_before_native_work(self):
        with tempfile.TemporaryDirectory(prefix="yap-sync-replay-bound-") as directory:
            root = Path(directory)
            fixtures = self.fixture(root, extra=True)
            marker = root / "native-called"
            native = root / "native"
            native.write_text('#!/bin/sh\nprintf called > "' + str(marker) + '"\nexit 1\n')
            native.chmod(0o755)
            result = self.run_cli("replay", "--fixtures", fixtures,
                                  "--native", native, "--output", root / "output")
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(marker.exists(), "Invalid manifest must be refused before native replay")
            self.assertIn("Replay exceeds frozen bounds", result.stderr)

    def test_replay_refuses_a_different_frozen_numerical_receipt(self):
        with tempfile.TemporaryDirectory(prefix="yap-sync-comparison-") as directory:
            root = Path(directory)
            fixtures = self.fixture(root)
            # Silence has no peaks; this supplies all nine independent null expectations.
            frozen = json.loads((SCRIPT.parents[4] / "specs/video-editing-feedback/assets/20-synchronization/original-comparisons.json").read_text())
            policy = frozen[0]["result"]["policy"]
            rows = []
            for start in (0, 240, 1200):
                for left, right in (("left", "right"), ("left", "third"), ("right", "third")):
                    rows.append({"left": left, "right": right, "rangeSeconds": [start, start+20], "rms": [0.0, 0.0],
                        "result": {"state": "unsuitable", "reason": "insufficient-or-ambiguous-shared-waveform",
                        "offsetFrames": None, "sampleRate": 16000, "spreadFrames": None,
                        "anchors": [{"centerFrames": c*16000, "rangeFrames": [(c-2)*16000,(c+2)*16000],
                            "selectedFrames": None, "alternatives": [], "alternativeRatio": None} for c in (3,10,17)],
                        "mapping": "rightTime = leftTime + offsetFrames/sampleRate", "policy": policy}})
            reference = root / "reference.json"
            reference.write_text(json.dumps(rows))
            baseline = self.run_cli("replay", "--fixtures", fixtures, "--reference", reference,
                                    "--output", root / "baseline")
            self.assertEqual(baseline.returncode, 0, baseline.stderr)
            rows[0]["rms"][0] = 0.25
            reference.write_text(json.dumps(rows))
            result = self.run_cli("replay", "--fixtures", fixtures, "--reference", reference,
                                  "--output", root / "output")
            self.assertNotEqual(result.returncode, 0, "Different numerical receipts cannot be verified by recalculation alone")
            self.assertIn("Frozen comparison differs", result.stderr)
            self.assertTrue((root / "output" / "comparisons.json").is_file(), "Preserve the refused candidate operands")

    def test_extra_acquisition_window_refuses_before_native_work(self):
        with tempfile.TemporaryDirectory(prefix="yap-sync-bound-") as directory:
            root = Path(directory)
            marker = root / "native-called"
            native = root / "native"
            native.write_text('#!/bin/sh\nprintf called > "' + str(marker) + '"\nexit 1\n')
            native.chmod(0o755)
            source = root / "original"
            source.write_bytes(b"explicit source bytes")
            sources = {key: {"file": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest()}
                       for key in ("left", "right", "third")}
            protocol = root / "protocol.json"
            protocol.write_text(json.dumps({"sources": sources,
                "realScouts": {"sources": list(sources), "rangesSeconds": [[0, 20], [240, 260], [1200, 1220], [30, 50]]},
                "budget": {"maximumSourceDecodes": 9}}))
            result = self.run_cli("acquire", "--protocol", protocol, "--originals", root,
                                  "--native", native, "--output", root / "output")
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(marker.exists(), "An invalid work plan must never enter native execution")
            self.assertIn("Acquisition exceeds frozen bounds", result.stderr)


if __name__ == "__main__":
    unittest.main()
