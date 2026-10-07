"""Bounded research invocation over shared immutable PCM/runtime/model inputs."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time

supplied_repo, supplied_evidence, case_id, supplied_output = sys.argv[1:]
repo = pathlib.Path(supplied_repo)
here = pathlib.Path(supplied_evidence)
protocol = json.loads((here / "protocol.json").read_text())
reference = repo / protocol["references"]["path"]
assert hashlib.sha256(reference.read_bytes()).hexdigest() == protocol["references"]["sha256"]
case = next(c for c in json.loads(reference.read_text())["cases"] if c["id"] == case_id)
assert case_id in protocol["caseOrder"]
output = pathlib.Path(supplied_output)
output.mkdir(exist_ok=False)
worker = here / "worker.py"
assert hashlib.sha256(worker.read_bytes()).hexdigest() == protocol["workerSha256"]
assert hashlib.sha256(pathlib.Path(protocol["modelPath"]).read_bytes()).hexdigest() == protocol["candidate"]["modelSha256"]
pcm = pathlib.Path(case["pcm"]).read_bytes()
assert len(pcm) == case["frames"] * 4
assert hashlib.sha256(pcm).hexdigest() == case["pcmSha256"]
request = {
    "operation": "speaker.continuityLab",
    "params": {
        "model": protocol["modelPath"],
        "cases": [{k: case[k] for k in ["id", "pcm", "pcmSha256", "frames"]} | {"output": str(output / f"{case_id}.json")}],
    },
}
(output / "request.json").write_text(json.dumps(request, indent=2) + "\n")
scratch = pathlib.Path("/tmp/yap-editing-speaker-replication")
runtime = protocol["runtime"]
environment = os.environ | {
    "HF_HOME": runtime["cache"], "HF_HUB_OFFLINE": "1",
    "TRANSFORMERS_OFFLINE": "1", "HF_HUB_DISABLE_IMPLICIT_TOKEN": "1",
    "PYTHONDONTWRITEBYTECODE": "1", "NO_VCS_VERSION": "1",
    "TOKENIZERS_PARALLELISM": "false", "TMPDIR": str(scratch / "cache/tmp"),
    "MPLCONFIGDIR": str(scratch / "cache/mpl"), "XDG_CACHE_HOME": str(scratch / "cache/xdg"),
}
profile = '(version 1)(allow default)(deny network*)(deny file-read* (subpath "/Users/server/.cache/codex-runtimes/codex-primary-runtime/dependencies/python"))(deny file-read* (subpath "/private/tmp/yap-editing-speaker-replication/env"))(deny file-read* (subpath "/private/tmp/yap-editing-speaker-replication/assembly/bundle"))(deny file-read* (subpath "/Users/server/dev/yap-video-editing"))'
began = time.perf_counter()
with (output / "stdout.json").open("xb") as stdout, (output / "stderr.log").open("xb") as stderr:
    print(f"Running frozen Nemotron continuity case {case_id}; timeout{protocol['execution']['timeoutSecondsPerCall']}s", flush=True)
    try:
        result = subprocess.run(
            ["/usr/bin/sandbox-exec", "-p", profile, runtime["python"], "-I", "-B", str(worker)],
            input=json.dumps(request).encode() + b"\n", stdout=stdout, stderr=stderr,
            env=environment, timeout=protocol["execution"]["timeoutSecondsPerCall"],
        )
    except subprocess.TimeoutExpired:
        receipt = {"exitCode": None, "wallSeconds": time.perf_counter() - began, "networkDenied": True,
                   "timedOut": True, "timeoutSeconds": protocol["execution"]["timeoutSecondsPerCall"]}
        (output / "transport.json").write_text(json.dumps(receipt, indent=2) + "\n")
        raise
receipt = {"exitCode": result.returncode, "wallSeconds": time.perf_counter() - began, "networkDenied": True}
(output / "transport.json").write_text(json.dumps(receipt, indent=2) + "\n")
result.check_returncode()
envelope = json.loads((output / "stdout.json").read_text())
assert envelope["ok"], envelope
print(json.dumps(receipt | envelope), flush=True)
