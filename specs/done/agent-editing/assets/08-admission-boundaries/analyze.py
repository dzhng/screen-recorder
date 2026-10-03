import json
import pathlib
import struct
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
result = {}
for name in ["fractional", "discrete-stereo"]:
    def decode(part):
        return subprocess.check_output([
            "ffmpeg", "-v", "error", "-nostdin", "-i",
            str(root / f"{name}-project-{part}.wav"), "-f", "f32le", "-",
        ], timeout=30)
    full, selected = decode("full"), decode("range")
    start, end = 123457 * 48000 // 1000000, 812349 * 48000 // 1000000
    expected = full[start * 8:end * 8]
    assert len(full) == 48000 * 8
    assert len(selected) == (end - start) * 8
    a = struct.unpack("<" + "f" * (len(selected) // 4), selected)
    b = struct.unpack("<" + "f" * (len(expected) // 4), expected)
    maximum = max(abs(x-y) for x, y in zip(a, b))
    assert selected == expected
    shifted = full[(start + 1) * 8:(end + 1) * 8]
    assert selected != shifted, "One-frame-shift negative control was not detected"
    result[name] = {
        "rangeEqualsFullSlice": True, "maximumSampleDifference": maximum,
        "comparedFrames": len(selected) // 8, "expectedFrames": end - start,
        "oneFrameShiftControlDetected": True,
    }
print(json.dumps(result, indent=2))
