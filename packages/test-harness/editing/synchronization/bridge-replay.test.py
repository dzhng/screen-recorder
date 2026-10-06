"""Replay retained evidence without decoding or model inference."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).parents[4]
BANK = ROOT / 'specs/video-editing-feedback/assets/20-synchronization/bridge'
FIXTURES = ROOT / 'fixtures/video-editing-feedback/synchronization/bridge'
RUNNER = Path(__file__).with_name('bridge-replay.py')

class Replay(unittest.TestCase):
    def test_retained_refusals_and_local_evidence(self):
        with tempfile.TemporaryDirectory() as scratch:
            result = subprocess.run([sys.executable, '-I', '-B', str(RUNNER), '--output', str(Path(scratch)/'replay')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            report=json.loads((Path(scratch)/'replay/replay.json').read_text())
            self.assertEqual(report['scoutStates'], ['refused']*9)
            self.assertEqual(report['strict20sStates'], ['unsuitable']*7)
            self.assertEqual(report['coarseRefusedNames'], ['madisonRaw-1905', 'lilyRawP1-15'])
            self.assertEqual(report['localStates'], ['local-acoustic-candidate','refused','local-acoustic-candidate','local-acoustic-candidate','refused','local-acoustic-candidate','refused'])
            self.assertEqual(report['recognizedStates'], ['admitted-local-sampled-bridge']*4)
            self.assertEqual(report['globalStates'], ['refused-global-clock']*3)

    def test_changed_frozen_report_refuses_before_numerical_work(self):
        with tempfile.TemporaryDirectory() as scratch:
            changed = Path(scratch)/'bank'
            shutil.copytree(BANK, changed)
            report=json.loads((changed/'recognition.json').read_text())
            report['models']['files'][0]['sha256']='0'*64
            (changed/'recognition.json').write_text(json.dumps(report, indent=2)+'\n')
            output=Path(scratch)/'output'
            result=subprocess.run([sys.executable, '-I', '-B', str(RUNNER), '--bank', str(changed), '--output', str(output)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Frozen retained',result.stderr)
            self.assertIn('recognition.json',result.stderr)
            self.assertFalse(output.exists())

if __name__ == '__main__': unittest.main()
