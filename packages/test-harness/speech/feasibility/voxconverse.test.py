import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('voxconverse', Path(__file__).with_name('voxconverse.py'))
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)


class RangeAdmission(unittest.TestCase):
    def test_mismatched_range_cannot_substitute_source_bytes(self):
        class Reply:
            status = 206
            headers = {'Content-Range': 'bytes 5-8/20', 'ETag': 'frozen'}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, *args): return b'abcd'
        with patch('urllib.request.urlopen', return_value=Reply()):
            with self.assertRaisesRegex(ValueError, 'Content-Range'):
                owner.fetch_range('https://fixture.invalid/archive', 0, 3, 20, 'frozen')

    def test_truncated_body_cannot_certify_complete_requested_pcm(self):
        class Reply:
            status = 206
            headers = {'Content-Range': 'bytes 0-3/20', 'ETag': 'frozen'}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, *args): return b'abc'
        with patch('urllib.request.urlopen', return_value=Reply()):
            with self.assertRaisesRegex(ValueError, 'body length'):
                owner.fetch_range('https://fixture.invalid/archive', 0, 3, 20, 'frozen')


if __name__ == '__main__':
    unittest.main()
