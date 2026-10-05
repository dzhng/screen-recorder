# Numerical audio recipe reproduction

These bounded probes evaluate one pinned FFmpeg candidate against authored PCM,
independent static gain arithmetic and the loudness oracle. They do not admit a
production processor, listen to material or claim encoded peak compliance.

Run `python3 dynamics.py FFMPEG NEW_OUTPUT` for linked limiter/compressor timing,
packet and full-context crop checks. Run
`python3 normalization.py FFMPEG LIBEBUR128_ORACLE NEW_OUTPUT` for untouched
normalization confirmation. The independent oracle is built by the
[loudness reproduction](../loudness/README.md). Output directories must be new;
raw operands and complete results are saved before acceptance assertions.

A cropped result means processing the complete state domain and then selecting
the requested samples. It does not certify a new instance started at an excerpt
boundary. The compressor pads both inputs on one packet grid before processing
and trims to the declared frame count; that preserves a partial EOF block without
making padded silence part of the admitted signal. The compiler and native graph
must preserve that context in production.
