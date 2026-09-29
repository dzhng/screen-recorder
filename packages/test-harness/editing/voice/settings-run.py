"""Run a bounded settings tranche serially, preserving every request/output/attempt."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


def main():
    parser = argparse.ArgumentParser()
    for key in ("out", "bundle", "model"):
        parser.add_argument("--" + key, required=True)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--tranche", choices=("termination", "controls", "boundary"), default="termination")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[4]
    out, bundle, model = (Path(getattr(args, key)).resolve() for key in ("out", "bundle", "model"))
    if not args.verify_only:
        out.mkdir(mode=0o700)
    cases = json.loads((Path(__file__).with_name("cases.json")).read_text())
    frozen = root / "specs/agent-editing/assets/18-voice"
    sentence = "Okay, so this is the recorder workbench."
    if args.tranche == "termination":
        trials = [("frozen-word", cases["replacements"][0]["text"], {}),
                  ("frozen-phrase", cases["replacements"][1]["text"], {}),
                  ("effective-clamp", cases["replacements"][1]["text"], {"repetition_penalty": 1.5}),
                  ("sentence", sentence, {}), ("token-cap", sentence, {"max_tokens": 1})]
    elif args.tranche == "boundary":
        trials = [("word-cap", cases["replacements"][0]["text"], {"max_tokens": 11}),
                  ("word-last-eos", cases["replacements"][0]["text"], {"max_tokens": 12})]
    else:
        trials = [(name, sentence, change) for name, change in [
            ("seed", {"seed": 19}), ("seed-replay", {"seed": 19}),
            ("greedy", {"temperature": 0}), ("top-k-disabled", {"top_k": 0}),
            ("top-k-one", {"top_k": 1}), ("top-p", {"top_p": 0.8}),
            ("penalty", {"repetition_penalty": 1.8}), ("language-auto", {"lang_code": "auto"})]]
    env = dict(os.environ, HF_HOME=str(out / "cache"), HF_HUB_OFFLINE="1",
               TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_IMPLICIT_TOKEN="1",
               TOKENIZERS_PARALLELISM="false", PYTHONDONTWRITEBYTECODE="1")
    summary = {"passed": False, "tranche": args.tranche, "attempts": []}
    try:
        for name, text, change in trials:
            generation = dict(cases["generation"], **{k: v for k, v in change.items() if k != "seed"})
            request = {"reference": str(frozen / "reference.wav"), "referenceText": cases["reference"]["text"],
                       "text": text, "generation": generation, "seed": change.get("seed", cases["seed"])}
            request_path = out / (name + ".request.json")
            if args.verify_only:
                recorded = json.loads(request_path.read_text())
                assert {**recorded, "reference": request["reference"]} == request
                request = recorded
            else:
                request_path.write_text(json.dumps(request, indent=2) + "\n")
            command = ["/usr/bin/sandbox-exec", "-p", "(version 1)(allow default)(deny network*)",
                       str(bundle / "python/bin/python3.12"), "-I", "-B", str(Path(__file__).with_name("settings.py")),
                       "--bundle", str(bundle), "--model", str(model), "--request", str(request_path),
                       "--output", str(out / (name + ".wav")), "--report", str(out / (name + ".json"))]
            row = {"name": name, "command": command}
            summary["attempts"].append(row)
            started = time.monotonic()
            try:
                if not args.verify_only:
                    with (out / (name + ".log")).open("x") as log:
                        result = subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=600)
                    row["exitCode"] = result.returncode
                    assert result.returncode == 0, row
                result = json.loads((out / (name + ".json")).read_text())
                assert result["passed"] and result["request"] == request
                assert result["identity"]["referenceSha256"] == hashlib.sha256((frozen / "reference.wav").read_bytes()).hexdigest()
                expected = {k: generation[k] for k in ("temperature", "top_k", "top_p", "max_tokens", "stream")}
                expected.update(language=generation["lang_code"], streaming_interval=2.0,
                                repetition_penalty=max(generation["repetition_penalty"], 1.5))
                assert result["effective"] == expected
                events = result["observer"]["events"]
                eos = [event for event in events if event["event"] == "eosBranch"]
                assert len(eos) <= 1 and events[-1]["event"] == "loopExit"
                assert result["termination"]["reason"] == ("eos" if eos else "token-budget")
                assert result["output"]["sha256"] == hashlib.sha256((out / (name + ".wav")).read_bytes()).hexdigest()
                returned_tokens = sum(result["output"]["resultTokens"])
                budget = generation["max_tokens"]
                assert 0 < returned_tokens <= budget
                assert result["termination"]["reason"] == ("eos" if returned_tokens < budget else "token-budget")
                if args.tranche in ("termination", "boundary"):
                    assert result["termination"]["reason"] == ("token-budget" if name in ("token-cap", "word-cap") else "eos")
                if args.tranche == "boundary":
                    assert result["termination"]["step"] == budget - 1
                oracle = None
                if name.startswith("frozen-"):
                    oracle = frozen / ("same-take-" + name.removeprefix("frozen-") + ".wav")
                elif args.tranche == "boundary":
                    oracle = frozen / "same-take-word.wav"
                elif name == "effective-clamp":
                    oracle = frozen / "same-take-phrase.wav"
                elif name == "seed-replay":
                    oracle = out / "seed.wav"
                if oracle:
                    assert oracle.read_bytes() == (out / (name + ".wav")).read_bytes()
                    row["exactOracleWav"] = True
            except Exception as error:
                row["error"] = {"type": type(error).__name__, "message": str(error)}
                raise
            finally:
                row["wallSeconds"] = time.monotonic() - started
                (out / ("verification.json" if args.verify_only else "attempts.json")).write_text(json.dumps(summary, indent=2) + "\n")
            print(json.dumps(row), flush=True)
        summary["passed"] = True
    finally:
        (out / ("verification.json" if args.verify_only else "attempts.json")).write_text(json.dumps(summary, indent=2) + "\n")


if __name__ == "__main__":
    main()
