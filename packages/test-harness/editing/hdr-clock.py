"""Isolate sparse-frame tails, common origins and retained rotation metadata.

Usage: hdr-clock.py DISTRIBUTION NATIVE CHART_DIRECTORY NEW_OUTPUT_DIRECTORY
The final1/30s duration is independently authored fixture authority. Production
must obtain it from the native presented-sample cursor, not this fixture constant.
"""
import hashlib
import fractions
import json
import pathlib
import subprocess
import sys

runtime, native, charts, destination = sys.argv[1:5]
ffmpeg = str(pathlib.Path(runtime) / "bin/ffmpeg")
out = pathlib.Path(destination)
out.mkdir()
recipe = ("zscale=t=linear:npl=100:agamma=0,format=gbrpf32le,zscale=p=bt709,"
          "tonemap=tonemap=hable:desat=0:peak=10,"
          "zscale=t=bt709:m=bt709:r=limited:dither=error_diffusion:agamma=0,"
          "format=yuv444p10le,"
          "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=limited")

def run(args):
    subprocess.run([ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", *args], check=True)

def probe(name):
    request = {"id": name, "operation": "media.probe", "params": {"path": str(out / name)}}
    reply = subprocess.run([native], input=json.dumps(request) + "\n",
                           capture_output=True, text=True, check=True)
    (out / (name + ".native.json")).write_text(reply.stdout)
    decoded = json.loads(reply.stdout)
    assert decoded["ok"], decoded
    return decoded["data"]

def exact(value):
    if isinstance(value, int):
        return fractions.Fraction(value)
    return fractions.Fraction(value["numerator"], value["denominator"])

run(["-stream_loop", "2", "-i", str(pathlib.Path(charts) / "pq-chart.mov"),
     "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=0.1",
     "-filter_complex", "[0:v]settb=1/12000000,setpts=if(eq(N\\,0)\\,6000004\\,if(eq(N\\,1)\\,9000004\\,15000004))[v];[1:a]asetpts=PTS+0.04/TB[a]",
     "-map", "[v]", "-map", "[a]", "-c:v", "prores_ks", "-profile:v", "4",
     "-c:a", "pcm_s16le", "-fps_mode", "passthrough", "-enc_time_base:v", "filter",
     "-movie_timescale", "12000000", "-video_track_timescale", "12000000", "-color_primaries", "bt2020",
     "-color_trc", "smpte2084", "-colorspace", "bt2020nc", str(out / "source.mov")])
run(["-display_rotation", "90", "-i", str(out / "source.mov"), "-map", "0", "-c", "copy",
     "-movie_timescale", "12000000", "-video_track_timescale", "12000000",
     str(out / "rotated.mov")])
base = ["-copyts", "-noautorotate", "-i", str(out / "rotated.mov"), "-map", "0:v:0", "-an",
        "-vf", recipe, "-c:v", "prores_ks", "-profile:v", "4", "-alpha_bits", "0",
        "-fps_mode", "passthrough", "-enc_time_base", "demux",
        "-movie_timescale", "12000000", "-video_track_timescale", "12000000",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
control = ["-copyts", "-noautorotate", "-i", str(out / "rotated.mov"), "-map", "0:v:0", "-an",
           "-vf", recipe.replace("format=yuv444p10le", "format=yuv420p"),
           "-c:v", "h264_videotoolbox", "-b:v", "10000000", "-fps_mode", "passthrough",
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
run(control + [str(out / "inferred-tail.mp4")])
run(base + [str(out / "converted.mov")])
source, rotated, inferred, converted = [probe(name) for name in
                                       ("source.mov", "rotated.mov", "inferred-tail.mp4", "converted.mov")]
src, candidate = rotated["streams"][0], converted["streams"][0]
assert src["transform"] == candidate["transform"] == [0, -1, 1, 0, 0, 0]
assert (src["width"], src["height"]) == (candidate["width"], candidate["height"])
assert src["samples"]["count"] == candidate["samples"]["count"] == 3
assert src["samples"]["minDurationUs"] == candidate["samples"]["minDurationUs"] == 33333
assert src["samples"]["maxDurationUs"] == candidate["samples"]["maxDurationUs"] == 500000
source_run = next(s for s in src["segments"] if not s["empty"])
candidate_run = next(s for s in candidate["segments"] if not s["empty"])
assert exact(source_run["endUs"]) - exact(source_run["startUs"]) == fractions.Fraction(2350000,3)
assert exact(candidate_run["endUs"]) - exact(candidate_run["startUs"]) == fractions.Fraction(2350000,3)
assert exact(converted["originUs"]) == exact(rotated["originUs"]) + exact(source_run["startUs"])
assert inferred["streams"][0]["samples"]["minDurationUs"] != candidate["samples"]["minDurationUs"]
assert exact(source["originUs"]) == 40000
assert source["streams"][0]["samples"]["firstPtsUs"] == 460000
assert source["streams"][0]["samples"]["lastPtsUs"] == 1210000
assert exact(source["streams"][0]["startUs"]) == fractions.Fraction(1380001,3)
assert exact(source["streams"][0]["endUs"]) == fractions.Fraction(3730001,3)
def digest(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
identities = {"ffmpeg": digest(ffmpeg), "native": digest(native),
              "distributionReceipt": digest(pathlib.Path(runtime) / "receipt.json"),
              "source": digest(out / "source.mov"), "rotated": digest(out / "rotated.mov"),
              "converted": digest(out / "converted.mov"), "inferredTail": digest(out / "inferred-tail.mp4")}
report = {"identities":identities,"source": source, "rotated": rotated, "inferredTail": inferred, "converted": converted,
          "sourceClockAtDerivativeZeroUs": source_run["startUs"],
          "finalDurationAuthority": "native cursor must validate inherited decoded sample duration; authored1/30s is this fixture oracle",
          "recipe": recipe, "encoderTimebase": "demux",
          "rotation": "no autorotate, inherited source display matrix retained once"}
(out / "report.json").write_text(json.dumps(report, indent=2))
print(json.dumps({"report": str(out / "report.json"), "supportUs": {"numerator":2350000,"denominator":3},
                  "sourceClockAtDerivativeZeroUs": source_run["startUs"]}))
