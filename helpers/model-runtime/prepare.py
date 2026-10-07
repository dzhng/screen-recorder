"""Materialize one curated Python/wheel recipe from already verified offline inputs."""
import argparse
import base64
import csv
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import unquote, urlparse


def normalize_installed(primary, pins):
    """Retain upstream provenance instead of embedding the private build pathname."""
    by_name = {pin["path"]: pin for pin in pins}
    for metadata in primary.glob("*.dist-info"):
        direct = metadata / "direct_url.json"
        if not direct.exists():
            continue
        value = json.loads(direct.read_text())
        pin = by_name[Path(unquote(urlparse(value["url"]).path)).name]
        value = {"url": pin["url"], "archive_info": {"hashes": {"sha256": pin["sha256"]}}}
        payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
        direct.write_bytes(payload)
        record = metadata / "RECORD"
        # Console wrappers live outside this execution closure and contain build
        # shebang paths. Their installer hashes cannot become runtime identity.
        rows = [row for row in csv.reader(record.read_text().splitlines())
            if not Path(row[0]).is_absolute() and ".." not in Path(row[0]).parts]
        relative = str(direct.relative_to(primary))
        for row in rows:
            if row[0] == relative:
                row[1:] = ["sha256=" + base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).decode().rstrip("="), str(len(payload))]
        with record.open("w", newline="") as file:
            csv.writer(file, lineterminator="\n").writerows(rows)


def prepare(request):
    # Private staging ancestry remains restricted; execution inventory modes are reproducible.
    os.umask(0o022)
    inputs, base, directory = (Path(request[name]) for name in ["inputs", "base", "directory"])
    acquisition = request["acquisition"]
    assert acquisition["recipe"] == "python-wheels-v1"
    python = base / "bin/python3.12"
    environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONNOUSERSITE="1",
        PIP_NO_INDEX="1", PIP_NO_CACHE_DIR="1", PIP_DISABLE_PIP_VERSION_CHECK="1",
        PIP_CACHE_DIR=str(inputs / "pip-cache"), TMPDIR=str(inputs / "temporary"))
    (inputs / "temporary").mkdir()
    env = inputs / "environment"

    def run(command, stage):
        print(json.dumps({"runtimePreparation": stage, "state": "running"}), file=sys.stderr, flush=True)
        log = inputs / (stage + ".log")
        with log.open("w") as output:
            result = subprocess.run(command, env=environment, stdout=output, stderr=subprocess.STDOUT, timeout=180)
        if result.returncode != 0:
            print(log.read_text(errors="replace")[-8192:], file=sys.stderr)
            raise RuntimeError("Runtime preparation failed at " + stage)
        print(json.dumps({"runtimePreparation": stage, "state": "complete"}), file=sys.stderr, flush=True)

    run([str(python), "-I", "-B", "-m", "venv", "--without-pip", str(env)], "environment")
    install = [str(python), "-I", "-B", "-m", "pip", "--isolated", "--python", str(env),
        "install", "--no-index", "--no-deps", "--no-compile", "--no-cache-dir"]
    primary = env / "lib/python3.12/site-packages"
    supplemental = [inputs / relative for relative in acquisition.get("supplemental", [])]
    for path in supplemental:
        path.mkdir(parents=True)
    for index, group in enumerate(acquisition["installs"]):
        options = (["--no-build-isolation"] if group.get("sourceBuild") else []) + (
            ["--force-reinstall"] if group.get("forceReinstall") else [])
        target = inputs / group["target"] if group.get("target") else primary
        target.mkdir(parents=True, exist_ok=True)
        run(install + options + ["--target", str(target)] +
            [str(inputs / name) for name in group["paths"]], "install-" + str(index))
        # Pip's target mode places console wrappers beside the package tree;
        # they are build artifacts with private shebangs, never runtime inputs.
        shutil.rmtree(target / "bin", ignore_errors=True)
    normalize_installed(primary, acquisition["files"])
    for target in supplemental:
        normalize_installed(target, acquisition["files"])
    policy = inputs / "native-policy.json"
    policy.write_text(json.dumps(acquisition["nativePolicy"]))
    assembly = inputs / "assembly"
    scripts = inputs / "scripts"
    command = [str(python), "-I", "-B", str(scripts / "assemble.py"),
        "--base", str(base), "--primary", str(primary),
        "--worker", str(scripts / "worker.py"), "--launcher", str(scripts / "launch.py"),
        "--native-policy", str(policy), "--out", str(assembly)]
    for target in supplemental:
        command += ["--supplemental", str(target)]
    run(command, "assembly")
    directory.rmdir()
    shutil.move(str(assembly / "bundle"), directory)
    return {"ready": True}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("request", help="Private JSON recipe request, supplied by the model owner")
    args = parser.parse_args()
    print(json.dumps(prepare(json.loads(Path(args.request).read_text()))))
