# Local camera splice discrimination

The full failed candidate's first extra acquired timestamp reproduces with only
two original occupied ranges, `[181144273,181210933)` and
`[181244263,181277593)` microseconds, and the exact intervening empty range.
Both source and candidate use timescale 1,000,000. The existing passthrough seam
creates an extra sample at 181210793, exposing the next selected picture for
140 microseconds inside the previous segment. The same candidate media sample
also appears at the correct next start. Preceding composition history and
rounded-time comparisons are unnecessary to trigger this failure.

A matched AVMutableMovie sample-copy/header candidate did not earn replacement
of the existing exporter. Its default movie timescale 600 first violated exact
support; that failed output is retained. Explicitly preserving the original
movie timescale fixed the first range, but the second occupied range points to
media with no corresponding picture. Bounded decoding independently confirms
this is not merely a cursor-domain interpretation: the first two pictures have
exact source PTS and BGRA hashes, while the third requested picture at 181244263
is absent. Readers complete. Both source-time and asset-time cursor requests
land on the same last available media sample. Compressed packet comparisons
also retain the first two payloads and lack the third source payload. Empty-edit
black buffers do not count as acquired pictures.

The installed SDK explicitly allows AVMutableMovie to copy sample data from
AVComposition or AVURLAsset tracks into self-contained media storage. It requires
sample copying for fragmented sources; reference-only output is unsuitable.
No implementation or timing-tolerance policy changed. Initial invalid initializer
compilation and resulting missing-file launch are retained as setup failures,
not candidate results. The alternative's exact-timescale trial is a construction
correction to preserve the same rational contract, not a new timescale policy.

All raw and retained failed full-candidate bytes remain unchanged. Only small
local MOVs were generated; no full take re-export, recording, installation or
production adoption occurred. The original blocked recovery remains distinct
from these reproducible sample-timing failures. Standalone completion does not
explain its decoder lifetime/context.

`evidence.tar.gz` preserves exact source programs, AV metadata, complete edit-list
metadata, local candidate files, diagnostic output and input/output hashes.
The large raw and failed full candidate remain at their hash-pinned locations;
the original fixture is separately retained through the root fixture owner.
The smallest unrun distinction is direct insertion of the same ranges from the
original AVURLAsset track into the same AVMutableMovie, isolating segmented
composition flattening from sample-copy behavior. No repaired exporter is claimed.
