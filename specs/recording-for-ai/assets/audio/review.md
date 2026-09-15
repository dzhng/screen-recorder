# Native audio candidate integration review

Candidate `4b5ed01` is not yet accepted. Root invoked its real `media.audio` worker
on a generated 48kHz tone and 1,000 separated retained spans of 10,010 microseconds
each. It returned 480,000 frames instead of 480,480: a ten-millisecond shortening.
The [report](rounding-red.json) records the actual output and source hashes.
Destination boundaries must use cumulative playback time, not a sum of separately
rounded durations, so audio cannot drift relative to the edit timeline.

The candidate also lacked the caller-supplied acquisition intervals required by
its task. Container occupancy alone cannot distinguish known missing acquisition
from recorded silence. The correction must intersect recovery evidence with actual
media and report unavailable holes while refusing to read their sound into output.
Channel widening must not copy a stereo track's last channel into arbitrary extra
channels without a supported layout rule.

Claude Opus owns these corrections in `/tmp/screenrec-audio-excerpts`; root will
review and rerun the worker before integration. No excerpt has been auditioned,
and the parent audio/media-inspection and human-output gates remain open.
