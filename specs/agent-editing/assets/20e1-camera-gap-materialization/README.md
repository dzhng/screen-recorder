# Camera gap materialization feasibility

The single retained-file experiment preserves three occupied intervals and their
exact decoded picture pixels through passthrough edit lists. The actual production
PresentationSource excludes empty edits at all tested boundaries/interiors.
This earns only the mechanism checkpoint: public picture admission still refuses
the fixture's SMPTE-C primaries. Parent20e remains incomplete.

## Evidence and failure boundaries

[Archive identities](archive.json) authenticate the raw source, candidate, complete
observations, scripts, executables, requests, responses and failure logs. The raw
three-picture MOV hash is `b5f77be5279854f51d2ec0816a83af21b48121a02b0e1de14be3771cc03aa669`.
It was copied from the retained20e run and stayed unchanged. No new capture, input
fixture or alternative encoding was used for the materialization experiment.

The original camera MOV reports continuous support across accepted timestamps
200000,300000,700000µs. A separate explicit-duration correction still failed the
actual decoded-gap assertion; its raw five-picture output and failure log remain
in the archive. The earlier `gap-control` invocation accidentally used a stale
binary following a compile failure; its setup limitation explicitly disqualifies
it. The separate rational60fps control accepts three contiguous frames, rejects a
duplicate and closes at50000µs, without changing the camera-gap verdict.

The [first experiment report](report.json) retains its red unfiltered decoder-count
check: six decoded buffers instead of three selected pictures. Occupied support is
exactly [200000,233333),[300000,333333),[700000,733333)µs. Endpoints round absolute
start+1/30 to the raw movie's actual1000000 timescale using roundHalfAwayFromZero;
there is no nearest-picture lookup or changed tolerance. Passthrough preserves
coded pictures and adds explicit empty segments.

[Saved-picture analysis](occupied-picture-analysis.json) establishes that all three
occupied timestamps and complete visible BGRA pixel hashes match raw source
pictures. The three extra decoder buffers are byte-exact opaque black at empty
edit starts. Those buffers are not evidence of acquired pictures: existing
PresentationSource/SourceSegment intentionally exclude empty edits. The
[actual-owner check](membership-report.json), linked against unchanged production
Frames/Media objects, tests18 segment boundaries/interiors and returns no buffer
or sample timestamp in empty edits while preserving all occupied pixels/timestamps.
It creates no second candidate and changes no source bytes.

## Public refusal remains open

Actual `media.probe` reports three physical samples and the expected occupied
segments. Its origin is200000µs and segment fields are already normalized to that
origin. An initial reinspection script subtracted the origin twice; the resulting
invalid request was correctly refused and is retained as setup error. The corrected
`media.sourceVisualSamples` call returns NOT_READY because the retained raw/candidate
video has SMPTE-C color primaries. No color tags, conversion, admission rule or
expected availability were changed to force a pass. Public positive picture/frame
admission is unverified; the lower-level membership proof does not waive that gate.

Build commands are standalone `swiftc -parse-as-library` for archived
`experiment.swift`, and the same command plus existing isolated Frames/Media object
files for `membership.swift`. Each executable receives its archived experiment
directory. The archive retains hashes for executable, linked objects, owner sources
and frozen native worker. The experiment's exit1 precedes the approved owner
reinspection's exit0; it must not be relabeled as an initially passing public gate.

The subsequent [offline implementation](../20e-selected-device-probe/README.md)
verifies durable mapping/replay and a separate unchanged709 input through public
source consumers. This retained SMPTE-C candidate remains refused. Neither result
authorizes a physical action or closes parent20/21.

Independent Codex artifact-only review rehashed all88 archive members and checked
complete pixel/timestamp comparisons and18 membership rows against the reports:
clean scoped verdict. It performed no native execution and did not establish
positive public color admission. Shape/docs review keeps the experiment as retained
evidence; no new production schema, tolerance, authorization mechanism or dependency
was adopted by this checkpoint.
