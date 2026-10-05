"""Clone-only local packaging experiment; never installs or changes donor files."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import runpy

parser = argparse.ArgumentParser()
for name in ["base", "primary", "worker", "launcher", "out"]:
    parser.add_argument("--" + name, required=True)
parser.add_argument("--supplemental", action="append", default=[])
parser.add_argument("--resource", action="append", nargs=2, default=[], metavar=("SOURCE", "NAME"))
parser.add_argument("--omit-path-file", action="append", default=[])
parser.add_argument("--native-policy")
args = parser.parse_args()
base, primary, worker, launcher, out = (Path(getattr(args, name)).resolve() for name in ["base", "primary", "worker", "launcher", "out"])
supplemental = [Path(path).resolve() for path in args.supplemental]
resources = [(Path(path).resolve(), name) for path, name in args.resource]
for _, name in resources:
    assert Path(name).name == name and name not in ["worker.py", "launch.py", "imports.json", ".", ".."], "Resource name must be a distinct basename"
assert len({name for _, name in resources}) == len(resources), "Duplicate entry resources"
for name in args.omit_path_file:
    path = primary / name
    assert Path(name).name == name and name.endswith(".pth") and path.is_file(), "Only named top-level primary path files may be omitted"
    lines = [line.strip() for line in path.read_text().splitlines() if line.strip() and not line.lstrip().startswith("#")]
    assert lines and all(Path(line).is_absolute() and Path(line).resolve() in supplemental for line in lines), "Omitted file must contain only the declared supplemental donor paths"
for path in primary.glob("*.pth"):
    if path.name in args.omit_path_file:
        continue
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "import ", "import\t")):
            continue
        assert not Path(line).is_absolute() and (primary / line).resolve().is_relative_to(primary), "Undeclared primary import path escapes the prepared artifact"
assert not any(out.is_relative_to(root) or root.is_relative_to(out) for root in [base, primary, worker.parent, launcher.parent, *supplemental, *(path.parent for path, _ in resources)]), "Bundle output must not overlap a donor"
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


def clone_file(source, destination):
    if clone(os.fsencode(source), os.fsencode(destination), 0):
        raise OSError(ctypes.get_errno(), "clonefile failed; full-copy fallback is forbidden")
    source_stat, target_stat = source.stat(), destination.stat()
    assert (source_stat.st_dev, source_stat.st_ino) != (target_stat.st_dev, target_stat.st_ino), "Writable hardlink alias"
    assert stat.S_IMODE(source_stat.st_mode) == stat.S_IMODE(target_stat.st_mode), "Clone changed file mode"


def copy(source, destination):
    if len(sources) % 128 == 0:
        assert shutil.disk_usage(out).free >= reserve, "Scratch reserve crossed during clone-only assembly"
    if source.is_symlink():
        target = os.readlink(source)
        assert not os.path.isabs(target), "Absolute donor symlink needs an explicit packaging decision"
        destination.symlink_to(target)
    elif source.is_dir():
        destination.mkdir(parents=True)
        for child in sorted(source.iterdir()):
            copy(child, destination / child.name)
        destination.chmod(stat.S_IMODE(source.stat().st_mode))
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        clone_file(source, destination)
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
        if child.name not in ["python3.12", "pkgconfig"]:
            copy(child, python / "lib" / child.name)
    (python / "lib/python3.12").mkdir()
    for child in sorted((base / "lib/python3.12").iterdir()):
        if child.name != "site-packages":
            copy(child, python / "lib/python3.12" / child.name)
    site = python / "lib/python3.12/site-packages"
    site.mkdir()
    for child in sorted(primary.iterdir()):
        if child.name not in args.omit_path_file:
            copy(child, site / child.name)
    layers = []
    for i, layer in enumerate(supplemental, 1):
        relative = f"python/lib/python3.12/model-layers/{i}"
        copy(layer, bundle / relative)
        layers.append(relative)
    (bundle / "execution").mkdir()
    copy(worker, bundle / "execution/worker.py")
    copy(launcher, bundle / "execution/launch.py")
    for path, name in resources:
        copy(path, bundle / "execution" / name)
    (bundle / "execution/imports.json").write_text(json.dumps({"supplemental": layers}, sort_keys=True)+"\n")
    native_report, native_changes = None, {}
    if args.native_policy:
        relocate = runpy.run_path(str(Path(__file__).with_name("runtime-native.py")))["relocate"]
        native_report, native_changes = relocate(Path(args.native_policy).resolve(), bundle, sources, out, clone_file, sha)
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
            if item["path"] in sources:
                change = native_changes.get(item["path"])
                assert item["sha256"] == (change["finalSha256"] if change else sha(Path(sources[item["path"]]))), "Copied byte mismatch"
            else:
                assert item["path"] == "execution/imports.json", "Unexpected generated runtime file"
        entries.append(item)
    manifest = json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()
    (out / "manifest.json").write_bytes(manifest)
    after = shutil.disk_usage(out).free
    assert after >= reserve, "Scratch reserve crossed after assembly"
    report = {"passed": True, "manifestSha256": hashlib.sha256(manifest).hexdigest(), "files": len(sources),
              "logicalBytes": sum(x.get("bytes", 0) for x in entries),
              "freeBefore": before, "freeAfter": after, "observedFreeDelta": before-after,
              "copyMethod": "clonefile only; distinct source/destination inodes checked; no fallback",
              "sourceRoots": {"base": str(base), "primary": str(primary), "supplemental": list(map(str, supplemental)), "worker": str(worker), "launcher": str(launcher)},
              "layout": "Standalone base interpreter/stdlib, unchanged primary site-packages with ordinary startup semantics, declared bundle-relative supplemental layers appended after primary; unchanged worker/resources",
              "excluded": ["base-only default site-packages (explicit layers own dependency visibility)", "base headers/share/docs, pkg-config development metadata and unused bin tools", "venv config, activation and absolute console scripts", *args.omit_path_file],
              "configuration": ["python/bin/python is a new relative symlink to unchanged python3.12", "no pyvenv.cfg; sys.prefix derives from the self-contained interpreter layout"],
              "imports": {"primary": "python/lib/python3.12/site-packages", "supplemental": layers, "entry": "execution/launch.py"},
              "model": "not copied; must remain an explicit separately verified input"}
    if native_report is not None:
        report["nativeRelocation"] = native_report
    (out / "assembly.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report), flush=True)
except BaseException as error:
    (out / "assembly-failure.json").write_text(json.dumps({"error": str(error), "free": shutil.disk_usage(out).free})+"\n")
    shutil.rmtree(bundle, ignore_errors=True)
    raise
