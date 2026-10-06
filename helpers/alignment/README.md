# Conditional word alignment

The [worker](worker.py) executes the pinned original NeMo auxiliary CTC head and
Torchaudio conditional path arithmetic. It preserves literal supplied tokenizer
inputs, full native Float32 scores, ceil-sized model support and complete path
operands. A forced path is evidence conditioned on supplied text; neither a path
nor an uncalibrated native score establishes lexical truth.

The model owner prepares the checkpoint and its
[offline runtime recipe](../model-runtime/README.md). Execution never installs,
downloads or substitutes another provider. Source-selected PCM is complete and
channel-specific; missing support cannot become padding. Word correspondence
uses the native ordered all-optimal owner after core text folding. Physical
admission remains separate from textual correspondence and never clamps a native
token cell into source support.

[Entry parity](../../packages/test-harness/editing/alignment-entry-parity.py)
controls only the provider response while executing the production parser and
real pinned path arithmetic. [Correspondence parity](../../packages/test-harness/editing/alignment-correspondence-parity.mjs)
compares complete possible-pair and omission operands through the native wire.
[Prepared runtime parity](../../packages/test-harness/editing/alignment-runtime-parity.mjs)
reads an existing verified Models preparation and compares actual native matrices
and complete conditional paths without acquiring inputs. Its optional sandbox
profile can deny donor directories as well as networking.
The [frozen reference](../../specs/video-editing-feedback/assets/09-local-alignment/README.md)
owns the accepted recipe, independent controls and interpretation limits.
