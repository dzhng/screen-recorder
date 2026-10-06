# Local source-bound speech

This module executes the prepared speech engine through the native worker. The
[model owner](../../../../packages/core/src/models.ts) verifies runtime and model
identity; execution never prepares another model or downloads replacement bytes.
Offline mode precedes loading because upstream load recovery can otherwise purge
and reacquire assets. Engine failures remain explicit.

Readable selected-source intervals are transcribed independently through the
[audio stream](../YapAudio/README.md). Unavailable source time is not
invented silence. Candidate words map back into their original interval, preserving
the source clock for later project projection.

## Spoken extent versus recognition extent

Engine token grouping retains comparability with its evaluated CLI, but punctuation
can be placed after the last audible sound. Word timing therefore distinguishes
speech-bearing token extent from the engine's broader recognition span. Raw evidence
retains both, including overlaps and exact points; neither estimate is independent
audible ground truth or edit intent. Invalid nonfinite, reversed or out-of-support
operands refuse with indexed diagnostics rather than being clamped or retried.
This also applies to delayed punctuation beyond selected physical support;
a caller may explicitly select wider context, but no estimate is silently repaired.
The [speech evaluation guide](../../../../packages/test-harness/speech/protocol.md)
owns alignment and interpretation of those estimates.

Core ML can emit unsolicited stdout diagnostics. Execution protects the worker's
response channel while the engine runs; progress is not allowed to become a second
protocol message. Selected input conditioning remains an execution concern,
separate from caller-authored processing.
