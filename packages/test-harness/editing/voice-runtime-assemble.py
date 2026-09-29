"""Clone-only local packaging experiment; never installs or changes donor files."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat

parser = argparse.ArgumentParser()
for name in ["base", "venv", "entry", "out"]:
    parser.add_argument("--" + name, required=True)
args = parser.parse_args()
base, venv, entry, out = (Path(getattr(args, name)).resolve() for name in ["base", "venv", "entry", "out"])
assert not any(out.is_relative_to(root) or root.is_relative_to(out) for root in [base, venv, entry.parent]), "Bundle output must not overlap a donor"
assert not out.exists()
out.mkdir(mode=0o700)
bundle = out / "bundle"
reserve = 512 * 1024 * 1024
before = shutil.disk_usage(out).free
assert before >= reserve, "Insufficient scratch reserve"
clone = ctypes.CDLL(None, use_errno=True).clonefile
clone.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
clone.restype = ctypes.c_int
sources = {}


def copy(source, destination):
    if len(sources) % 128 == 0:
        assert shutil.disk_usage(out).free >= reserve, "Scratch reserve crossed during clone-only assembly"
    if source.is_symlink():
        target = os.readlink(source)
        assert not os.path.isabs(target), "Absolute donor symlink needs an explicit packaging decision"
        destination.symlink_to(target)
    elif source.is_dir():
        destination.mkdir(mode=stat.S_IMODE(source.stat().st_mode), parents=True)
        for child in sorted(source.iterdir()):
            copy(child, destination / child.name)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if clone(os.fsencode(source), os.fsencode(destination), 0):
            raise OSError(ctypes.get_errno(), "clonefile failed; full-copy fallback is forbidden")
        source_stat, target_stat = source.stat(), destination.stat()
        assert (source_stat.st_dev, source_stat.st_ino) != (target_stat.st_dev, target_stat.st_ino), "Writable hardlink alias"
        assert stat.S_IMODE(source_stat.st_mode) == stat.S_IMODE(target_stat.st_mode), "Clone changed file mode"
        sources[str(destination.relative_to(bundle))] = str(source)


def sha(path):
    result = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


try:
    python = bundle / "python"
    (python / "bin").mkdir(parents=True)
    copy(base / "bin/python3.12", python / "bin/python3.12")
    (python / "bin/python").symlink_to("python3.12")
    (python / "lib").mkdir()
    for child in sorted((base / "lib").iterdir()):
        if child.name != "python3.12":
            copy(child, python / "lib" / child.name)
    (python / "lib/python3.12").mkdir()
    for child in sorted((base / "lib/python3.12").iterdir()):
        if child.name != "site-packages":
            copy(child, python / "lib/python3.12" / child.name)
    copy(venv / "lib/python3.12/site-packages", python / "lib/python3.12/site-packages")
    (bundle / "voice").mkdir()
    for name in ["worker.py", "pins.json"]:
        copy(entry.parent / name, bundle / "voice" / name)
    entries = []
    for path in sorted(bundle.rglob("*")):
        item = {"path": str(path.relative_to(bundle)), "mode": stat.S_IMODE(path.lstat().st_mode)}
        if path.is_symlink():
            assert path.resolve().is_relative_to(bundle) and path.resolve().exists(), "Escaping or broken bundle link"
            item.update(kind="symlink", target=os.readlink(path))
        elif path.is_dir():
            item.update(kind="directory")
        else:
            item.update(kind="file", bytes=path.stat().st_size, sha256=sha(path))
            assert item["sha256"] == sha(Path(sources[item["path"]])), "Copied byte mismatch"
        entries.append(item)
    manifest = json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()
    (out / "manifest.json").write_bytes(manifest)
    after = shutil.disk_usage(out).free
    assert after >= reserve, "Scratch reserve crossed after assembly"
    report = {"passed": True, "manifestSha256": hashlib.sha256(manifest).hexdigest(), "files": len(sources),
              "logicalBytes": sum(x.get("bytes", 0) for x in entries),
              "freeBefore": before, "freeAfter": after, "observedFreeDelta": before-after,
              "copyMethod": "clonefile only; distinct source/destination inodes checked; no fallback",
              "sourceRoots": {"base": str(base), "venv": str(venv), "entry": str(entry)},
              "layout": "Standalone base interpreter binary and lib tree; effective venv site-packages replace the base-only site-packages; unchanged entry/pins",
              "excluded": ["base-only pip/site-packages (not visible in frozen venv)", "base headers/share/docs and unused bin tools", "venv config, activation and console scripts with absolute donor paths"],
              "configuration": ["python/bin/python is a new relative symlink to unchanged python3.12", "no pyvenv.cfg; sys.prefix derives from the self-contained interpreter layout"],
              "model": "not copied; must remain an explicit separately verified input"}
    (out / "assembly.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report), flush=True)
except BaseException as error:
    (out / "assembly-failure.json").write_text(json.dumps({"error": str(error), "free": shutil.disk_usage(out).free})+"\n")
    shutil.rmtree(bundle, ignore_errors=True)
    raise
