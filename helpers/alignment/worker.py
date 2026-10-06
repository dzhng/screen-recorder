"""Pinned auxiliary NeMo CTC observations and conditional supplied-text paths."""
import array
import base64
import contextlib
import hashlib
import json
import math
from pathlib import Path
import resource
import sys
import time


class Refusal(Exception):
    def __init__(self, code, message, details=None):
        self.code, self.message, self.details = code, message, details or {}


def require(condition, code, message):
    if not condition:
        raise Refusal(code, message)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def observe(p):
    require(type(p) is dict and set(p) == {"model", "modelSha256", "pcm", "pcmSha256",
        "frames", "sampleRate", "text", "output"}, "INVALID_REQUEST", "Invalid alignment fields")
    require(type(p["frames"]) is int and 0 < p["frames"] <= 400000 and
        p["sampleRate"] == 16000, "UNSUPPORTED_ALIGNMENT_WINDOW",
        "Alignment requires one complete mono16k window of at most 25 seconds")
    require(type(p["text"]) is str and 0 < len(p["text"]) <= 8192 and
        0 < len(p["text"].split()) <= 512, "INVALID_REQUEST", "Supplied text exceeds bounded alignment")
    for name in ["model", "pcm", "output"]:
        require(type(p[name]) is str and Path(p[name]).is_absolute(), "INVALID_REQUEST",
            "Alignment paths must be absolute")
    model_path, pcm_path, output = (Path(p[name]) for name in ["model", "pcm", "output"])
    require(model_path.is_file() and not model_path.is_symlink() and
        pcm_path.is_file() and not pcm_path.is_symlink(), "INVALID_SOURCE", "Missing regular alignment input")
    data = pcm_path.read_bytes()
    require(len(data) == p["frames"] * 4 and hashlib.sha256(data).hexdigest() == p["pcmSha256"],
        "INVALID_SOURCE", "Prepared PCM differs from its complete identity")
    samples = array.array("f")
    samples.frombytes(data)
    require(sys.byteorder == "little" and all(math.isfinite(x) for x in samples),
        "INVALID_SOURCE", "PCM must contain finite little-endian Float32 samples")
    require(sha(model_path) == p["modelSha256"], "MODEL_HASH_MISMATCH", "Checkpoint identity changed")
    cells = []
    for at in range(0, len(samples), 160):
        block = samples[at:at + 160]
        cells.append({"startSample": at, "endSample": at + len(block),
            "rms": math.sqrt(sum(float(x) * float(x) for x in block) / len(block)),
            "peak": max(abs(float(x)) for x in block)})
    raw_path = Path(str(output) + ".native-unverified.json")
    require(not output.exists() and not raw_path.exists(), "OUTPUT_EXISTS", "Alignment output already exists")
    started = time.perf_counter()
    import numpy as np
    import torch
    import torchaudio
    import nemo
    from nemo.collections.asr.models import EncDecHybridRNNTCTCBPEModel
    require(torch.__version__.split("+")[0] == "2.8.0" and
        torchaudio.__version__.split("+")[0] == "2.8.0" and nemo.__version__ == "2.7.3" and
        np.__version__ == "2.3.5", "MODEL_CONTRACT_CHANGED", "Pinned inference runtime changed")
    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    model = EncDecHybridRNNTCTCBPEModel.restore_from(str(model_path),
        map_location=torch.device("cpu"), strict=True)
    model.eval()
    model.preprocessor.featurizer.dither = 0.
    model.preprocessor.featurizer.pad_to = 0
    vocabulary = list(model.ctc_decoder.vocabulary)
    blank = model.ctc_decoder.num_classes_with_blank - 1
    frame_seconds = float(model.cfg.preprocessor.window_stride) * int(model.cfg.encoder.subsampling_factor)
    require(blank == 1024 and len(vocabulary) == 1024 and frame_seconds == .08,
        "MODEL_CONTRACT_CHANGED", "Native CTC vocabulary or frame clock changed")
    ids = model.tokenizer.text_to_ids(p["text"])
    audio = np.frombuffer(data, dtype="<f4").copy()
    with torch.inference_mode():
        encoded, encoded_len = model(input_signal=torch.from_numpy(audio).reshape(1, -1),
            input_signal_length=torch.tensor([len(audio)], dtype=torch.int64))
        original = model.ctc_decoder(encoder_output=encoded)
        matrix = original[0, :int(encoded_len[0])].cpu().float().contiguous()
    native = {"pcmSha256": p["pcmSha256"], "modelSha256": p["modelSha256"],
        "sourceFrames": p["frames"], "shape": list(matrix.shape), "untrimmedShape": list(original.shape),
        "dtype": "<f4", "bytesBase64": base64.b64encode(matrix.numpy().astype("<f4").tobytes()).decode(),
        "blankId": blank, "vocabulary": vocabulary, "text": p["text"], "tokenIds": ids,
        "frameSamples": 1280, "sampleRate": 16000}
    with raw_path.open("x") as file:
        json.dump(native, file, allow_nan=False)
    require(bool(torch.isfinite(matrix).all()), "MODEL_CONTRACT_CHANGED", "Nonfinite native CTC scores")
    runs = []
    previous = -1
    for at, token in enumerate(matrix.argmax(dim=1).tolist()):
        if token != blank:
            if token == previous:
                runs[-1]["endFrame"] = at + 1
            else:
                runs.append({"token": token, "startFrame": at, "endFrame": at + 1})
        previous = token
    candidate = {"text": p["text"], "ids": ids, "status": "forced_path_observation",
        "assignmentConfidence": None}
    if not ids or blank in ids or max(ids) >= matrix.shape[1]:
        candidate.update(status="refused", reason="Empty/blank/out-of-vocabulary supplied tokenization")
    else:
        try:
            path, scores = torchaudio.functional.forced_align(matrix.unsqueeze(0),
                torch.tensor([ids], dtype=torch.int64), blank=blank)
            spans = torchaudio.functional.merge_tokens(path[0], scores[0].exp(), blank=blank)
            candidate.update(path=path[0].tolist(), frameLogScores=scores[0].tolist(),
                spans=[{"token": s.token, "startFrame": s.start, "endFrame": s.end,
                    "nativeMeanTokenProbability": s.score} for s in spans],
                nativePathMeanLogScore=float(scores.mean()),
                nativeNonblankMeanLogScore=float(scores[path != blank].mean()))
            if not bool(torch.isfinite(scores).all()):
                candidate.update(status="refused", reason="Nonfinite forced path scores",
                    frameLogScores=None, nativePathMeanLogScore=None, nativeNonblankMeanLogScore=None)
        except Exception as error:
            candidate.update(status="refused", reason=str(error))
    report = {"pcmSha256": p["pcmSha256"], "modelSha256": p["modelSha256"],
        "sourceFrames": p["frames"], "sampleRate": 16000, "frameSamples": 1280,
        "shape": list(matrix.shape), "blankId": blank, "vocabulary": vocabulary,
        "greedyTokens": runs, "candidate": candidate,
        "acoustic": {"resolutionSamples": 160, "cells": cells,
            "observedLowerDecileRMS": sorted(c["rms"] for c in cells)[(len(cells) - 1) // 10],
            "noiseFloorInterpretation": "unknown; lower-decile energy is measured context, not identified noise"},
        "semantics": "Forced path conditioned on literal supplied text; native likelihoods uncalibrated; no lexical ground truth or partial-fragment identity",
        "torch": torch.__version__, "torchaudio": torchaudio.__version__, "nemo": nemo.__version__,
        "modelConfig": str(model.cfg), "seconds": time.perf_counter() - started,
        "peakProcessRSSBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
    with output.open("x") as file:
        json.dump(report, file, allow_nan=False)
    return {"report": str(output), "nativeReceipt": str(raw_path), "shape": list(matrix.shape)}


def main():
    try:
        request = json.load(sys.stdin)
        require(type(request) is dict and request.get("operation") == "alignment.observe",
            "INVALID_REQUEST", "Unsupported alignment operation")
        with contextlib.redirect_stdout(sys.stderr):
            result = observe(request["params"])
        response = {"ok": True, "data": result}
    except Refusal as error:
        response = {"ok": False, "error": {"code": error.code, "message": error.message,
            "retryable": False, "details": error.details}}
    except Exception as error:
        response = {"ok": False, "error": {"code": "ALIGNMENT_FAILED", "message": str(error),
            "retryable": False, "details": {}}}
    print(json.dumps(response, allow_nan=False))


if __name__ == "__main__":
    main()
