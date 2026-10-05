# Capture admission checkpoint

Public requests now select primary video as `{kind:"camera",deviceId:"…"}`.
Companion device/allocation fields refuse on this primary. Camera Only uses the
ordinary primary allocation; no companion directory is created. Existing screen
argument encodings and audio defaults are preserved, with no data migration.

The exact device crosses the protocol, service allocation and native controller.
A reused durable request ID with a changed camera refuses, including after
service/catalog reopen; an identical replay resolves its prior allocation without
another native Start. Controls likewise resolves an unanswered camera Start even
when that device has disconnected, and refuses a fresh take until it returns.

Screen authorization is independent of device discovery: absent access returns
empty screen arrays while cameras/microphones remain available. Authorized screen
enumeration errors remain errors. A failed catalog read preserves last-good
choices. Native admission tests reach injected preparation and deliberately refuse
before IO; malformed/conflicting requests never reach preparation.

## Evidence and review

Protocol index tests pass (19). The focused service camera/replay tests pass (2).
The real controls executable passes, including the demonstrated replay regression.
Native controller admission passes when invoked from the macOS package directory,
proving runner paths are independent of caller cwd. Scoped protocol/service builds,
types, lint, format and whitespace checks pass.

Merged production capture-view rendering/action checks pass. The merged native
primary-authority fixture and real core publication/evidence/reopen probe pass.
These rechecks exercise integrated owners, without broadening to the final suite.
Settings comparison/review lives in [the permission evidence](../04-permissions/README.md).

Shape review kept one chosen camera identity, one lazy discovery projection and
existing controls/service/native owners; it removed the obsolete permission-error
catalog reset and its parameter. Diff review preserved strict source fields and
existing replay encodings. Owner documentation states roles and independent
permissions rather than copying the operation catalog.

Independent Codex review found two P2 defects: availability wrongly blocked a lost
Start replay, and Start-failure permission dispatch treated camera as microphone.
The former was red-tested, corrected and green-tested; both permission paths now
send the enum's camera value and AV grants follow the AV branch. Reviewer protocol
tests passed; its service test was blocked by sandbox socket restrictions, so that
is not counted as service proof. The direct focused service run above is the proof.

Per-pass choices are banked in [choices.md](../../choices.md). Source models and
permission controls are implemented; production capture UI binding remains 06.
That slice will replace automatic Start-failure prompts with explicit inline
Allow/Retry actions. No physical camera acquisition is claimed here.

The retained host inventory discovered zero camera and microphone devices. Its
permission facts belong to a scratch executable, not the installed app identity.
Actual camera/narration/system-audio confirmations remain OPEN. No devices were
opened, permissions granted, app installed or original recordings modified.
