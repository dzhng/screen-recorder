# Separate subsampling from compression

This controlled comparison starts with the same eight normalized writer frames.
It converts RGB to limited-range BT.709 YUV and back with identical rounding/filter
settings. The only changed factor is chroma sampling: 4:4:4 versus 4:2:0. There is
no encoder. This is a code-value experiment, not a native display-quality verdict.

| Factor | Observed maximum RGB error | Meaning |
| --- | --- | --- |
| 4:4:4 roundtrip | 1–2 | Matrix/range quantization alone preserves these samples closely. |
| 4:2:0 roundtrip | 79–122 | Chroma subsampling alone produces large edge differences without compression. |

The 4:2:0 fraction of RGB channels exceeding four levels is 3.66–11.90%, versus
zero in the 4:4:4 control. A second run reproduces all output bytes and metrics.
This supports subsampling as a cause of large code-value errors; it does not prove
that it explains every native artifact or validate a new tolerance. Original
H.264 color/quality gates remain open. Raising bitrate cannot restore color samples
already discarded by a fixed subsampling transform.

Reproduce after running the parent writer analyzer into a fresh directory:

```sh
python3 specs/agent-editing/assets/16-zoom/writer/chroma/compare.py /tmp/writer-analysis /tmp/fresh-chroma-analysis
```

`report.json` includes exact FFmpeg commands, source/output hashes and all eight
per-frame metrics. Compressed raw inputs/outputs preserve the actual measured bytes.
The next informative native trial is a matched encoder comparison over the same
pre-append buffers, followed by realistic-resolution footage/text review. Do not
select a production profile from this tiny synthetic alone.
