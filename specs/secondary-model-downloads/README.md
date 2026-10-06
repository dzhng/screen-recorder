# Secondary model downloads

## Decision

The transcription model is part of the core recording-understanding path and
prepares automatically with the app. Voice generation and speaker diarization
remain explicit downloads for now because together they add several gigabytes
before a user has asked for either capability.

Explicit means the agent or user asks for the capability, Yap reports the
model's progress through the public model status contract, and the operation
waits or gives a retryable failure with the exact reason. It does not mean the
caller supplies arbitrary runtime paths as a normal setup step.

## Future boundary

The model registry owns the preparation policy and pinned identities. When the
secondary runtimes have a signed, reproducible distribution owned by Yap, add
that distribution to the registry and change their policy there. The service,
CLI and MCP surfaces should continue to use the same model list, status and
prepare operations; no adapter should grow a separate download mechanism.

The decision should be revisited when the product has a user-facing storage
choice, a way to show the size and purpose of optional downloads, and a verified
runtime distribution for each model. Until then, automatic startup acquisition
is reserved for models required to understand a new recording.
