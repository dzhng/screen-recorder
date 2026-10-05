"""Bounded evidence acquisition, not a product media or alignment operation."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import signal
import struct
import sys
import time
import urllib.request

root = Path(__file__).resolve().parent
cache = Path(sys.argv[1])
cache.mkdir(parents=True, exist_ok=True)
checks_bytes = (root / "acquisition-checks.json").read_bytes()
checks = json.loads(checks_bytes)
selection_bytes = (root / "source-selection.json").read_bytes()
selection = json.loads(selection_bytes)
sha = lambda value: hashlib.sha256(value).hexdigest()
assert sha(selection_bytes) == checks["sourceSelectionSha256"]
assert sha((root / "headers.json").read_bytes()) == checks["headerReceiptSha256"]
assert sha((root / "selected-labels.json").read_bytes()) == checks["selectedLabelsSha256"]
assert not (cache / "acquisition-receipt.json").exists(), "Never retry unchanged"
started = time.monotonic()
receipt = {
    "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "checksSha256": sha(checks_bytes),
    "sources": [],
    "scope": "Original complete-file stream SHA256 with only selected PCM retained; no inference or playback.",
}


def save():
    (cache / "acquisition-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")


def deadline(*_):
    receipt["status"] = "missing-authority: hard 600-second acquisition deadline"
    save()
    os._exit(124)


signal.signal(signal.SIGALRM, deadline)
signal.alarm(checks["hardBudgetSeconds"])
try:
    for source in checks["sources"]:
        name = source["name"]
        header = source["chunks"][0]["format"]
        data = source["chunks"][1]
        expected = source["riffDeclaredBytes"]
        assert header["tag"] == 1 and header["bitsPerSample"] == 16
        assert header["sampleRate"] == 44100
        assert header["channels"] in (1, 2)
        assert header["blockAlign"] == 2 * header["channels"]
        assert header["byteRate"] == 44100 * header["blockAlign"]
        assert data["dataOffset"] == 44 and data["size"] + 44 == expected
        assert data["size"] % header["blockAlign"] == 0
        windows = []
        for case in selection["cases"]:
            if case["mediaFile"] != name:
                continue
            first = case["startMs"] * 44100 // 1000
            last = case["endMs"] * 44100 // 1000
            assert first * 1000 == case["startMs"] * 44100
            assert last * 1000 == case["endMs"] * 44100
            start = 44 + first * header["blockAlign"]
            end = 44 + last * header["blockAlign"]
            assert 44 <= start < end <= expected
            windows.append({"case": case, "firstSample": first, "lastSample": last,
                            "startByte": start, "endByteExclusive": end, "pcm": bytearray()})
        request = urllib.request.Request(source["url"], headers={
            "Accept-Encoding": "identity", "If-Match": source["headers"]["Etag"],
            "User-Agent": "screenrec-source-admission/1"})
        digest = hashlib.sha256()
        offset = 0
        first_header = bytearray()
        next_progress = time.monotonic()
        print(json.dumps({"event": "stream-start", "name": name, "expectedBytes": expected}), flush=True)
        with urllib.request.urlopen(request, timeout=checks["socketTimeoutSeconds"]) as response:
            response_headers = dict(response.headers.items())
            assert response.status in (200, 206), response.status
            assert int(response.headers["Content-Length"]) == expected
            if response.status == 206:
                assert response.headers["Content-Range"] == f"bytes 0-{expected - 1}/{expected}"
            assert response.headers["ETag"] == source["headers"]["Etag"]
            assert response.headers["Last-Modified"] == source["headers"]["Last-Modified"]
            assert response.headers.get("Content-Encoding", "identity") == "identity"
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                digest.update(block)
                end = offset + len(block)
                assert end <= expected, "Oversized original response"
                if len(first_header) < 65536:
                    first_header.extend(block[:65536 - len(first_header)])
                for window in windows:
                    a, b = max(offset, window["startByte"]), min(end, window["endByteExclusive"])
                    if a < b:
                        window["pcm"].extend(block[a - offset:b - offset])
                offset = end
                if time.monotonic() >= next_progress:
                    print(json.dumps({"event": "stream-progress", "name": name, "bytes": offset,
                                      "elapsedSeconds": round(time.monotonic() - started, 2)}), flush=True)
                    next_progress = time.monotonic() + 10
        assert offset == expected, "Truncated original response"
        assert sha(first_header) == source["headerSha256"]
        assert bytes(first_header[:4]) == b"RIFF" and bytes(first_header[8:12]) == b"WAVE"
        assert struct.unpack_from("<I", first_header, 4)[0] + 8 == expected
        assert bytes(first_header[12:16]) == b"fmt " and bytes(first_header[36:40]) == b"data"
        assert struct.unpack_from("<HHIIHH", first_header, 20) == (
            1, header["channels"], 44100, header["byteRate"], header["blockAlign"], 16)
        assert struct.unpack_from("<I", first_header, 40)[0] == data["size"]
        bound = {"name": name, "url": source["url"], "responseStatus": response.status,
                 "responseHeaders": response_headers, "originalBytes": offset,
                 "originalWholeFileSha256": digest.hexdigest(), "originalHeaderSha256": sha(first_header),
                 "format": header, "originalFrames": data["size"] // header["blockAlign"],
                 "originalClockOrigin": 0, "windows": []}
        for window in windows:
            pcm = bytes(window.pop("pcm"))
            assert len(pcm) == window["endByteExclusive"] - window["startByte"]
            channel = "original mono"
            if header["channels"] == 2:
                identical = all(pcm[i:i + 2] == pcm[i + 2:i + 4] for i in range(0, len(pcm), 4))
                channel = "selected stereo channels byte-identical" if identical else "original stereo retained; channel attribution ambiguous"
            filename = window["case"]["id"] + ".pcm"
            path = cache / filename
            with path.open("xb") as target:
                target.write(pcm)
            bound["windows"].append({"caseId": window["case"]["id"], "split": window["case"]["split"],
                                     "filename": filename, "pcmSha256": sha(pcm), "retainedBytes": len(pcm),
                                     "sampleRange": {"start": window["firstSample"], "endExclusive": window["lastSample"]},
                                     "originalByteRange": {"start": window["startByte"], "endExclusive": window["endByteExclusive"]},
                                     "channelAdmission": channel})
        receipt["sources"].append(bound)
        save()
        print(json.dumps({"event": "stream-complete", "name": name, "sha256": digest.hexdigest()}), flush=True)
    receipt["status"] = "original-byte/sample/clock bindings admitted; lexical scoring/provider/quality pending"
    receipt["elapsedSeconds"] = round(time.monotonic() - started, 3)
    receipt["totalOriginalStreamBytes"] = sum(s["originalBytes"] for s in receipt["sources"])
    assert receipt["totalOriginalStreamBytes"] == checks["expectedTotalStreamBytes"]
    receipt["totalRetainedPcmBytes"] = sum(w["retainedBytes"] for s in receipt["sources"] for w in s["windows"])
    save()
except Exception as error:
    receipt["status"] = "missing-authority: acquisition failed; no unchanged retry"
    receipt["error"] = f"{type(error).__name__}: {error}"
    save()
    raise
finally:
    signal.alarm(0)
