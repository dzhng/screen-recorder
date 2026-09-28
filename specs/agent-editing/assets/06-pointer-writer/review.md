# Independent diagnostic review

Read-only Codex review found no actionable measurement or inference defect. It
independently checked all retained active-row hashes, attachment equality, source
and timing identities, input/worker hashes and the 23 decoded control hashes. It
also decoded all four retained movies through ffmpeg and confirmed baseline versus
instrumented parity for all 20 full and three range frames. The six prior PNG
comparisons reproduce, and the magenta measurements remain red.

The review agrees that equal supplied writer pixels localize this cohort's
disagreement downstream without establishing a unique codec cause or acceptable
quality. No public adoption or general export acceptance follows from this result.

Final author audit corrected the research pass/fail comparator's inclusive boundary
from `<= 1` to the incumbent's strict `< 1`. None of the measured deltas is exactly
one, so the complete parsed report is identical and remains
red. The final strict-comparator rerun reproduced every measurement and control.
Stale handoff wording was replaced with links to this measured boundary; earlier
legacy-byte and trail-color failures remain visible.

The instrumentation patch and frozen inputs are research artifacts. Production
native, preparation, frame and service owners are unchanged.
