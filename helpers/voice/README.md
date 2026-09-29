# Private reference speech entry

This sidecar preserves the frozen reference-conditioned generation recipe. The
service supplies explicitly prepared paths and uses its shared JSON process and
render-attempt owners for execution, cancellation and staging cleanup. The worker
cannot publish assets or edit projects. Its stdout is reserved for one result;
third-party progress belongs to stderr.

The preparation pins bind the measured Python/runtime/model inputs. The service
also verifies executable, entry and pin-file bytes before launch. Model and runtime
content checks happen before inference. Python isolated mode excludes ambient
Python paths and user-site packages; the checks cover dependency versions and
mlx-audio Python sources, not every dependency binary. Network is denied by the OS and offline
library flags. Ordinary calls never install or download preparation.

This entry checkpoint intentionally accepts only the measured private recipe and
mono Float32 24 kHz references of at most five seconds. Byte/text limits bound
admission; they are not a general public settings policy. Future widening belongs
to a measured integration slice. The service retains reference bytes inside its
existing attempt workspace; Python's cleanup cannot replace that owner under
SIGKILL. Completed output moves through exclusive publication, never overwriting
an input or existing destination.
