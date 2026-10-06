"""Bounded original Sortformer speaker primitive; preparation/publication belong to callers."""
import base64
import contextlib
import hashlib
import importlib.metadata as metadata
import json
import math
import os
from pathlib import Path
import resource
import struct
import sys
import time

MODEL_SHA256 = "8abd32832159c6ac1148c926b7276f35ba34582c444e559dce1f1253fea42ef8"
RECIPE = {"chunk_len": 340, "chunk_right_context": 40, "fifo_len": 40,
          "spkcache_update_period": 300, "spkcache_len": 188}
POSTPROCESSING = {"onset": .5, "offset": .5, "pad_onset": 0, "pad_offset": 0,
                  "min_duration_on": 0, "min_duration_off": 0}


class Refusal(Exception):
    def __init__(self, code, message, details=None, retryable=False):
        self.code, self.message = code, message
        self.details, self.retryable = details or {}, retryable


def require(condition, code, message, details=None):
    if not condition:
        raise Refusal(code, message, details)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def capture_native(segments, arrays, file):
    """Lossless diagnostic operands, including nonfinite/invalid tensor values."""
    payload = {"verified": False, "encoding": "dtype/shape + base64 native tensor bytes",
        "nativeSegmentLines": segments, "nativeTensors": [
            {"shape": list(array.shape), "dtype": array.dtype.str,
             "bytesBase64": base64.b64encode(array.tobytes()).decode("ascii")}
            for array in arrays]}
    json.dump(payload, file, allow_nan=False)
    file.flush()


def decode_native(segments, arrays, raw_file, frames):
    details = {"rawFile": raw_file, "verified": False}
    require(len(segments) == 1 and len(arrays) == 1,
            "MODEL_CONTRACT_CHANGED", "Expected one native observation", details)
    try:
        # The pinned native batch returns batch/time/speaker axes, never transposed.
        score_count = frames // 1280
        require(list(arrays[0].shape) == [1, score_count, 4] and arrays[0].dtype.str == "<f4",
                "MODEL_CONTRACT_CHANGED", "Native tensor axes/storage differ", details)
        matrix = arrays[0].reshape(-1, 4)
        scores = matrix.tolist()
        require(list(matrix.shape) == [score_count, 4] and
                all(len(row) == 4 and all(math.isfinite(value) and 0 <= value <= 1 for value in row)
                    for row in scores),
                "MODEL_CONTRACT_CHANGED", "Native score shape/support differs", details)
        raw_segments = []
        for line in segments[0]:
            start, end, speaker = line.split()
            row = {"speaker": speaker, "start": float(start), "end": float(end)}
            require(0 <= row["start"] < row["end"] <= frames / 16000 and speaker in
                    ["speaker_0", "speaker_1", "speaker_2", "speaker_3"],
                    "MODEL_CONTRACT_CHANGED", "Native segments exceed physical support", details)
            raw_segments.append(row)
    except (TypeError, ValueError, AttributeError) as error:
        raise Refusal("MODEL_CONTRACT_CHANGED", "Native output cannot be decoded", details) from error
    return {"segments": raw_segments, "nativeSegmentLines": segments[0],
            "nativeProbabilities": scores, "probabilityShape": list(matrix.shape)}


def observe(params):
    require(type(params) is dict and set(params) ==
            {"model", "pcm", "pcmSha256", "frames", "sampleRate", "output"},
            "INVALID_REQUEST", "Speaker request fields are invalid")
    require(type(params["frames"]) is int and 1280 <= params["frames"] <= 480000 and
            params["frames"] % 1280 == 0 and
            type(params["sampleRate"]) is int and params["sampleRate"] == 16000,
            "UNSUPPORTED_SPEAKER_WINDOW", "Speaker windows must be 80ms-grid mono16k spans of at most 30 seconds")
    for key in ["model", "pcm", "output"]:
        require(type(params[key]) is str and Path(params[key]).is_absolute(),
                "INVALID_REQUEST", "Speaker paths must be absolute")
    model, source, output = (Path(params[key]) for key in ["model", "pcm", "output"])
    try:
        require(source.stat().st_size == params["frames"] * 4, "INVALID_SPEAKER_INPUT", "Physical PCM extent differs")
        with source.open("rb") as input_file:
            pcm = input_file.read(params["frames"] * 4 + 1)
        require(len(pcm) == params["frames"] * 4, "INVALID_SPEAKER_INPUT", "Physical PCM extent changed")
    except OSError as error:
        raise Refusal("INVALID_SPEAKER_INPUT", "Prepared source bytes are unavailable") from error
    require(hashlib.sha256(pcm).hexdigest() == params["pcmSha256"],
            "INVALID_SPEAKER_INPUT", "Prepared PCM identity differs")
    require(all(math.isfinite(sample[0]) for sample in struct.iter_unpack("<f", pcm)),
            "INVALID_SPEAKER_INPUT", "Prepared PCM contains nonfinite samples")
    require(not output.exists(), "INVALID_REQUEST", "Speaker output already exists")
    with contextlib.ExitStack() as owned:
        reservations = []
        try:
            try:
                file = owned.enter_context(output.open("x"))
                reservations.append(file)
                native = owned.enter_context(Path(str(output) + ".native-unverified.json").open("x"))
                reservations.append(native)
            except OSError as error:
                raise Refusal("INVALID_SPEAKER_OUTPUT", "Speaker output destination is unavailable or already exists") from error
            return execute(pcm, model, file, native)
        except BaseException:
            for file in reservations:
                file.flush()
                if os.fstat(file.fileno()).st_size == 0:
                    Path(file.name).unlink(missing_ok=True)
            raise


def execute(pcm, model, file, native):
    try:
        require(sha(model) == MODEL_SHA256, "MODEL_NOT_PREPARED", "Original checkpoint identity differs")
    except OSError as error:
        raise Refusal("MODEL_NOT_PREPARED", "Original checkpoint bytes are unavailable", retryable=True) from error
    for package, version in [("nemo_toolkit", "2.7.3"), ("torch", "2.8.0"),
                             ("torchaudio", "2.8.0"), ("numpy", "2.3.5")]:
        try:
            require(metadata.version(package) == version, "MODEL_NOT_PREPARED", "Runtime version differs")
        except metadata.PackageNotFoundError as error:
            raise Refusal("MODEL_NOT_PREPARED", "Prepared runtime dependency is unavailable", retryable=True) from error
    entry = time.perf_counter()
    import numpy as np
    import torch
    from nemo.collections.asr.models import SortformerEncLabelModel

    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    instance = SortformerEncLabelModel.restore_from(str(model), map_location=torch.device("cpu"), strict=True)
    instance.eval()
    require(instance.device.type == "cpu", "MODEL_CONTRACT_CHANGED", "Expected original CPU execution")
    for key, value in RECIPE.items():
        setattr(instance.sortformer_modules, key, value)
    instance.sortformer_modules._check_streaming_parameters()
    require(int(instance._cfg.encoder.subsampling_factor) == 8,
            "MODEL_CONTRACT_CHANGED", "Native analysis clock differs")
    samples = np.frombuffer(pcm, dtype="<f4").copy()
    loaded = time.perf_counter()
    with torch.inference_mode():
        segments, probabilities = instance.diarize(audio=[samples], sample_rate=16000,
            batch_size=1, include_tensor_outputs=True, num_workers=0, verbose=False)
    finished = time.perf_counter()
    arrays = [tensor.detach().cpu().numpy() for tensor in probabilities]
    capture_native(segments, arrays, native)
    decoded = decode_native(segments, arrays, native.name, len(samples))
    report = {**decoded,
        "sampleRate": 16000, "sourceFrames": len(samples), "audioSeconds": len(samples) / 16000,
        "frameSeconds": int(instance._cfg.encoder.subsampling_factor) * .01,
        "config": RECIPE, "postprocessing": POSTPROCESSING, "modelConfig": str(instance._cfg),
        "modelSha256": MODEL_SHA256, "pcmSha256": hashlib.sha256(pcm).hexdigest(),
        "coldImportsLoadInputSeconds": loaded - entry, "inferenceSeconds": finished - loaded,
        "peakProcessRSSBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "torch": torch.__version__, "numpy": np.__version__}
    json.dump(report, file, indent=2, allow_nan=False)
    file.flush()
    return report


def main():
    try:
        frame = sys.stdin.buffer.readline(1024 * 1024 + 1)
        require(len(frame) <= 1024 * 1024 and frame.endswith(b"\n") and not sys.stdin.buffer.read(1),
                "INVALID_REQUEST", "Expected one bounded speaker request")
        try:
            request = json.loads(frame)
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise Refusal("INVALID_REQUEST", "Speaker request JSON is malformed") from error
        require(type(request) is dict and set(request) == {"id", "operation", "params"}
                and request["operation"] == "speaker.observe", "INVALID_REQUEST", "Unsupported speaker operation")
        with contextlib.redirect_stdout(sys.stderr):
            data = observe(request["params"])
        result = {"ok": True, "data": data}
    except Refusal as error:
        result = {"ok": False, "error": {"code": error.code, "message": error.message,
            "details": error.details, "retryable": error.retryable}}
    except Exception as error:
        result = {"ok": False, "error": {"code": "MEDIA_WORKER_FAILED", "message": str(error),
            "details": {}, "retryable": False}}
    print(json.dumps(result, allow_nan=False), flush=True)


if __name__ == "__main__":
    main()
