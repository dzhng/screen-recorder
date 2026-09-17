# Native export controls

Each recent take offers Export Video and Export AI Package. Choosing one first reads
the take's current revision, then opens the save panel. An edit made while the panel
is open therefore does not change what is exported. The controller fixes a
lowercase UUID export identity before the first `export.create`. A reply lost to a
timeout, a stopped service or an unavailable service keeps that request visible as
unconfirmed. Its status is still read, so an admitted export is adopted without being
sent again. A person may send the same identity again or abandon it. A definite
refusal ends the request and shows the service's code.

Only one save panel is open at a time. Other takes remain exportable once a
destination is chosen. The menu keeps no destination or lifecycle of its own. It
shows the latest `export.status` for each export this app knows. Retry of a committed
export finishes only private cleanup, abandonment is offered for uncommitted work,
and a clean commit can be shown in Finder or removed from the list. After launch,
service restart or opening the menu, the controller pages `export.list` with
`unfinishedOnly` and reads status for each export it finds. Confirmed recording
deletion removes that take's exports from the menu; exported files remain.

## Verification boundary

- `swift run --package-path apps/macos ScreenRecorderControlsTests` pins the menu
  model:
  - one panel at a time
  - lost-reply identity
  - unavailable-service disabling
  - retry and abandonment rules
  - cleanup-pending commits
  - dismissal
  - deleted recordings
  - status decoding
- `apps/macos/tests/export-controls.test.mjs` compiles the production controller
  twice:
  - Against a scripted service it proves:
    - the revision is pinned across an edit made during the save panel
    - an admitted request is adopted after a lost reply without another send
    - an unadmitted request is sent again under the same identity
    - a refusal ends the request
    - both discovery pages are followed
    - repeated abandonment sends once
  - Against the real bundled service it:
    - exports a generated take while a concurrent cut advances the library
    - checks that the committed MP4 stays two seconds long
    - produces a real failed export at the occupied destination
    - restarts the service and rediscovers only the unfinished export, with its
      admitted destination
    - abandons it and confirms that status reports it absent and the destination
      folder holds only the committed file
- Two mutations fail the scripted check:
  - treating a timeout or stopped service as a refusal
  - forgetting an unadmitted request when status reports it absent

These checks do not click the real status menu or save panel, and include no visual
review. Physical menu interaction remains part of [slice 07](../../slices/07-menu-bar-controls.md).
