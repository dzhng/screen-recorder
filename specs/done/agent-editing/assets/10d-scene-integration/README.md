# Integrated scene preparation and event delivery

The project service uses the shared scene queue, retained scene store and source
reader for both asset and project queries. Raw cursor reads keep capture authority.
Startup cleanup shares the service cancellation lifetime; generic job retry owns
recovery. No second scene executor or recording-shaped asset adapter is introduced.

Actual source/project scene and complete capture/interruption journeys pass on
the integrated root runtime and frozen native worker. `scenes.json` and
`capture.json` retain checks, runtime hashes and run-length-compressed command
traces. The separate [public scene evidence](../10d-public-scenes/README.md) owns
the authored-clock, mixed-order and response-mutation controls.

The live journey exposed reversed source availability spans. Sorting the clipped
public spans preserves chronological support without changing the interval query
or hiding gaps. The retained focused red/green test asserts exact disjoint ranges.
Service tests and type checks pass. Independent service-integration review found
no actionable regressions; its runtime test attempt was blocked by sandbox socket
permissions. The actual unrestricted public journeys above provide runtime proof.
Final shape/diff/docs review confirms shared ownership and no new storage schema,
endpoint or dependency. Later root protocol wording describes verified scene
readiness and preserves the explicit unsupported project-cut category.

These checks establish event evidence and service lifecycle, not screenshot-index
selection, detector quality over arbitrary footage, physical capture or listening.
Those gates stay open in the owning slices. No installed app or user library was
used.
