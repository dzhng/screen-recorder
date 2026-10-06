# Unlike-microphone synchronization operands

These WAVs losslessly wrap complete selected-channel Float32 operands from the
three original participant recordings. They retain separate source clocks and
microphone signals; equal window selections do not mean the cameras are synced.
The [manifest](manifest.json) binds original identity, selections, captured PCM
hashes and retained WAV bytes. WAV files use the existing Git LFS owner.

The [research runner](../../../packages/test-harness/editing/synchronization/research.py)
owns acquisition, lossless wrapping, hash-checked replay and optional actual native
re-decode. Run its help using a prepared Python runtime with NumPy and SciPy.
No model inference is needed. The [frozen research](../../../specs/video-editing-feedback/assets/20-synchronization/README.md)
records the acoustic refusals and separates byte preservation from synchronization
quality. External originals remain unchanged. These inputs carry no speaker or
lexical labels and authorize no edit or clock declaration.
