# Shared physical media primitives

This module owns the native meaning of media handles, time support, failures and
new-output publication. Capture, recovery, picture and audio consumers share these
rules so the same bytes cannot acquire different availability in different workers.

## Held authority beats a mutable path

Storage operations use inherited descriptors and retained file identity, then
walk contained members without following links. Reopening a pathname after
admission could select another inode. Locks on a shared open-file description
remain held while inherited copies survive; a crashed worker cannot release the
parent's retained authority. The [wire descriptor owner](../ScreenRecorderWire/Descriptors.swift)
owns transfer admission, while shared scans and removal stay descriptor-relative.

[Exclusive allocation](ExclusiveFile.swift) creates a single new leaf through a
held private directory. Both new-file writers and the private CLI runner use it;
a stale locator cannot redirect allocation.

[New-file publication](OutputFile.swift) stages privately beside an output and
publishes exclusively. An existing destination or source alias must never be
replaced. A killed worker can leave staging, so its attempt owner supplies cleanup.
A retained candidate can remain available for explicit recovery; closing handles
is not permission to delete an unidentified replacement.

Durable destination publication is a separate acknowledgement protocol in the
[publication owner](../ScreenRecorderWire/PublicationOperation.swift). A successful
native write cannot substitute for its committed receipt. Archive work uses the
[OS libarchive binding](../CLibArchive/README.md), with admitted member identity and
file-version checks rather than trusting a donor name.

## Presented support is not packet timing

Asset and stream clocks map through edit-list segments. Empty edits and decoder
padding cannot count as acquired sound or pictures. A final picture has no successor
from which to infer duration; explicit sample-cursor support is required. The gap
to the previous picture is not an alternative tail oracle.

Probing describes original bytes and bounded timing summaries. Successful metadata
inspection does not establish actual decoding or canonical capture authority;
those belong to their source and execution consumers.
