"""Standards-authored HDR chart and independent display-referred SDR reference.

Usage: hdr-chart.py pq|hlg OUTPUT_DIRECTORY ABSOLUTE_FFMPEG
The fixture encodes independently calculated ST2084 or BT2100 HLG/OOTF values;
the reference does not invoke a color converter. No installed app or user state.
"""
import json
import math
import pathlib
import struct
import subprocess
import sys
import zlib

family, destination, ffmpeg = sys.argv[1:4]
held_out = len(sys.argv) > 4 and sys.argv[4] == "held-out"
assert family in ("pq", "hlg")
out = pathlib.Path(destination)
out.mkdir(exist_ok=True)
width, height = 320, 192
patches = [
    [(v, v, v) for v in (0, .001, .01, .05, .1, .25, .5, 1, 4, 10)],
    [(.52, .25, .13), (.18, .12, .09), (.09, .18, .25), (.2, .3, .08),
     (.1, .1, .6), (.6, .15, .1), (.1, .7, .2), (.5, .4, .1),
     (.02, .025, .03), (1.5, .7, .3)],
]
if held_out:
    patches[0] = [(v, v, v) for v in (.002, .006, .017, .075, .18, .4, .75, 1.7, 6, 10)]
    patches[1] = [(.46, .23, .11), (.12, .095, .07), (.05, .22, .4), (.09, .5, .04),
                  (.04, .045, .8), (.75, .09, .04), (.045, .9, .12), (.9, .6, .02),
                  (1.660491, -.12455, -.01815), (-.07285, -.00835, 1.118729)]
# D65 BT709→BT2020 matrix, independently calculated from primary chromaticities.
primaries = [
    [.6274038959, .3292830384, .0433130657],
    [.0690972894, .9195403951, .0113623156],
    [.0163914389, .0880133079, .8955952532],
]

def pq(nits):
    power = (max(nits, 0) / 10000) ** (2610 / 16384)
    return ((3424 / 4096 + (2413 / 128) * power) /
            (1 + (2392 / 128) * power)) ** (2523 / 32)

def hlg(scene):
    if scene <= 1 / 12:
        return math.sqrt(max(0, 3 * scene))
    return .17883277 * math.log(12 * scene - .28466892) + .55991073

def hable(value):
    return ((value * (.15 * value + .05) + .004) /
            (value * (.15 * value + .5) + .06)) - .02 / .3

def png(path, rgb):
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data +
                struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
    rows = b"".join(b"\0" + rgb[y * width * 3:(y + 1) * width * 3]
                    for y in range(height))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" +
                     chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) +
                     chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))

planes = [[], [], []]
reference = bytearray()
for y in range(height):
    for x in range(width):
        source = patches[min(1, y // 96)][min(9, x // 32)]
        display = [sum(a * v for a, v in zip(row, source)) for row in primaries]
        if family == "hlg":
            # Inverse BT2100 display OOTF, gamma1.2 and1000nit nominal peak.
            luminance = sum(a * v / 10 for a, v in zip((.2627, .678, .0593), display))
            factor = luminance ** ((1 - 1.2) / 1.2) if luminance else 0
            red, green, blue = [hlg(v / 10 * factor) for v in display]
        else:
            red, green, blue = [pq(100 * v) for v in display]
        luma = .2627 * red + .6780 * green + .0593 * blue
        cb = (blue - luma) / (2 * (1 - .0593))
        cr = (red - luma) / (2 * (1 - .2627))
        for plane, value in zip(planes, (round(64 + 876 * luma),
                                        round(512 + 896 * cb), round(512 + 896 * cr))):
            plane.append(value)
        peak = max(source)
        scale = hable(peak) / hable(10) / peak if peak else 0
        # BT709 tag, display-referred inverse BT1886 (ideal display gamma2.4).
        reference.extend(round(255 * min(1, max(0, max(0, v * scale) ** (1 / 2.4))))
                         for v in source)

(out / f"{family}-chart.yuv").write_bytes(
    b"".join(struct.pack("<H", value) for plane in planes for value in plane))
(out / f"{family}-independent-sdr.ppm").write_bytes(
    f"P6\n{width} {height}\n255\n".encode() + reference)
png(out / f"{family}-reference.png", reference)
(out / f"{family}-oracle.json").write_text(json.dumps({
    "dimensions": [width, height], "linearBt709Patches": patches,
    "input": family + " BT2020 nonconstant limited-range10-bit authored signal",
    "toneMapping": "Hable,maxRGB,desaturation=0,peak=10,npl=100; BT709 tagged display-referred inverse BT1886 gamma2.4",
    "patchBoundaryExclusion": 8, "tolerance8Bit": 3,
}, indent=2))
transfer = "arib-std-b67" if family == "hlg" else "smpte2084"
subprocess.run([
    ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pixel_format", "yuv444p10le", "-video_size", f"{width}x{height}",
    "-framerate", "30", "-i", str(out / f"{family}-chart.yuv"),
    "-vf", f"setparams=color_primaries=bt2020:color_trc={transfer}:colorspace=bt2020nc:range=limited",
    "-frames:v", "1", "-c:v", "prores_ks", "-profile:v", "4",
    "-color_primaries", "bt2020", "-color_trc", transfer, "-colorspace", "bt2020nc",
    "-color_range", "tv", str(out / f"{family}-chart.mov"),
], check=True)
baseline = subprocess.run([
    ffmpeg, "-nostdin", "-hide_banner", "-i", str(out / f"{family}-chart.mov"),
    "-vf", "colorspace=all=bt709", "-frames:v", "1", "-f", "null", "-",
], capture_output=True, text=True)
(out / f"{family}-baseline-refusal.log").write_text(baseline.stderr)
assert baseline.returncode != 0 and "Unsupported input transfer characteristics" in baseline.stderr
