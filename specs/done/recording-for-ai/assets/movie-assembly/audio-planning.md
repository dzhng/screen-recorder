# Shared retained-audio planning

The production excerpt path and full-movie callers share `planAudioTracks` in
[the audio owner](https://github.com/dzhng/screen-recorder/blob/867080a2b22c845780cbfde4bb926c288bb4707a/packages/core/src/audio.ts). The timeline supplies
kept source spans; acquisition evidence decides which recorded tracks and intervals
exist. Native code continues to own gain, resampling, ramps and sample rounding.
Asset paths are resolved by the live library or portable context, never inferred
from an absent track.

The excerpt wrapper keeps its thirty-second and thousand-span/interval limits,
and reports unavailable when no requested track was acquired. The shared planner
returns empty tracks with explicit missing-role reasons instead: a silent movie
is valid even though there is no audio excerpt to deliver. Unknown selection
metadata remains an error, not permission to invent silence.

A valid batch of one thousand cuts can create one thousand and one kept spans.
The shared planner therefore does not inherit the excerpt's total interval budget;
its bounded movie default is ten thousand intervals per track. The existing
source reader still rejects more than one thousand acquisition intervals within
one requested span. Larger fragmented sources need a paged native plan; this
checkpoint does not close that limitation or claim complete movie export.

## Evidence

The focused audio tests use the real source-evidence store and shared timeline.
They plan a thirty-five-second, thousand-cut revision, preserve every kept acquired
interval, retain public excerpt rejection, and distinguish unrequested from
unacquired roles without resolving absent files. Existing acquisition-gap,
relocation, retry and pinned-excerpt tests stay green. Lowering the shared interval
budget back to the excerpt budget makes the thousand-cut test fail explicitly.

This is core planning evidence. Production native acceptance of the larger plan,
AAC sample fidelity, public preview and export remain separate gates in
[13c](https://github.com/dzhng/screen-recorder/blob/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai/slices/13c-aac-movie-assembly.md).

Verification: thirteen focused audio tests and all 266 core tests pass; core
types and focused lint pass. Independent review found no actionable regression
and independently ran the audio/source-page tests and core type check.
