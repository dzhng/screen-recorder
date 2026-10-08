# Transcript review

Expose a convenience source/project operation that automatically prepares the registered speech model and only the requested inference support, then returns normal exact transcript pages. Require a bounded range for initial review; continuations pin generation/revision and remain offline. Reuse retained evidence before checking model readiness. Preserve project repeats, trims, gaps and track selection; rendered recognition remains separate. Explicit retry recovers failed convenience dependencies without ordinary reads restarting terminal failures.

Write one outer service test red first for automatic model acquisition and bounded words, then test pending progress, reuse/offline paging, failure/retry and project mapping. Keep transcript.get read-only. Review and commit the coherent pass, updating handoff and choices.
