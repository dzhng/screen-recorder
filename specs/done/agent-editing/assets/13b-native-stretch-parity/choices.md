# Choices retained by this checkpoint

- **Sound, high confidence: one vendor owner.** Native and research builds read the
  same unchanged headers in the native C target. Moving them avoids two copies
  drifting. The research runner itself stays byte-identical, including its recipe;
  only compilation search paths change. Both MIT notices remain beside the code.
- **Sound, high confidence: mechanical parity before public adoption.** A separately
  named13b prerequisite can test a native port without claiming13a speech acceptance.
  The app still refuses unresolved retiming. The complete14 requirements survive.
- **Sound, medium confidence: bounded all-buffer adapter.** The native interface
  takes selected samples and a declared count, matching upstream exact processing.
  Its60s mono48k boundary preserves the research scope for this checkpoint. It is
  not a public duration policy or stereo decision; public-scale design must revisit
  memory and cancellation without changing the frozen numerical winner silently.
- **Sound, high confidence: explicit unsupported outcome.** Upstream may zero its
  buffer when a request is too short. The adapter throws instead of returning that
  silence as successful audio. It does not switch to the short-window experiment,
  add hidden context, crop or publish failed output. C++ exceptions stay within C++.
- **Sound, high confidence: cancellation honesty.** Checks occur before and after
  the synchronous upstream call. A canceled result cannot be returned successfully,
  but the call cannot be interrupted internally. No streaming/cancel guarantee is
  inferred from RNNoise's different frame-based adapter.
- **Sound, high confidence: recorded feedback boundary.** Unanswered auditions mean
  no recorded acceptance; they do not prove unheard audio. Numerical PCM parity
  does not stand in for listening or independently protected word labels.
