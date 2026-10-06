"""Production worker parity with frozen CTC responses and real pinned path arithmetic.

The controlled model exists only here. Each subprocess executes the unchanged
production request parser and worker, including PCM/hash checks and publication.
No model inference or networking occurs; Torch/Torchaudio remain real.
"""
import argparse
import array
import base64
import gzip
import hashlib
import io
import json
from pathlib import Path
import runpy
import subprocess
import sys
import types


def read_json(path):
    if path.exists() and path.suffix != ".gz":
        return json.loads(path.read_text())
    compressed = path if path.suffix == ".gz" else Path(str(path) + ".gz")
    return json.loads(gzip.decompress(compressed.read_bytes()))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def child(args):
    import numpy as np
    import torch

    reference = Path(args.reference)
    raw = read_json(reference / "nemo-ctc110" / (args.case + ".json"))
    aligned = read_json(reference / "nemo-ctc110-alignment" / (args.case + ".json"))
    expected = aligned["candidates"][args.index]
    matrix_bytes = base64.b64decode(raw["nativeLogProbBytesBase64"])
    matrix = torch.from_numpy(np.frombuffer(matrix_bytes, dtype="<f4").copy()).reshape(raw["shape"])
    assert matrix.tolist() == raw["logProbs"], "Reference native and interpreted matrices differ"
    vocabulary = [raw["vocabulary"][str(i)] for i in range(1024)]
    directory = Path(args.output)
    pcm = gzip.decompress((reference / "inputs" / (args.case + ".f32.gz")).read_bytes())
    assert digest(pcm) == raw["pcmSha256"] and len(pcm) == raw["sourceFrames"] * 4
    pcm_path, checkpoint, output = directory / "input.f32", directory / "model.nemo", directory / "result.json"
    pcm_path.write_bytes(pcm)
    checkpoint.write_bytes(b"controlled restore input; no inference")
    calls = []

    class Config:
        preprocessor = types.SimpleNamespace(window_stride=.01)
        encoder = types.SimpleNamespace(subsampling_factor=8)

        def __str__(self):
            return raw["modelConfig"]

    class Decoder:
        num_classes_with_blank = 1025

        def __call__(self, *, encoder_output):
            assert encoder_output is model, "Encoder output must pass directly to the CTC head"
            # Deliberately plant padding; only encoded_len owns the admitted matrix.
            padded = torch.full((1, matrix.shape[0] + 3, 1025), -17., dtype=torch.float32)
            padded[0, :matrix.shape[0]] = matrix
            return padded

    class Model:
        cfg = Config()
        preprocessor = types.SimpleNamespace(featurizer=types.SimpleNamespace(dither=1., pad_to=16))

        def eval(self):
            calls.append("eval")
            return self

        def __call__(self, *, input_signal, input_signal_length):
            assert calls == ["restore", "eval", "literal_tokenizer"]
            assert self.preprocessor.featurizer.dither == 0. and self.preprocessor.featurizer.pad_to == 0
            assert torch.get_num_threads() == 2 and torch.get_num_interop_threads() == 2
            assert not torch.is_grad_enabled()
            assert input_signal.dtype == torch.float32 and list(input_signal.shape) == [1, raw["sourceFrames"]]
            assert input_signal_length.dtype == torch.int64 and input_signal_length.tolist() == [raw["sourceFrames"]]
            assert input_signal.numpy().astype("<f4").tobytes() == pcm
            calls.append("encoder")
            return self, torch.tensor([matrix.shape[0]], dtype=torch.int64)

    model = Model()
    model.ctc_decoder = Decoder()
    model.ctc_decoder.vocabulary = vocabulary

    def tokenize(text):
        assert text == expected["text"], "Literal supplied text changed before tokenization"
        calls.append("literal_tokenizer")
        return expected["ids"]

    model.tokenizer = types.SimpleNamespace(text_to_ids=tokenize)

    def restore(path, *, map_location, strict):
        assert path == str(checkpoint) and map_location == torch.device("cpu") and strict is True
        calls.append("restore")
        return model

    for name in ["nemo", "nemo.collections", "nemo.collections.asr", "nemo.collections.asr.models"]:
        sys.modules[name] = types.ModuleType(name)
    sys.modules["nemo"].__version__ = "2.7.3"
    sys.modules["nemo.collections.asr.models"].EncDecHybridRNNTCTCBPEModel = types.SimpleNamespace(restore_from=restore)
    request = {"operation": "alignment.observe", "params": {
        "model": str(checkpoint), "modelSha256": digest(checkpoint.read_bytes()),
        "pcm": str(pcm_path), "pcmSha256": raw["pcmSha256"], "frames": raw["sourceFrames"],
        "sampleRate": 16000, "text": expected["text"], "output": str(output),
    }}
    sys.stdin = io.StringIO(json.dumps(request))
    stdout = io.StringIO()
    old_stdout = sys.stdout
    try:
        sys.stdout = stdout
        runpy.run_path(args.worker, run_name="__main__")
    finally:
        sys.stdout = old_stdout
    envelope = json.loads(stdout.getvalue())
    assert envelope["ok"], envelope
    actual = json.loads(output.read_text())
    native = json.loads(Path(str(output) + ".native-unverified.json").read_text())
    assert native["bytesBase64"] == raw["nativeLogProbBytesBase64"]
    assert native["shape"] == raw["shape"] and native["untrimmedShape"] == [1, matrix.shape[0] + 3, 1025]
    assert native["tokenIds"] == expected["ids"] and native["text"] == expected["text"]
    assert actual["vocabulary"] == vocabulary and actual["blankId"] == raw["blankId"]
    assert [r["token"] for r in actual["greedyTokens"]] == aligned["greedyTokenIds"]
    candidate = actual["candidate"]
    for key in ["text", "ids", "status", "assignmentConfidence", "path", "frameLogScores",
                "nativePathMeanLogScore", "nativeNonblankMeanLogScore"]:
        assert candidate.get(key) == expected.get(key), (args.case, args.index, key)
    assert candidate.get("spans") == [
        {k: v for k, v in span.items() if k not in ["startSeconds", "endSeconds"]}
        for span in expected.get("spans", [])
    ], (args.case, args.index, "complete conditional spans")
    samples = array.array("f"); samples.frombytes(pcm)
    cells = actual["acoustic"]["cells"]
    assert [(c["startSample"], c["endSample"]) for c in cells] == [
        (start, min(start + 160, raw["sourceFrames"])) for start in range(0, raw["sourceFrames"], 160)]
    for cell in cells:
        block = samples[cell["startSample"]:cell["endSample"]]
        assert abs(cell["rms"] ** 2 - sum(float(x) ** 2 for x in block) / len(block)) < 1e-12
        assert cell["peak"] == max(abs(float(x)) for x in block)
    assert calls == ["restore", "eval", "literal_tokenizer", "encoder"]
    record = {"case": args.case, "candidate": args.index, "text": expected["text"],
        "matrixSha256": digest(matrix_bytes), "workerSha256": digest(Path(args.worker).read_bytes()),
        "request": request, "status": candidate["status"], "completeConditionalParity": True}
    (directory / "parity.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({k: record[k] for k in ["case", "candidate", "text", "status", "completeConditionalParity"]}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", required=True, help="Absolute production helpers/alignment/worker.py")
    parser.add_argument("--reference", required=True, help="Materialized frozen09 reference directory")
    parser.add_argument("--output", required=True, help="New evidence directory")
    parser.add_argument("--case", default="all", help="Frozen case id or all")
    parser.add_argument("--index", type=int, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.index is not None:
        return child(args)
    root = Path(args.output).resolve()
    root.mkdir()
    names = [args.case] if args.case != "all" else [
        path.name.removesuffix(".json").removesuffix(".gz").removesuffix(".json")
        for path in sorted((Path(args.reference) / "nemo-ctc110-alignment").glob("*.json*"))
        if "candidates" in read_json(path)]
    for name in names:
        reference = read_json(Path(args.reference) / "nemo-ctc110-alignment" / (name + ".json"))
        for index in range(len(reference["candidates"])):
            output = root / (name + "-" + str(index)); output.mkdir()
            subprocess.run([sys.executable, "-I", "-B", str(Path(__file__).resolve()),
                "--worker", str(Path(args.worker).resolve()), "--reference", str(Path(args.reference).resolve()),
                "--output", str(output), "--case", name, "--index", str(index)], check=True)


if __name__ == "__main__":
    main()
