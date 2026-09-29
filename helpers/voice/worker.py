"""Pinned ICL execution profile. Preparation and durable publication belong to the caller."""
import contextlib
import hashlib
import importlib.metadata as metadata
import json
import math
import re
import os
from pathlib import Path
import sys


class Refusal(Exception):
    def __init__(self, code, message, details=None):
        self.code, self.message, self.details = code, message, details or {}


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


def resolve_settings(generation, seed, profile):
    require(type(generation) is dict and not (set(generation) - set(profile["defaults"])),
            "INVALID_REQUEST", "Unknown voice generation setting")
    requested = {**profile["defaults"], **generation}
    def finite(value):
        try:
            return type(value) in (int, float) and math.isfinite(value)
        except OverflowError:
            return False
    temperature = requested["temperature"]
    require(finite(temperature) and (temperature == 0 or
            profile["temperature"]["minimumPositive"] <= temperature <= profile["temperature"]["maximum"]),
            "INVALID_REQUEST", "Temperature is outside the registered numerical interval")
    for key, low, high in [("top_k", 0, profile["topKMaximum"]),
                           ("max_tokens", 1, profile["maximumOutputTokens"])]:
        require(type(requested[key]) is int and low <= requested[key] <= high,
                "INVALID_REQUEST", f"{key} is outside the registered integer range")
    require(finite(requested["top_p"]) and profile["topPMinimum"] <= requested["top_p"] <= 1,
            "INVALID_REQUEST", "top_p is outside the registered numerical interval")
    require(finite(requested["repetition_penalty"]) and 0 < requested["repetition_penalty"] <= profile["repetitionMaximum"],
            "INVALID_REQUEST", "Repetition penalty must fit the registered bfloat16 scalar range")
    require(type(requested["lang_code"]) is str and requested["lang_code"] in profile["languages"],
            "INVALID_REQUEST", "Unsupported voice language")
    require(requested["stream"] is False, "INVALID_REQUEST", "Streaming is not registered")
    require(type(seed) is str and re.fullmatch(r"0|[1-9][0-9]{0,19}", seed) is not None
            and int(seed) <= int(profile["seedMaximum"]),
            "INVALID_REQUEST", "Seed must be a canonical unsigned 64-bit decimal string")
    for key in ["temperature", "top_k", "top_p"]:
        if requested[key] == 0:
            requested[key] = 0
    effective = {**requested, "repetition_penalty": max(requested["repetition_penalty"], profile["effectiveRepetitionMinimum"])}
    return requested, effective



def filter_modes(requested, profile):
    greedy = requested["temperature"] == 0
    def top_k(vocabulary):
        return "bypassed" if greedy else "disabled" if requested["top_k"] == 0 or requested["top_k"] >= vocabulary else "enabled"
    return {"sampling": "greedy" if greedy else "categorical",
            "firstBookTopK": top_k(profile["codebookVocabularies"]["first"]),
            "residualTopK": top_k(profile["codebookVocabularies"]["residual"]),
            "nucleus": "bypassed" if greedy else "disabled" if requested["top_p"] in (0, 1) else "enabled"}


def bounded_prepare(model, profile, evidence):
    """Pinned private API: observe existing encode calls; never reconstruct its prompt.

    The verified ICL source makes reference/target encode calls with trims3:-2/3:-5.
    Each original runs once and every original return value is passed unchanged.
    The worker owns one model instance for one attempt; no shared tokenizer state.
    """
    import mlx.core as mx
    original = model._prepare_icl_generation_inputs
    calls = 0
    def prepare(*args, **kwargs):
        nonlocal calls
        calls += 1
        require(calls == 1, "MODEL_CONTRACT_CHANGED", "Unexpected repeated ICL preparation")
        encode = model.tokenizer.encode
        token_counts = []
        token_hashes = []
        def observed_encode(*arguments, **options):
            index = len(token_counts)
            require(index < 2 and len(arguments) == 1 and type(arguments[0]) is str and not options,
                    "MODEL_CONTRACT_CHANGED", "Unexpected ICL tokenizer call")
            ids = encode(*arguments, **options)
            require(type(ids) is list and all(type(token) is int for token in ids),
                    "MODEL_CONTRACT_CHANGED", "Unexpected ICL tokenizer result")
            trim = -2 if index == 0 else -5
            require(len(ids) >= 3 - trim, "MODEL_CONTRACT_CHANGED", "Unexpected ICL template shape")
            text_ids = ids[3:trim]
            maximum = profile["maximumPrefillPositions"] if index == 0 else profile["maximumTargetTokens"]
            require(0 < len(text_ids) <= maximum, "LIMIT_EXCEEDED", "Voice text exceeds the registered token budget")
            token_counts.append(len(text_ids))
            token_hashes.append(hashlib.sha256(json.dumps(text_ids, separators=(",", ":")).encode()).hexdigest())
            return ids
        model.tokenizer.encode = observed_encode
        try:
            result = original(*args, **kwargs)
        except ValueError as error:
            raise Refusal("INVALID_REFERENCE", f"Reference preprocessing failed: {error}") from error
        finally:
            model.tokenizer.encode = encode
        require(len(token_counts) == 2 and type(result) is tuple and len(result) == 4
                and all(isinstance(value, mx.array) for value in result),
                "MODEL_CONTRACT_CHANGED", "Unexpected ICL preparation result")
        inputs, _, _, codes = result
        require(inputs.ndim == 3 and inputs.shape[0] == 1 and codes.ndim == 3
                and codes.shape[0] == 1 and codes.shape[1] == 16,
                "MODEL_CONTRACT_CHANGED", "Unexpected ICL preparation dimensions")
        require(0 < codes.shape[2] <= profile["reference"]["maximumCodecPositions"]
                and 0 < inputs.shape[1] <= profile["maximumPrefillPositions"],
                "LIMIT_EXCEEDED", "Voice context exceeds the registered prefill budget")
        evidence.update(referenceTextTokens=token_counts[0], targetTextTokens=token_counts[1],
                        referenceTextTokenSha256=token_hashes[0], targetTextTokenSha256=token_hashes[1],
                        referenceCodes=int(codes.shape[2]), inputTokens=int(inputs.shape[1]))
        return result
    model._prepare_icl_generation_inputs = prepare


def generate(params):
    require(type(params) is dict and set(params) == {"model", "reference", "referenceText", "text", "generation", "seed", "output"},
            "INVALID_REQUEST", "Invalid voice request fields")
    profile_path = Path(__file__).with_name("profile.json")
    profile = json.loads(profile_path.read_text())
    pins = json.loads(Path(__file__).with_name("pins.json").read_text())
    requested, effective = resolve_settings(params["generation"], params["seed"], profile)
    for key in ["text", "referenceText"]:
        require(type(params[key]) is str and bool(params[key].strip()), "INVALID_REQUEST", "Voice text must be nonempty")
    for key in ["reference", "model", "output"]:
        require(type(params[key]) is str and Path(params[key]).is_absolute(), "INVALID_REQUEST", "Voice paths must be explicit and absolute")
    reference, model, output = (Path(params[k]) for k in ["reference", "model", "output"])
    require(not os.path.lexists(output), "INVALID_REQUEST", "Voice output already exists")
    require(reference.is_file(), "INVALID_REFERENCE", "Reference audio is missing")
    require(reference.stat().st_size <= profile["reference"]["maximumEncodedBytes"], "LIMIT_EXCEEDED", "Reference file exceeds the registered byte limit")
    prepared(model, pins)
    import numpy as np
    from scipy.io import wavfile
    try:
        rate, audio = wavfile.read(reference)
    except (ValueError, OSError) as error:
        raise Refusal("INVALID_REFERENCE", "Reference is not a supported WAV") from error
    shape = profile["reference"]
    require(rate == shape["sampleRate"] and audio.dtype == np.float32 and audio.ndim == 1
            and 0 < len(audio) <= shape["maximumFrames"] and np.isfinite(audio).all(),
            "INVALID_REFERENCE", "Reference must be finite mono Float32 24 kHz audio within the registered frame budget")
    reference_sha = sha(reference)
    # Reserve staging exclusively; the shared service owner removes it on any failure/SIGKILL.
    with output.open("xb") as destination:
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model
        from mlx_audio.tts.models.qwen3_tts.qwen3_tts import Model
        model_instance = load_model(str(model))
        require(type(model_instance) is Model, "MODEL_CONTRACT_CHANGED", "Unexpected voice model implementation")
        mx.eval(model_instance.parameters())
        mx.random.seed(int(params["seed"]))
        prefill = {}
        bounded_prepare(model_instance, profile, prefill)
        results = list(model_instance.generate(text=params["text"], ref_audio=str(reference),
                        ref_text=params["referenceText"], **requested))
        require(len(results) == 1 and prefill, "MODEL_CONTRACT_CHANGED", "Expected one nonstream ICL result")
        count = results[0].token_count
        require(type(count) is int and 0 < count <= requested["max_tokens"], "MODEL_CONTRACT_CHANGED", "Invalid generated token count")
        # Pinned ICL has only EOS as an early break, before appending that code.
        if count == requested["max_tokens"]:
            raise Refusal("VOICE_INCOMPLETE", "Generation exhausted its token budget before end-of-speech",
                          {"stopReason": "token-budget", "generatedTokens": count, "maxTokens": requested["max_tokens"], "profileId": profile["id"], "prefill": prefill})
        generated = np.concatenate([np.asarray(result.audio, dtype=np.float32).reshape(-1) for result in results])
        require(results[0].sample_rate == rate and generated.size > 0 and np.isfinite(generated).all(), "MEDIA_WORKER_FAILED", "Voice output format or samples are invalid")
        wavfile.write(destination, rate, generated)
    tokenizer_identity = {name: pins["modelFiles"][name] for name in profile["tokenizerFiles"]}
    return {"file": str(output), "sha256": sha(output), "sampleRate": rate, "channels": 1,
            "frames": len(generated), "durationUs": round(len(generated) * 1000000 / rate),
            "referenceSha256": reference_sha, "referenceFrames": len(audio),
            "runtimeRevision": pins["runtimeCommit"], "modelRevision": pins["modelRevision"],
            "profileId": profile["id"], "profileSha256": sha(profile_path),
            "tokenizerIdentity": tokenizer_identity, "iclSourceSha256": pins["runtimeFiles"][profile["iclSourceFile"]],
            "generation": requested, "effectiveGeneration": effective, "filterModes": filter_modes(requested, profile), "seed": params["seed"],
            "prefill": prefill, "stopReason": "eos", "generatedTokens": count,
            "text": params["text"], "referenceText": params["referenceText"]}


def main():
    try:
        frame = sys.stdin.buffer.readline(1024 * 1024 + 1)
        require(len(frame) <= 1024 * 1024 and frame.endswith(b"\n"), "INVALID_REQUEST", "Voice request must be one bounded JSON line")
        require(not sys.stdin.buffer.read(1), "INVALID_REQUEST", "Expected one voice request")
        request = json.loads(frame)
        require(set(request) == {"id", "operation", "params"} and request["operation"] == "voice.generate", "INVALID_REQUEST", "Unsupported voice worker operation")
        # Third-party initialization/progress output never shares the JSON response channel.
        with contextlib.redirect_stdout(sys.stderr):
            data = generate(request["params"])
        result = {"ok": True, "data": data}
    except Refusal as error:
        result = {"ok": False, "error": {"code": error.code, "message": error.message, "details": error.details, "retryable": False}}
    except (FileNotFoundError, metadata.PackageNotFoundError) as error:
        result = {"ok": False, "error": {"code": "MODEL_NOT_PREPARED", "message": str(error), "details": {}, "retryable": True}}
    except Exception as error:
        result = {"ok": False, "error": {"code": "MEDIA_WORKER_FAILED", "message": str(error), "details": {}, "retryable": False}}
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
