"""Private frozen-recipe entry. Preparation and durable publication belong to the caller."""
import contextlib
import hashlib
import importlib.metadata as metadata
import json
import os
from pathlib import Path
import sys


class Refusal(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message


def require(condition, code, message):
    if not condition:
        raise Refusal(code, message)


def sha(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        while block := source.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def prepared(model, pins):
    require(sys.version == pins["python"], "MODEL_NOT_PREPARED", "Python identity differs from the prepared recipe")
    actual = {d.metadata["Name"]: d.version for d in metadata.distributions()}
    require(actual == pins["dependencies"], "MODEL_NOT_PREPARED", "Runtime dependencies differ from the prepared recipe")
    distribution = metadata.distribution("mlx-audio")
    for relative, expected in pins["runtimeFiles"].items():
        require(sha(distribution.locate_file(relative)) == expected, "MODEL_NOT_PREPARED", "Runtime source differs from the prepared recipe")
    for relative, expected in pins["modelFiles"].items():
        require(sha(model / relative) == expected, "MODEL_NOT_PREPARED", "Model bytes differ from the prepared recipe")


def generate(params):
    require(set(params) == {"model", "reference", "referenceText", "text", "generation", "seed", "output"}, "INVALID_REQUEST", "Invalid voice request fields")
    pins = json.loads(Path(__file__).with_name("pins.json").read_text())
    require(params["generation"] == pins["generation"] and type(params["seed"]) is int and params["seed"] == pins["seed"], "INVALID_REQUEST", "This private entry requires the frozen generation recipe")
    require(all(type(params["generation"][key]) is bool if type(value) is bool else type(params["generation"][key]) is not bool for key, value in pins["generation"].items()), "INVALID_REQUEST", "Generation flags and numbers must retain their types")
    for key in ["text", "referenceText"]:
        require(isinstance(params[key], str) and 0 < len(params[key].encode()) <= 16384, "INVALID_REQUEST", "Text must fit the bounded private request")
    for key in ["reference", "model", "output"]:
        require(isinstance(params[key], str) and Path(params[key]).is_absolute(), "INVALID_REQUEST", "Voice paths must be explicit and absolute")
    reference, model, output = (Path(params[k]) for k in ["reference", "model", "output"])
    require(not os.path.lexists(output), "INVALID_REQUEST", "Voice output already exists")
    require(reference.is_file(), "INVALID_REQUEST", "Reference audio is missing")
    require(reference.stat().st_size <= 1024 * 1024, "LIMIT_EXCEEDED", "Reference file exceeds the private entry byte limit")
    prepared(model, pins)
    import numpy as np
    from scipy.io import wavfile
    try:
        rate, audio = wavfile.read(reference)
    except (ValueError, OSError) as error:
        raise Refusal("INVALID_REQUEST", "Reference is not a supported WAV") from error
    require(rate == 24000 and audio.dtype == np.float32 and audio.ndim == 1 and 0 < len(audio) <= 120000 and np.isfinite(audio).all(), "INVALID_REQUEST", "Reference must be finite mono Float32 24 kHz audio of at most five seconds")
    reference_sha = sha(reference)
    # Reserve staging exclusively. The service workspace owner also cleans this after SIGKILL.
    with output.open("xb") as destination:
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model
        model_instance = load_model(str(model))
        mx.eval(model_instance.parameters())
        mx.random.seed(params["seed"])
        results = list(model_instance.generate(text=params["text"], ref_audio=str(reference), ref_text=params["referenceText"], **params["generation"]))
        generated = np.concatenate([np.asarray(result.audio, dtype=np.float32).reshape(-1) for result in results])
        require(all(result.sample_rate == rate for result in results) and generated.size > 0 and np.isfinite(generated).all(), "MEDIA_WORKER_FAILED", "Voice output format or samples are invalid")
        wavfile.write(destination, rate, generated)
    return {"file": str(output), "sha256": sha(output), "sampleRate": rate, "channels": 1,
            "frames": len(generated), "durationUs": round(len(generated) * 1000000 / rate),
            "referenceSha256": reference_sha, "runtimeRevision": pins["runtimeCommit"],
            "modelRevision": pins["modelRevision"], "generation": params["generation"],
            "effectiveRepetitionPenalty": max(params["generation"]["repetition_penalty"], 1.5),
            "seed": params["seed"], "text": params["text"], "referenceText": params["referenceText"]}


def main():
    try:
        frame = sys.stdin.buffer.readline(1024 * 1024 + 1)
        require(len(frame) <= 1024 * 1024 and frame.endswith(b"\n"), "INVALID_REQUEST", "Voice request must be one bounded JSON line")
        require(not sys.stdin.buffer.read(1), "INVALID_REQUEST", "Expected one voice request")
        request = json.loads(frame)
        require(set(request) == {"id", "operation", "params"} and request["operation"] == "voice.generatePrivate", "INVALID_REQUEST", "Unsupported private voice operation")
        # Third-party initialization/progress output never shares the JSON response channel.
        with contextlib.redirect_stdout(sys.stderr):
            data = generate(request["params"])
        result = {"ok": True, "data": data}
    except Refusal as error:
        result = {"ok": False, "error": {"code": error.code, "message": error.message, "details": {}, "retryable": False}}
    except (FileNotFoundError, metadata.PackageNotFoundError) as error:
        result = {"ok": False, "error": {"code": "MODEL_NOT_PREPARED", "message": str(error), "details": {}, "retryable": True}}
    except Exception as error:
        result = {"ok": False, "error": {"code": "MEDIA_WORKER_FAILED", "message": str(error), "details": {}, "retryable": False}}
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
