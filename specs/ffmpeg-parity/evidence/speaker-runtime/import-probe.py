"""Import/origin closure control only; never restores a model or runs inference."""
import ctypes
import hashlib
import importlib.metadata as metadata
import json
import os
from pathlib import Path
import sys

bundle, output = map(Path, sys.argv[1:])
bundle = bundle.resolve()
config = json.loads((bundle / "execution/imports.json").read_text())
sys.path.extend(str(bundle / relative) for relative in config["supplemental"])
import numpy
import torch
import torchaudio
from nemo.collections.asr.models import SortformerEncLabelModel

versions = {name: metadata.version(name) for name in ["nemo_toolkit", "torch", "torchaudio", "numpy"]}
modules = []
for name, module in sorted(sys.modules.items()):
    path = getattr(module, "__file__", None)
    if not path:
        continue
    path = Path(path).resolve()
    if not path.is_file():
        continue
    modules.append({"name": name, "path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
native = ctypes.CDLL(None)
native._dyld_image_count.restype = ctypes.c_uint32
native._dyld_get_image_name.argtypes = [ctypes.c_uint32]
native._dyld_get_image_name.restype = ctypes.c_char_p
images = [native._dyld_get_image_name(index).decode() for index in range(native._dyld_image_count())]
report = {"verified": False, "scope": "Imports/origins only; no checkpoint or inference",
          "python": sys.version, "executable": sys.executable, "prefix": sys.prefix,
          "sysPath": sys.path, "versions": versions, "modules": modules, "nativeImages": images}
output.write_text(json.dumps(report, indent=2) + "\n")
assert versions == {"nemo_toolkit": "2.7.3", "torch": "2.8.0", "torchaudio": "2.8.0", "numpy": "2.3.5"}
assert Path(sys.executable).resolve().is_relative_to(bundle) and Path(sys.prefix).resolve().is_relative_to(bundle)
for row in modules:
    path = Path(row["path"])
    assert not any(path.is_relative_to(Path(donor)) for donor in [
        "/tmp/screenrec-nemo-env", "/tmp/screenrec-speech-research-env",
        "/Users/server/.cache/codex-runtimes/codex-primary-runtime",
    ]), f"module escaped into donor: {path}"
    generated = row["name"] == "_remote_module_non_scriptable" and path.is_relative_to(Path(os.environ["TMPDIR"]).resolve()) and row["sha256"] == "8205b16956fb264841ecd8644784a0d157f87df79b17c16825dc1163433ce5d8"
    harness = row["name"] in ["__main__", "__mp_main__"] and path == Path(__file__).resolve()
    assert path.is_relative_to(bundle) or harness or generated, path
assert all(Path(image).resolve().is_relative_to(bundle) or image.startswith(("/usr/lib/", "/System/Library/")) for image in images)
report["verified"] = True
output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"verified": True, "moduleOrigins": len(modules), "nativeOrigins": len(images), "versions": versions}), flush=True)
