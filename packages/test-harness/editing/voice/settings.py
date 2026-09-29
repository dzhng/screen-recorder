"""One bounded voice-settings experiment; observes the pinned generator, never edits it."""
import argparse
import ast
import contextlib
import hashlib
import importlib.util
import inspect
import json
from pathlib import Path
import resource
import sys
import textwrap
import time


def digest(path):
    value = hashlib.sha256()
    with open(path, "rb") as source:
        while chunk := source.read(1024 * 1024):
            value.update(chunk)
    return value.hexdigest()


def observe(model, report):
    """Read executed EOS branch and loop-exit locals, without evaluating MLX values."""
    function = model._generate_icl.__func__
    prepare = model._prepare_icl_generation_inputs.__func__
    sampler = model._sample_token.__func__
    lines, first = inspect.getsourcelines(function)
    tree = ast.parse(textwrap.dedent("".join(lines))).body[0]
    loops = [node for node in tree.body if isinstance(node, ast.For)
             and ast.unparse(node.iter) == "range(effective_max_tokens)"]
    assert len(loops) == 1, "Pinned ICL loop changed"
    loop = loops[0]
    branches = [node for node in loop.body if isinstance(node, ast.If)
                and ast.unparse(node.test) == "is_eos.item()"]
    assert len(branches) == 1 and len(branches[0].body) == 1
    branch = branches[0].body[0]
    assert isinstance(branch, ast.Break), "Pinned EOS branch changed"
    after = tree.body[tree.body.index(loop) + 1]
    assert ast.unparse(after) == "pbar.close()", "Pinned loop exit changed"
    eos_line, exit_line = first + branch.lineno - 1, first + after.lineno - 1
    report["observer"] = {"sourceSha256": digest(inspect.getfile(function)),
                          "eosBranchLine": eos_line, "loopExitLine": exit_line,
                          "events": []}
    keys = ("temperature", "top_k", "top_p", "repetition_penalty", "max_tokens",
            "language", "stream", "streaming_interval")

    def trace(frame, event, argument):
        if frame.f_code is prepare.__code__:
            if event == "return" and argument is not None:
                local = frame.f_locals
                report["prefill"] = {
                    "referenceFrames": int(local["audio_for_spk"].size),
                    "referenceCodes": int(local["ref_codes"].shape[2]),
                    "referenceTextTokens": int(local["ref_text_ids"].shape[1]),
                    "targetTextTokens": int(local["text_ids"].shape[1]),
                    "inputTokens": int(local["input_embeds"].shape[1]),
                    "language": local["language"],
                }
            return trace
        if frame.f_code is sampler.__code__:
            if event == "call":
                report.setdefault("logitsDtype", str(frame.f_locals["logits"].dtype))
            return None
        if frame.f_code is not function.__code__:
            return None
        if event == "call" and "effective" not in report:
            report["effective"] = {key: frame.f_locals[key] for key in keys}
        if event == "line" and frame.f_lineno == eos_line:
            report["observer"]["events"].append({"event": "eosBranch",
                "step": frame.f_locals["step"],
                "generatedCodes": len(frame.f_locals["generated_codes"])})
        if event == "line" and frame.f_lineno == exit_line:
            local = frame.f_locals
            eos = any(item["event"] == "eosBranch" for item in report["observer"]["events"])
            report["termination"] = {"reason": "eos" if eos else "token-budget",
                "step": local.get("step"), "generatedCodes": len(local["generated_codes"]),
                "effectiveMaxTokens": local["effective_max_tokens"]}
            if not eos:
                assert len(local["generated_codes"]) == local["effective_max_tokens"]
            report["observer"]["events"].append({"event": "loopExit", **report["termination"]})
        return trace
    return trace


def run(args, report):
    request = json.loads(Path(args.request).read_text())
    report["request"] = request
    root = Path(args.bundle).resolve()
    entry = root / "voice/worker.py"
    spec = importlib.util.spec_from_file_location("frozen_voice", entry)
    worker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(worker)
    pins = json.loads((root / "voice/pins.json").read_text())
    phase_started = time.monotonic()
    worker.prepared(Path(args.model), pins)
    report["preparationVerificationSeconds"] = time.monotonic() - phase_started
    report["identity"] = {"entrySha256": digest(entry), "pinsSha256": digest(root / "voice/pins.json"),
        "pythonSha256": digest(sys.executable), "runtimeRevision": pins["runtimeCommit"],
        "modelRevision": pins["modelRevision"], "harnessSha256": digest(__file__),
        "referenceSha256": digest(request["reference"]), "python": sys.version}
    # Experiment limits only; production admission and its frozen entry stay unchanged.
    import numpy as np
    from scipy.io import wavfile
    rate, reference = wavfile.read(request["reference"])
    assert rate == 24000 and reference.dtype == np.float32 and reference.ndim == 1
    assert 0 < len(reference) <= (480000 if args.envelope else 120000) and np.isfinite(reference).all()
    assert 0 < request["generation"]["max_tokens"] <= (1024 if args.envelope else 256)
    assert request["generation"]["stream"] is False
    assert 0 < len(request["text"].encode()) <= 16384
    import mlx.core as mx
    from mlx_audio.tts.utils import load_model
    phase_started = time.monotonic()
    model = load_model(str(Path(args.model).resolve()))
    mx.eval(model.parameters())
    report["modelLoadSeconds"] = time.monotonic() - phase_started
    path = Path(inspect.getfile(model.__class__))
    relative = "mlx_audio/tts/models/qwen3_tts/qwen3_tts.py"
    assert digest(path) == pins["runtimeFiles"][relative]
    mx.random.seed(request["seed"])
    trace = observe(model, report)
    started = time.monotonic()
    sys.settrace(trace)
    try:
        results = list(model.generate(text=request["text"], ref_audio=request["reference"],
            ref_text=request["referenceText"], **request["generation"]))
    finally:
        sys.settrace(None)
    report["generationSecondsWithObserver"] = time.monotonic() - started
    assert results and "termination" in report
    assert all(item.sample_rate == rate for item in results)
    audio = np.concatenate([np.asarray(item.audio, dtype=np.float32).reshape(-1) for item in results])
    assert audio.size > 0 and np.isfinite(audio).all()
    with open(args.output, "xb") as output:
        wavfile.write(output, rate, audio)
    report["output"] = {"sha256": digest(args.output), "frames": int(audio.size),
        "sampleRate": rate, "channels": 1, "durationSeconds": audio.size / rate,
        "resultTokens": [int(item.token_count) for item in results],
        "mlxPeakBytes": int(mx.get_peak_memory())}
    assert sum(report["output"]["resultTokens"]) == report["termination"]["generatedCodes"]
    report["passed"] = True


def main():
    parser = argparse.ArgumentParser()
    for name in ("bundle", "model", "request", "output", "report"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--envelope", action="store_true")
    args = parser.parse_args()
    report = {"passed": False, "scope": "Experiment only; no public setting or quality acceptance"}
    started = time.monotonic()
    try:
        with contextlib.redirect_stdout(sys.stderr):
            run(args, report)
    except Exception as error:
        report["error"] = {"type": type(error).__name__, "message": str(error)}
        raise
    finally:
        report["processSeconds"] = time.monotonic() - started
        report["peakResidentBytes"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        with open(args.report, "x") as output:
            json.dump(report, output, indent=2)
            output.write("\n")


if __name__ == "__main__":
    main()
