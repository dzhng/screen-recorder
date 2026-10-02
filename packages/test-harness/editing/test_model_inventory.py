from pathlib import Path
import json
import subprocess
import sys
import tempfile
import unittest

from model_inventory import model_files


class ModelInventoryTests(unittest.TestCase):
    def test_direct_entries_import_the_owner_from_an_unrelated_cwd_before_runtime_loading(self):
        editing = Path(__file__).resolve().parent
        control = """
import importlib.abc, json, runpy, sys
class StopRuntime(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname in {'soundfile', 'torch', 'transformers', 'crisperwhisper', 'mlx', 'numpy', 'scipy'}:
            owner = sys.modules['model_inventory']
            print(json.dumps({'helper': owner.__file__, 'blocked': fullname}))
            raise SystemExit(0)
sys.meta_path.insert(0, StopRuntime())
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
raise AssertionError('Entry did not reach the runtime import fence')
"""
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            model = base / ".cache/model"
            model.mkdir(parents=True)
            # Synthetic filesystem precondition only; the import fence prevents model loading.
            (model / "model.safetensors").write_bytes(b"abc")
            for relative, blocked, arguments in [
                ("speech/alignment-probe.py", "soundfile", [
                    "--model", str(model), "--audio", str(base / "unused.wav"),
                    "--transcript", str(base / "unused.json"),
                    "--out", str(base / "alignment"),
                ]),
                ("speech/verbatim-probe.py", "crisperwhisper", [
                    "--model", str(model), "--audio", str(base / "unused.wav"),
                    "--out", str(base / "verbatim"),
                ]),
                ("voice/generate.py", "mlx", []),
            ]:
                with self.subTest(entry=relative):
                    reply = subprocess.run(
                        [sys.executable, "-I", "-B", "-S", "-c", control,
                         str(editing / relative), *arguments],
                        cwd=base, capture_output=True, text=True,
                    )
                    self.assertEqual(reply.returncode, 0, reply.stderr)
                    self.assertEqual(reply.stderr, "")
                    self.assertEqual(json.loads(reply.stdout), {
                        "helper": str(editing / "model_inventory.py"),
                        "blocked": blocked,
                    })

    def test_snapshot_file_links_keep_declared_names_and_exact_blob_digests(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            blob = base / ".cache/blobs/weight"
            blob.parent.mkdir(parents=True)
            blob.write_bytes(b"abc")
            root = base / "snapshot"
            root.mkdir()
            (root / "model.safetensors").symlink_to(blob)
            self.assertEqual(model_files(root), [{
                "path": "model.safetensors", "bytes": 3,
                "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            }])

    def test_relocation_ignores_ancestor_cache_but_excludes_internal_metadata(self):
        expected = [
            {"path": "config.json", "bytes": 0,
             "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
            {"path": "encoder/model.safetensors", "bytes": 3,
             "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"},
            {"path": "notes.cache", "bytes": 3,
             "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"},
        ]
        with tempfile.TemporaryDirectory() as temporary:
            for relative in ["model", ".cache/huggingface/snapshots/revision", "root/.cache"]:
                with self.subTest(root=relative):
                    root = Path(temporary) / relative
                    for name, content in {
                        "config.json": b"",
                        "encoder/model.safetensors": b"abc",
                        "notes.cache": b"abc",
                        ".cache/download/metadata": b"ignored",
                        "encoder/.cache/staging": b"ignored",
                    }.items():
                        path = root / name
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_bytes(content)
                    self.assertEqual(model_files(root), expected)


if __name__ == "__main__":
    unittest.main()
