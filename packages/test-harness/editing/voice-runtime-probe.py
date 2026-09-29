"""Read-only import closure probe, intended to run with donor paths denied."""
import ctypes
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import platform
import sys

bundle, model = (Path(x).resolve() for x in sys.argv[1:])
pins = json.loads((bundle / "voice/pins.json").read_text())
spec = importlib.util.spec_from_file_location("voice_entry", bundle / "voice/worker.py")
entry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entry)
entry.prepared(model, pins)
import numpy
from scipy.io import wavfile
from mlx_audio.tts.utils import load_model
import tokenizers
import safetensors

paths = {name: str(Path(module.__file__).resolve()) for name, module in sys.modules.copy().items()
         if name != "__main__" and (getattr(module, "__file__", "") or "").startswith("/")}
assert all(Path(path).is_relative_to(bundle) for path in paths.values()), paths
assert all(Path(path).is_relative_to(bundle) for path in sys.path), sys.path
library = ctypes.CDLL(None)
library._dyld_image_count.restype = ctypes.c_uint32
library._dyld_get_image_name.argtypes = [ctypes.c_uint32]
library._dyld_get_image_name.restype = ctypes.c_char_p
loaded = [library._dyld_get_image_name(i).decode() for i in range(library._dyld_image_count())]
non_system = [p for p in loaded if not p.startswith(("/usr/lib/", "/System/"))]
assert all(Path(p).resolve().is_relative_to(bundle) for p in non_system), non_system
print(json.dumps({"passed": True, "python": sys.version, "platform": platform.platform(),
                  "system": platform.system(), "release": platform.release(), "machine": platform.machine(),
                  "prefix": sys.prefix, "basePrefix": sys.base_prefix, "sysPath": sys.path,
                  "dependencies": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()},
                  "modulePaths": paths, "nonSystemLoadedLibraries": non_system,
                  "systemLoadedLibraries": [p for p in loaded if p not in non_system]}, indent=2))
