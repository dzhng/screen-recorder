# Public audio and capture integration

Project audio and source/project capture queries dispatch through existing core
owners. Source and project WAVs stage under the existing render-workspace lock;
the cache receives only completed files.

The integrated tree passed 44 focused CLI, service, render-lifetime and worker
tests, dependency builds and workspace type checks. Independent Codex review
found no actionable regression; its socket checks were sandbox-limited. The
unrestricted focused service tests passed separately.

The render tests reproduce native-style sibling staging with real spawned
processes, including service-owner SIGKILL and an orphan child retaining its
inherited lock. Removing lock inheritance makes that test fail. This proves
lifetime ownership, not native WAV conformance. Actual public media conformance
is recorded by the [wired tap journey](../11a-public-project-taps/wired-render/README.md);
the [capture journey](../10c-public-capture/README.md) records its exact frozen
runtime boundary.

The earlier preview/export preservation run passed; all 19 delivered PNGs were
byte-identical to the reviewed slice-09 baseline. This is preservation evidence,
not a new visual critique. Final source AAC integration remains open.
